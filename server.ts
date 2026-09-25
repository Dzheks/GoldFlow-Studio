import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as flowBridge from './flowBridge';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '50mb' }));

  // Initialize Gemini SDK with User-Agent as required by SKILL.md
  const apiKey = process.env.GEMINI_API_KEY || '';
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const lumeanApiKey = process.env.LUMEAN_API_KEY || '';
  const LUMEAN_BASE = 'https://api.lumean.app/api/public';
  // Templates are reusable — cache one per voiceId instead of creating a new
  // one on every synthesis call.
  const lumeanTemplateCache = new Map<string, string>();

  // Health and Model Info endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(apiKey),
      hasLumeanKey: Boolean(lumeanApiKey),
      supportedModels: [
        'veo-3.1-fast-generate-preview',
        'veo-3.1-lite-generate-preview',
        'veo-3.1-generate-preview',
      ],
      defaultModel: 'veo-3.1-fast-generate-preview',
      aspectRatios: ['16:9', '9:16'],
    });
  });

  // Goldflow's "Модель" cards map to real Veo model ids. "Gemini Omni Flash"
  // has no separate public video-model id — it's the same fast Veo engine
  // with native audio forced on and a wider reference-image budget, matching
  // what the UI actually promises (native audio + up to 7 references), not a
  // fictional distinct model.
  const VIDEO_MODEL_MAP: Record<string, { modelId: string; maxReferenceImages: number; supportsLastFrame: boolean; forceAudio?: boolean }> = {
    VEO_3_1_FAST: { modelId: 'veo-3.1-fast-generate-preview', maxReferenceImages: 3, supportsLastFrame: true },
    VEO_3_1_QUALITY: { modelId: 'veo-3.1-generate-preview', maxReferenceImages: 3, supportsLastFrame: true },
    GEMINI_OMNI_FLASH: { modelId: 'veo-3.1-fast-generate-preview', maxReferenceImages: 7, supportsLastFrame: false, forceAudio: true },
  };
  const stripDataUrl = (s: string) => (s || '').replace(/^data:image\/\w+;base64,/, '');

  // 1. START Video Generation: POST /api/generate-video
  app.post('/api/generate-video', async (req, res) => {
    try {
      if (!apiKey) {
        return res.status(503).json({ error: 'GEMINI_API_KEY не настроен в окружении' });
      }

      const { prompt, aspectRatio, modelCode, count, firstFrame, lastFrame, referenceImages } = req.body || {};
      const modelCfg = VIDEO_MODEL_MAP[modelCode] || VIDEO_MODEL_MAP.VEO_3_1_FAST;
      const validRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const cleanPrompt = (prompt || '').trim();
      const numberOfVideos = Math.max(1, Math.min(4, Number(count) || 1));

      if (!cleanPrompt) {
        return res.status(400).json({ error: 'Опиши, что происходит в кадре' });
      }

      const payload: any = {
        model: modelCfg.modelId,
        prompt: cleanPrompt,
        config: {
          numberOfVideos,
          aspectRatio: validRatio,
          ...(modelCfg.forceAudio ? { generateAudio: true } : {}),
        },
      };

      const refs = Array.isArray(referenceImages) ? referenceImages.filter((r: any) => r?.base64) : [];
      if (refs.length > 0) {
        // referenceImages is mutually exclusive with image/lastFrame per the API.
        payload.config.referenceImages = refs.slice(0, modelCfg.maxReferenceImages).map((r: any) => ({
          image: { imageBytes: stripDataUrl(r.base64), mimeType: r.mimeType || 'image/png' },
          referenceType: 'ASSET',
        }));
      } else if (firstFrame?.base64) {
        payload.image = { imageBytes: stripDataUrl(firstFrame.base64), mimeType: firstFrame.mimeType || 'image/png' };
        if (modelCfg.supportsLastFrame && lastFrame?.base64) {
          payload.config.lastFrame = { imageBytes: stripDataUrl(lastFrame.base64), mimeType: lastFrame.mimeType || 'image/png' };
        }
      }

      const operation = await ai.models.generateVideos(payload);
      return res.json({
        operationName: operation.name,
        model: modelCfg.modelId,
        count: numberOfVideos,
      });
    } catch (err: any) {
      console.error('generate-video error:', err);
      res.status(500).json({ error: err?.message || 'Не удалось запустить генерацию видео' });
    }
  });

  // 2. POLL Video Status: POST /api/video-status
  app.post('/api/video-status', async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) {
        return res.status(400).json({ error: 'operationName is required' });
      }

      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });

      return res.json({
        done: Boolean(updated.done),
        error: updated.error || null,
        count: updated.response?.generatedVideos?.length || 0,
      });
    } catch (err: any) {
      console.error('video-status error:', err);
      res.status(500).json({ error: err?.message || 'Failed to get video status' });
    }
  });

  // Shared streaming logic for both the inline <video> player and the download button.
  const streamGeneratedVideo = async (
    req: express.Request,
    res: express.Response,
    { asAttachment }: { asAttachment: boolean }
  ) => {
    try {
      const opName = (req.query.op as string) || '';
      const index = Math.max(0, Number(req.query.index) || 0);
      if (!opName) return res.status(400).send('Operation name missing');

      const op = new GenerateVideosOperation();
      op.name = opName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      const uri = updated.response?.generatedVideos?.[index]?.video?.uri;

      if (!uri) return res.status(404).send('Video not ready');

      const videoRes = await fetch(uri, { headers: { 'x-goog-api-key': apiKey } });
      if (!videoRes.ok) return res.status(videoRes.status).send('Failed to fetch generated video from upstream');

      res.setHeader('Content-Type', 'video/mp4');
      if (asAttachment) {
        res.setHeader('Content-Disposition', `attachment; filename="veo3-${index}.mp4"`);
      }
      if (videoRes.body) {
        videoRes.body.pipeTo(
          new WritableStream({
            write(chunk) { res.write(chunk); },
            close() { res.end(); },
          })
        );
      } else {
        const buf = await videoRes.arrayBuffer();
        res.send(Buffer.from(buf));
      }
    } catch (err: any) {
      console.error('video stream/download error:', err);
      res.status(500).send(err?.message || 'Streaming failed');
    }
  };

  // GET so a plain <video src> can stream it directly; ?index picks which of the numberOfVideos results.
  app.get('/api/video-stream', (req, res) => streamGeneratedVideo(req, res, { asAttachment: false }));
  app.get('/api/video-download', (req, res) => streamGeneratedVideo(req, res, { asAttachment: true }));

  // ---- Content Factory: real script + image generation via Gemini ----
  // NOTE: these public model ids are current as of early 2026 training data.
  // Google renames/versions image models often — verify against the current
  // AI Studio model picker if generation starts returning 404/"model not found".
  const IMAGE_MODEL_MAP: Record<string, string> = {
    HARBOR_SEAL: 'gemini-2.5-flash-image', // Nano Banana 2 Lite
    NARWHAL: 'gemini-2.5-flash-image', // Nano Banana 2 — still the same underlying
    // flash model as Lite (no distinct public id exists yet). Tried forcing
    // 2K via imageSize to give it a real edge over Lite — pulled it back out:
    // a user hit visibly broken/abstract output right after, and this model
    // isn't documented as supporting non-default sizes, so 2K on it is an
    // unverified risk, not a confirmed win. GEM_PIX_2 is a genuinely
    // different, more capable model (gemini-3-pro-image-preview), so 2K
    // there is a safer bet. Until Google ships an actual distinct "NB2"
    // model id, Lite and standard really are the same thing at 1K — that's
    // the honest state, not a fake distinction dressed up as real.
    GEM_PIX_2: 'gemini-3-pro-image-preview', // Nano Banana Pro
  };
  // Real resolution tiers (Gemini image API's own imageSize config: 1K/2K/4K,
  // defaults to 1K if unset).
  const IMAGE_SIZE_MAP: Record<string, string> = {
    HARBOR_SEAL: '1K',
    NARWHAL: '1K',
    GEM_PIX_2: '2K',
  };
  const TEXT_MODEL = 'gemini-3.1-pro-preview'; // gemini-2.5-pro retired for new keys as of this session's live test
  const MOTION_OPTIONS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static'];

  const nineFieldsSchema = {
    type: 'object',
    properties: {
      lens: { type: 'string' },
      action: { type: 'string' },
      moment: { type: 'string' },
      foreground: { type: 'string' },
      location: { type: 'string' },
      background: { type: 'string' },
      texture: { type: 'string' },
      light: { type: 'string' },
      mood: { type: 'string' },
    },
    required: ['lens', 'action', 'moment', 'foreground', 'location', 'background', 'texture', 'light', 'mood'],
  };

  // ---- Real Lumean TTS with per-phrase timing (STAGE 06 groundwork) ----
  // Verified live against the real API this session: POST /orders with
  // input_text (NOT task_data) + X-API-KEY header (NOT Authorization: Bearer)
  // returns, once completed, service_files including subtitles.srt with one
  // cue PER SENTENCE — which lines up exactly with our one-scriptLine-per-
  // scene structure, so real per-scene durations fall out of it directly.
  async function lumeanFetch(path: string, init?: any) {
    const res = await fetch(`${LUMEAN_BASE}${path}`, {
      ...init,
      headers: { 'X-API-KEY': lumeanApiKey, 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers || {}) },
    });
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json?.message || json?.errors ? JSON.stringify(json.errors || json.message) : `Lumean HTTP ${res.status}`);
    }
    return json.data;
  }

  interface VoiceSettingsInput {
    stability?: number;
    similarity_boost?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  }
  async function getOrCreateLumeanTemplate(
    voiceId: string,
    langCode: string,
    settings?: VoiceSettingsInput,
  ): Promise<string> {
    const s = {
      stability: settings?.stability ?? 0.5,
      similarity_boost: settings?.similarity_boost ?? 0.75,
      use_speaker_boost: settings?.use_speaker_boost ?? true,
      speed: settings?.speed ?? 1.0,
    };
    // Include settings in the cache key so different voice tunings don't share
    // one template (which would silently reuse the first tuning's values).
    const cacheKey = `${voiceId}:${langCode}:${s.stability}:${s.similarity_boost}:${s.use_speaker_boost ? 1 : 0}:${s.speed}`;
    if (lumeanTemplateCache.has(cacheKey)) return lumeanTemplateCache.get(cacheKey)!;
    const data = await lumeanFetch('/templates', {
      method: 'POST',
      body: JSON.stringify({
        service_key: 'elevenlabs',
        name: `goldflow_${voiceId}_${langCode}_${Date.now()}`,
        config: {
          tts_settings: {
            mode: 'mode_v1',
            model_id: 'eleven_multilingual_v2',
            voice_id: voiceId,
            language_code: langCode,
            advanced_voice_settings: true,
            voice_settings: s,
          },
        },
      }),
    });
    lumeanTemplateCache.set(cacheKey, data.id);
    return data.id;
  }

  // Server-side cache of the ElevenLabs voice library so we don't hit the API
  // on every panel open. 5-minute TTL is plenty for the "browse voices" UI.
  let voiceLibraryCache: { at: number; voices: any[] } | null = null;
  async function fetchVoiceLibrary(): Promise<any[]> {
    if (voiceLibraryCache && Date.now() - voiceLibraryCache.at < 5 * 60 * 1000) {
      return voiceLibraryCache.voices;
    }
    const all: any[] = [];
    // Pull a few pages so search covers the whole library the account has.
    for (let page = 0; page < 5; page++) {
      try {
        const data = await lumeanFetch(`/voices/elevenlabs/library?page=${page}&page_size=100`);
        const voices = data?.voices || [];
        all.push(...voices);
        if (voices.length < 100) break;
      } catch {
        break;
      }
    }
    voiceLibraryCache = { at: Date.now(), voices: all };
    return all;
  }

  function parseSrt(srtText: string): { index: number; startSec: number; endSec: number; text: string }[] {
    const toSec = (t: string) => {
      const m = t.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
      if (!m) return 0;
      return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
    };
    const blocks = srtText.replace(/\r/g, '').trim().split(/\n\n+/);
    return blocks.map((block, i) => {
      const lines = block.split('\n');
      const timeLine = lines.find((l) => l.includes('-->')) || '';
      const [start, end] = timeLine.split('-->').map((s) => s.trim());
      const textLines = lines.slice(lines.indexOf(timeLine) + 1);
      return { index: i, startSec: toSec(start || '0:0:0,0'), endSec: toSec(end || '0:0:0,0'), text: textLines.join(' ').trim() };
    });
  }

  // Authoritative wall-clock length of the generated mp3 (including [pause]
  // silences), independent of Lumean's total_duration_ms (often null) and of
  // per-cue SRT sums (which exclude the gaps between cues). For a CBR file
  // duration = fileBytes * 8 / bitrate; the bitrate/samplerate come from the
  // first MPEG audio frame header. Returns ms, or 0 if it can't be determined.
  function mp3DurationMsFromBuffer(buf: Buffer): number {
    const size = buf.length;
    // Find first frame sync (0xFFEx) past any ID3v2 tag.
    let off = 0;
    if (buf.slice(0, 3).toString('latin1') === 'ID3') {
      const tagSize = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
      off = 10 + tagSize;
    }
    const V1L3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    for (let i = off; i < Math.min(size - 4, off + 8192); i++) {
      if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
      const bIdx = (buf[i + 2] >> 4) & 0x0f;
      const sIdx = (buf[i + 2] >> 2) & 0x03;
      if (bIdx === 0 || bIdx === 15 || sIdx === 3) continue;
      const bitrate = V1L3_BITRATES[bIdx] * 1000;
      if (!bitrate) continue;
      return Math.round(((size - off) * 8) / bitrate * 1000);
    }
    return 0;
  }

  async function measureMp3DurationMs(url: string): Promise<number> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return 0;
      return mp3DurationMsFromBuffer(Buffer.from(await resp.arrayBuffer()));
    } catch {
      return 0;
    }
  }

  // Voice library browser + search. Server-side so the Lumean API key never
  // touches the client. Optional ?q= narrows by substring on name/accent/desc.
  app.get('/api/lumean/voices', async (req, res) => {
    try {
      if (!lumeanApiKey) return res.status(503).json({ error: 'LUMEAN_API_KEY не настроен в окружении' });
      const q = String(req.query.q || '').trim().toLowerCase();
      const voices = await fetchVoiceLibrary();
      const mapped = voices.map((v: any) => ({
        id: v.voice_id || v.id,
        name: v.name || v.display_name || '',
        category: v.category || '',
        gender: v.labels?.gender || v.gender || '',
        accent: v.labels?.accent || v.accent || '',
        age: v.labels?.age || '',
        description: v.description || v.labels?.description || v.use_case || '',
        previewUrl: v.preview_url || '',
        languages: (v.verified_languages || []).map((l: any) => l.language || l),
      }));
      const filtered = q
        ? mapped.filter((v: any) => (
            v.id.toLowerCase().includes(q)
            || v.name.toLowerCase().includes(q)
            || v.accent.toLowerCase().includes(q)
            || v.description.toLowerCase().includes(q)
            || v.gender.toLowerCase().includes(q)
          ))
        : mapped;
      res.json({ voices: filtered, total: mapped.length });
    } catch (err: any) {
      console.error('lumean/voices error:', err);
      res.status(500).json({ error: err?.message || 'Voices fetch failed' });
    }
  });

  // Single-voice lookup by ID (for pasted voice IDs). Hits the shared voice
  // (`/voices/elevenlabs/shared/:id`) endpoint when the library doesn't hold it.
  app.get('/api/lumean/voice/:id', async (req, res) => {
    try {
      if (!lumeanApiKey) return res.status(503).json({ error: 'LUMEAN_API_KEY не настроен в окружении' });
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Пустой voice_id' });
      const library = await fetchVoiceLibrary();
      const found = library.find((v: any) => (v.voice_id || v.id) === id);
      if (found) return res.json({ voice: found });
      // Not in cached library — try the direct shared-voice lookup so pasted
      // "hidden" voice IDs still resolve.
      try {
        const data = await lumeanFetch(`/voices/elevenlabs/shared/${encodeURIComponent(id)}`);
        return res.json({ voice: data });
      } catch (inner: any) {
        return res.status(404).json({ error: inner?.message || 'Голос не найден' });
      }
    } catch (err: any) {
      console.error('lumean/voice/:id error:', err);
      res.status(500).json({ error: err?.message || 'Voice lookup failed' });
    }
  });

  app.post('/api/synthesize-voice', async (req, res) => {
    try {
      const { text, voiceId, langCode, voiceSettings } = req.body || {};
      if (!lumeanApiKey) {
        return res.status(503).json({ error: 'LUMEAN_API_KEY не настроен в окружении' });
      }
      if (!text || !String(text).trim()) {
        return res.status(400).json({ error: 'Пустой текст для озвучки' });
      }

      const templateId = await getOrCreateLumeanTemplate(voiceId || '21m00Tcm4TlvDq8ikWAM', langCode || 'ru', voiceSettings);
      const order = await lumeanFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId, input_text: text }),
      });

      const orderId = order.id;
      let completed: any = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const polled = await lumeanFetch(`/orders/${orderId}`, { method: 'GET' });
        if (polled.status === 'completed') { completed = polled; break; }
        if (polled.status === 'failed') throw new Error('Lumean order failed');
      }
      if (!completed) throw new Error('Озвучка не завершилась за 2 минуты ожидания');

      const serviceFiles: string[] = completed.result?.service_files || [];
      const audioPath = completed.result?.files?.[0];
      const srtPath = serviceFiles.find((p) => p.endsWith('subtitles.srt'));
      const vttPath = serviceFiles.find((p) => p.endsWith('subtitles.vtt'));
      if (!audioPath) throw new Error('Lumean не вернул аудиофайл');

      const signUrl = async (p?: string) =>
        p ? (await lumeanFetch('/storage/url', { method: 'POST', body: JSON.stringify({ path: p }) })).url as string : undefined;

      const audioUrl = await signUrl(audioPath);
      const srtUrl = await signUrl(srtPath);
      const vttUrl = await signUrl(vttPath);

      let cues: { index: number; startSec: number; endSec: number; text: string }[] = [];
      let srtText: string | undefined;
      if (srtUrl) {
        srtText = await (await fetch(srtUrl)).text();
        cues = parseSrt(srtText);
      }

      // Prefer Lumean's own number when present; otherwise measure the real
      // wall-clock length from the mp3 so the client can match the video to it.
      const measuredMs = completed.total_duration_ms || (await measureMp3DurationMs(audioUrl!));

      res.json({
        audioUrl,
        durationMs: measuredMs || null,
        cues,
        srtUrl,
        vttUrl,
        srtText,
      });
    } catch (err: any) {
      console.error('synthesize-voice error:', err);
      res.status(500).json({ error: err?.message || 'Voice synthesis failed' });
    }
  });

  // Transcribe a user-uploaded voiceover into verbatim text via Gemini, and
  // measure the clip's real wall-clock length. The transcript then feeds the
  // same custom-script pipeline (blocks/hero/nineFields), and the measured
  // duration drives shot timing/splitting exactly like synthesized audio.
  app.post('/api/transcribe-voice', async (req, res) => {
    try {
      const { audioBase64, mimeType, language } = req.body || {};
      if (!apiKey) {
        return res.status(503).json({ error: 'GEMINI_API_KEY не настроен в окружении' });
      }
      if (!audioBase64 || !String(audioBase64).trim()) {
        return res.status(400).json({ error: 'Пустой аудиофайл' });
      }
      const rawBase64 = String(audioBase64).replace(/^data:[^;]+;base64,/, '');
      const langName = language === 'en' ? 'английском' : 'русском';

      const result: any = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [{
          role: 'user',
          parts: [
            { text: `Точно и дословно расшифруй речь из этого аудио в текст на ${langName} языке. Верни ТОЛЬКО сам текст расшифровки, без комментариев, без таймкодов, без ярлыков диктора. Сохрани естественную пунктуацию и деление на предложения.` },
            { inlineData: { mimeType: mimeType || 'audio/mpeg', data: rawBase64 } },
          ],
        }],
      });

      const text = (result.text || '').trim();
      if (!text) {
        return res.status(502).json({ error: 'Модель не вернула расшифровку' });
      }

      let durationMs = 0;
      try {
        const buf = Buffer.from(rawBase64, 'base64');
        durationMs = mp3DurationMsFromBuffer(buf);
      } catch { /* non-fatal — client measures the clip too */ }

      res.json({ text, durationMs: durationMs || null });
    } catch (err: any) {
      console.error('transcribe-voice error:', err);
      res.status(500).json({ error: err?.message || 'Transcription failed' });
    }
  });

  // STAGE 01-03: real LLM-generated architecture + script + storyboard (replaces hardcoded templates)
  app.post('/api/generate-script', async (req, res) => {
    try {
      const { mode, topicPrompt, scriptLines, heroOverride, language, targetDurationSeconds } = req.body || {};

      if (!apiKey) {
        return res.status(503).json({ error: 'GEMINI_API_KEY не настроен в окружении', isSimulated: true });
      }

      const langName = language === 'en' ? 'английском' : 'русском';
      const isCustom = mode === 'custom' && Array.isArray(scriptLines) && scriptLines.length > 0;

      // ~13.5 chars/sec is the same Russian speech pace used client-side in
      // estimateSpeechDuration() (autoAssembly.ts) — keep these in sync so the
      // requested video length actually matches the generated script's length.
      // A HARD block-count target (not "choose something reasonable") is what
      // actually makes duration selection produce a matching-length result —
      // scene count scaled loosely by the model alone drifted badly on tests.
      const CHARS_PER_SECOND = 13.5;
      let durationNote = '';
      if (!isCustom && targetDurationSeconds) {
        // ~4s/scene baseline (matches the UI's own "N сцен по 4 с" estimate) for
        // short videos; scales up per-scene length for long ones so a single
        // structured-output call still stays in a manageable block count (3-60).
        // Hard ceiling on block count: one structured-output call generating
        // more than ~25 detailed blocks (9 English nineFields each) got
        // unreliably slow/timed out in testing (5 min / 60 blocks did not
        // finish in 120s). Longer videos get longer per-block narration
        // instead of more blocks, to keep a single call fast and reliable.
        const idealBlocksAt4sPace = targetDurationSeconds / 4;
        const targetBlockCount = Math.max(3, Math.min(25, Math.round(idealBlocksAt4sPace)));
        const secondsPerScene = targetDurationSeconds / targetBlockCount;
        const charsPerBlock = Math.round(secondsPerScene * CHARS_PER_SECOND);
        durationNote = ` ТОЧНЫЙ ХРОНОМЕТРАЖ (обязательно соблюдай): напиши РОВНО ${targetBlockCount} блоков, каждый scriptLine — примерно ${charsPerBlock} символов (${secondsPerScene.toFixed(1)} сек озвучки на блок при ~${CHARS_PER_SECOND} символов/сек), чтобы суммарно весь ролик звучал ровно около ${targetDurationSeconds} секунд. Не отклоняйся от ${targetBlockCount} блоков — это жёсткое требование, не "примерно 6-8".`;
      }

      // nineFields/heroMaster appearance fields feed DIRECTLY into Nano Banana prompts —
      // image models perform far better on English prompts regardless of the video's
      // voiceover language, so those stay English even when scriptLine/title are Russian.
      const promptLangNote = `ВАЖНО про язык: title, objective, mandatoryEnd, pacing, scriptLine, heroMaster.name, heroMaster.role — на ${langName} языке (это текст для диктора и интерфейса). А вот nineFields (все 9 полей: lens, action, moment, foreground, location, background, texture, light, mood) и heroMaster.appearance/clothing/keyFeature/locationMaster — ВСЕГДА на английском языке, независимо от языка остального ответа, потому что это промпты для генерации картинок, а модели генерации изображений намного лучше понимают английский.`;

      const instructionText = isCustom
        ? `Ты — кинорежиссёр и художник по раскадровке. Тебе дан ГОТОВЫЙ дословный текст закадрового голоса, разбитый на ${scriptLines.length} пронумерованных строк.${topicPrompt ? ` Контекст ролика (только чтобы кадры были осмысленнее, не меняет текст): "${topicPrompt}".` : ''} Твоя задача НЕ переписывать текст — только два действия:\n1) Если строки НЕ на ${langName} языке — переведи КАЖДУЮ строку отдельно на ${langName}, сохрани ровно ${scriptLines.length} строк в том же порядке (не сливай и не разбивай строки при переводе), и положи результат в поле translatedLines. Если строки уже на ${langName} — скопируй их в translatedLines без изменений.\n2) Раздели все ${scriptLines.length} строк на кинематографические кадры (blocks): новый кадр начинается при смене места, времени или действующего лица; короткая реплика/подсказка остаётся в том кадре, который её открывает. Для каждого кадра укажи sourceLineIndices — список номеров строк (1-based, по возрастанию), которые входят в этот кадр. Каждая строка от 1 до ${scriptLines.length} должна попасть РОВНО в один блок, без пропусков и повторов, блоки идут по порядку строк.\nДля каждого блока также придумай: короткий заголовок (title), о чём этот кусок визуально (objective), обязательную концовку кадра (mandatoryEnd), темп (pacing), кинематографический промпт по 9 полям (nineFields) и тип движения камеры (motionType, одно из: ${MOTION_OPTIONS.join(', ')}). Также придумай единого главного героя истории (heroMaster) с именем ${heroOverride || '(придумай сам подходящее имя)'}, ролью, внешностью, одеждой, ключевой приметой внешности и мастер-локацией. ${promptLangNote}\n\nСтроки текста:\n${scriptLines.map((l: string, i: number) => `${i + 1}. ${l}`).join('\n')}`
        : `Ты — кинорежиссёр и сценарист короткого кинематографичного ролика. Придумай сюжет по теме: "${topicPrompt}". Раздели его на драматические блоки по классической архитектуре (экспозиция → завязка → нарастание напряжения → кульминация → развязка → финал) — количество блоков подбери сам под нужный хронометраж (см. ниже), без него ориентируйся на 6-8 блоков. Для каждого блока придумай: заголовок (title), о чём блок (objective), обязательную концовку (mandatoryEnd), темп (pacing), ОДНУ атмосферную кинематографичную фразу закадрового текста для этого блока без клише (scriptLine), кинематографический промпт по 9 полям (nineFields) и тип движения камеры (motionType, одно из: ${MOTION_OPTIONS.join(', ')}). Также придумай единого главного героя (heroMaster)${heroOverride ? ` по имени ${heroOverride}` : ''} с ролью, внешностью, одеждой, ключевой приметой внешности и мастер-локацией. ${promptLangNote}${durationNote}`;

      const schema = {
        type: 'object',
        properties: {
          heroMaster: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
              appearance: { type: 'string' },
              clothing: { type: 'string' },
              keyFeature: { type: 'string' },
              locationMaster: { type: 'string' },
            },
            required: ['name', 'role', 'appearance', 'clothing', 'keyFeature', 'locationMaster'],
          },
          ...(isCustom ? { translatedLines: { type: 'array', items: { type: 'string' } } } : {}),
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                objective: { type: 'string' },
                mandatoryEnd: { type: 'string' },
                pacing: { type: 'string' },
                scriptLine: { type: 'string' },
                nineFields: nineFieldsSchema,
                motionType: { type: 'string', enum: MOTION_OPTIONS },
                ...(isCustom ? { sourceLineIndices: { type: 'array', items: { type: 'integer' } } } : {}),
              },
              required: isCustom
                ? ['title', 'objective', 'mandatoryEnd', 'pacing', 'nineFields', 'motionType', 'sourceLineIndices']
                : ['title', 'objective', 'mandatoryEnd', 'pacing', 'nineFields', 'motionType'],
            },
          },
        },
        required: isCustom ? ['heroMaster', 'translatedLines', 'blocks'] : ['heroMaster', 'blocks'],
      };

      const result: any = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: instructionText }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema as any },
      });

      const parsed = JSON.parse(result.text || '{}');

      // Never trust the model to preserve exact wording — reconstruct every
      // block's scriptLine verbatim from the (possibly translated) source
      // lines using the model's own grouping, never from what it wrote.
      if (isCustom) {
        const N = scriptLines.length;
        const translated: string[] =
          Array.isArray(parsed.translatedLines) && parsed.translatedLines.length === N
            ? parsed.translatedLines
            : scriptLines;

        const claimed = new Array(N + 1).fill(false); // 1-indexed
        const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
        const reconciled: any[] = [];

        for (const b of rawBlocks) {
          const indices: number[] = Array.isArray(b.sourceLineIndices)
            ? ([...new Set<number>(b.sourceLineIndices)] as number[])
                .filter((n) => Number.isInteger(n) && n >= 1 && n <= N && !claimed[n])
                .sort((a, c) => a - c)
            : [];
          if (indices.length === 0) continue; // model produced an empty/invalid group — drop it
          indices.forEach((n) => { claimed[n] = true; });
          reconciled.push({
            ...b,
            scriptLine: indices.map((n) => translated[n - 1]).join(' '),
            sourceLineIndices: indices, // authoritative mapping for timecode-driven timing
          });
        }

        // Any line the model failed to assign still has to reach the video —
        // attach it to the nearest reconciled block instead of dropping it.
        const missing = Array.from({ length: N }, (_, i) => i + 1).filter((n) => !claimed[n]);
        if (missing.length > 0) {
          if (reconciled.length === 0) {
            reconciled.push({
              title: 'Кадр',
              objective: 'Визуальный ряд под текст',
              mandatoryEnd: '',
              pacing: 'medium',
              nineFields: rawBlocks[0]?.nineFields,
              motionType: rawBlocks[0]?.motionType || 'static',
              scriptLine: missing.map((n) => translated[n - 1]).join(' '),
              sourceLineIndices: missing,
            });
          } else {
            const last = reconciled[reconciled.length - 1];
            last.scriptLine = `${last.scriptLine} ${missing.map((n) => translated[n - 1]).join(' ')}`.trim();
            last.sourceLineIndices = [...(last.sourceLineIndices || []), ...missing].sort((a: number, c: number) => a - c);
          }
        }

        parsed.blocks = reconciled;
      }

      res.json({ ...parsed, isSimulated: false });
    } catch (err: any) {
      console.error('generate-script error:', err);
      res.status(500).json({ error: err?.message || 'Script generation failed' });
    }
  });

  // ---- Flow bridge status/login endpoints ----
  app.get('/api/flow/status', async (_req, res) => {
    const status = await flowBridge.getFlowStatus();
    res.json(status);
  });

  app.post('/api/flow/login', async (_req, res) => {
    try {
      const result = await flowBridge.openLoginWindow();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || 'Не удалось открыть окно входа Flow' });
    }
  });

  // Micro-beats: given one script block that runs long enough to hold N shots,
  // ask the director AI to break its VISUAL beat into N distinct micro-scenes
  // — each with its own nineFields (different action/moment/foreground, but
  // sharing location/light/texture so they read as the same setting). This is
  // the real fix for "12 identical copies of one scene with fake camera-angle
  // syntax": each of the N sub-shots now shows a different visual moment of
  // the same narrated block, matching what a real edit would cut to.
  app.post('/api/generate-microbeats', async (req, res) => {
    try {
      const { scriptLine, blockNineFields, heroMaster, subshotCount, language } = req.body || {};
      if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY не настроен в окружении' });
      const n = Math.max(2, Math.min(12, Number(subshotCount) || 2));
      if (!scriptLine || !blockNineFields) return res.status(400).json({ error: 'Нужны scriptLine и blockNineFields' });

      const heroLine = heroMaster
        ? `Character: ${heroMaster.name}, ${heroMaster.appearance || ''}, wearing ${heroMaster.clothing || ''}, key feature: ${heroMaster.keyFeature || ''}.`
        : '';
      const langName = language === 'en' ? 'английском' : 'русском';

      const instruction = `Ты — режиссёр монтажа. Дана одна кинематографическая сцена и её базовые 9 полей режиссёра. Она звучит ${n}×~4 сек в озвучке, поэтому нужно ${n} отдельных кинокадров, показывающих РАЗНЫЕ ВИЗУАЛЬНЫЕ МОМЕНТЫ этой же сцены (что делает герой в начале, в середине, к концу; на что смотрит; куда движется; какая деталь бросается в глаза). Все ${n} кадров сохраняют ту же location, light и texture (это одна локация), но action, moment, foreground, lens и background меняются от кадра к кадру, чтобы это читалось как настоящий монтаж, а не ${n} копий одного плана. Никаких табличек, вывесок, часов и цифр в кадре — это документальный кинокадр. ${heroLine}\n\nБазовые 9 полей блока (используй их как якорь для location/light/texture):\nlens: ${blockNineFields.lens}\naction: ${blockNineFields.action}\nmoment: ${blockNineFields.moment}\nforeground: ${blockNineFields.foreground}\nlocation: ${blockNineFields.location}\nbackground: ${blockNineFields.background}\ntexture: ${blockNineFields.texture}\nlight: ${blockNineFields.light}\nmood: ${blockNineFields.mood}\n\nТекст сцены (для контекста, не менять): "${scriptLine}"\n\nВерни массив из РОВНО ${n} объектов nineFields на английском языке (все 9 полей ОБЯЗАТЕЛЬНЫ, поле lens и action должны реально отличаться между кадрами). Заголовки ${langName} не нужны — только nineFields.`;

      const schema = {
        type: 'object',
        properties: { beats: { type: 'array', items: nineFieldsSchema } },
        required: ['beats'],
      };

      const result: any = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema as any },
      });
      const parsed = JSON.parse(result.text || '{}');
      const beats = Array.isArray(parsed.beats) ? parsed.beats.slice(0, n) : [];
      if (beats.length === 0) return res.status(502).json({ error: 'Модель не вернула микро-биты' });
      res.json({ beats });
    } catch (err: any) {
      console.error('generate-microbeats error:', err);
      res.status(500).json({ error: err?.message || 'Micro-beats failed' });
    }
  });

  // "Разобрать сценарий": real extraction of recurring characters/locations
  // from the script text, replacing what was a setTimeout+fake-toast no-op.
  app.post('/api/parse-scene-elements', async (req, res) => {
    try {
      const { scriptText } = req.body || {};
      if (!apiKey) {
        return res.status(503).json({ error: 'GEMINI_API_KEY не настроен в окружении' });
      }
      if (!scriptText || !String(scriptText).trim()) {
        return res.status(400).json({ error: 'Сценарий пуст — нечего разбирать' });
      }

      const instructionText = `Прочитай сценарий и найди ПОВТОРЯЮЩИХСЯ (упомянутых больше одного раза или явно значимых) персонажей и локации. Не выдумывай лишнего — только то, что реально есть в тексте. Для каждого персонажа: имя (name), короткая роль (role, на русском), английское описание внешности для image-промпта (prompt). Для каждой локации: название (name), тип места (type, на русском), английское описание для image-промпта (prompt). Если персонажей или локаций нет вообще (текст слишком короткий/абстрактный) — верни пустые массивы, не выдумывай.\n\nСценарий:\n${scriptText}`;

      const schema = {
        type: 'object',
        properties: {
          characters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                prompt: { type: 'string' },
              },
              required: ['name', 'role', 'prompt'],
            },
          },
          locations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                prompt: { type: 'string' },
              },
              required: ['name', 'type', 'prompt'],
            },
          },
        },
        required: ['characters', 'locations'],
      };

      const result: any = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: instructionText }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema as any },
      });

      const parsed = JSON.parse(result.text || '{"characters":[],"locations":[]}');
      res.json(parsed);
    } catch (err: any) {
      console.error('parse-scene-elements error:', err);
      res.status(500).json({ error: err?.message || 'Parsing failed' });
    }
  });

  // STAGE 04/05: image generation via Gemini API (Nano Banana). Falls
  // back to isSimulated (canvas placeholder) if no API key is configured.
  app.post('/api/generate-image', async (req, res) => {
    const {
      prompt, modelCode, aspectRatio,
      // legacy singular field, kept for goldflowPipeline.ts's hero-chaining calls
      referenceImageBase64, referenceMime,
      // explicit two-category references: style (rendering technique only) vs
      // hero (character/appearance consistency) — mixing these under one
      // instruction broke both (style instruction told the model to ignore
      // hero content too, defeating consistency).
      heroReferenceImage, styleReferenceImages,
      // flat, order-sensitive references for the standalone Image Studio —
      // no hero/style split there, just "take style+characters+objects from
      // these, in this order" like Whisk's reference picker.
      referenceImages,
      // named per-character/per-location reference photos the user attached
      // manually in "Персонажи и локации" — each is pinned to a name so the
      // model knows exactly which image is which entity, Whisk-style.
      castReferences,
    } = req.body || {};

    const heroRef: { base64: string; mimeType: string } | undefined =
      heroReferenceImage || (referenceImageBase64 ? { base64: referenceImageBase64, mimeType: referenceMime || 'image/png' } : undefined);
    const styleRefs: { base64: string; mimeType: string }[] = Array.isArray(styleReferenceImages) ? styleReferenceImages : [];
    const flatRefs: { base64: string; mimeType: string }[] = Array.isArray(referenceImages) ? referenceImages : [];
    const castRefs: { name: string; base64: string; mimeType?: string }[] = Array.isArray(castReferences)
      ? castReferences.filter((c: any) => c?.base64 && c?.name)
      : [];

    // Flow-bridge-first attempt was removed here: the Flow recaptcha-risk wall
    // (see CLAUDE.md) means it never succeeds anyway, and a stale/closed Flow
    // Chrome window made getFlowStatus() hang ~30s on EVERY single image call
    // — that hang, not the model choice, was why generation looked slow.
    // Go straight to Gemini API.

    // Fall back to Gemini API (Nano Banana)
    try {
      if (!apiKey) {
        return res.json({ isSimulated: true, message: 'Flow не залогинен и GEMINI_API_KEY не настроен — используется заглушка' });
      }

      const model = IMAGE_MODEL_MAP[modelCode as string] || 'gemini-2.5-flash-image';

      // Explicit, separate instructions per reference category — without this,
      // the model treats reference images as loose inspiration and often
      // ignores the actual rendering technique (e.g. a 2D-style reference
      // still came out photorealistic/cinematic in testing without it).
      const instructions: string[] = [];
      if (heroRef) {
        instructions.push('The FIRST reference image shows the main character/hero — keep their face, appearance and identity strictly consistent with it in this new scene.');
      }
      if (styleRefs.length) {
        instructions.push(`The ${heroRef ? 'remaining' : 'attached'} reference image(s) define the VISUAL STYLE to render in (rendering technique, color palette, line quality — e.g. flat 2D, painterly, photoreal, anime, whatever they show) — match that style precisely, do NOT copy their specific subject/content.`);
      }
      if (flatRefs.length) {
        instructions.push(`The ${flatRefs.length} attached reference image(s), numbered 1 to ${flatRefs.length} in the order given, provide style, characters and objects to reuse in this new scene — draw on them as the scene description directs, earlier-numbered references take priority when they conflict.`);
      }
      if (castRefs.length) {
        instructions.push(`Each reference image directly below is labeled with a name in the text right before it — that image is the EXACT visual identity for that character or location. Whenever the scene mentions that name, reproduce that specific person's face/appearance or that specific place exactly as shown, not a generic interpretation.`);
      }
      const promptText = instructions.length ? `${instructions.join(' ')} Scene to render: ${prompt}` : prompt;

      const parts: any[] = [{ text: promptText }];
      for (const ref of [...(heroRef ? [heroRef] : []), ...styleRefs, ...flatRefs]) {
        parts.push({
          inlineData: {
            mimeType: ref.mimeType || 'image/png',
            data: String(ref.base64).replace(/^data:image\/\w+;base64,/, ''),
          },
        });
      }
      for (const cast of castRefs) {
        parts.push({ text: `Reference for "${cast.name}":` });
        parts.push({
          inlineData: {
            mimeType: cast.mimeType || 'image/png',
            data: String(cast.base64).replace(/^data:image\/\w+;base64,/, ''),
          },
        });
      }

      const result: any = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || '16:9',
            imageSize: IMAGE_SIZE_MAP[modelCode as string] || '1K',
          },
        } as any,
      });

      const imagePart = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (!imagePart?.inlineData?.data) {
        return res.status(502).json({ error: 'Модель не вернула изображение', isSimulated: false });
      }

      res.json({
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
        isSimulated: false,
        engine: 'gemini',
      });
    } catch (err: any) {
      console.error('generate-image error:', err);
      res.status(500).json({ error: err?.message || 'Image generation failed' });
    }
  });

  // Serve Frontend
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Veo 3 Server] Ready on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
