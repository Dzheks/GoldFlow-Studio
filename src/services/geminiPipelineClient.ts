/**
 * Client for the real Gemini-backed Content Factory pipeline (server.ts).
 * Replaces the hardcoded template generator and canvas placeholder images
 * with actual LLM script generation and Nano Banana image generation.
 */

export interface NineFieldsResult {
  lens: string;
  action: string;
  moment: string;
  foreground: string;
  location: string;
  background: string;
  texture: string;
  light: string;
  mood: string;
}

export interface GeneratedBlock {
  title: string;
  objective: string;
  mandatoryEnd: string;
  pacing: string;
  scriptLine: string;
  nineFields: NineFieldsResult;
  motionType: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
  // 1-based indices of the source lines this block covers (custom/upload mode).
  sourceLineIndices?: number[];
}

export interface GeneratedHero {
  name: string;
  role: string;
  appearance: string;
  clothing: string;
  keyFeature: string;
  locationMaster: string;
}

export interface GenerateScriptResponse {
  heroMaster?: GeneratedHero;
  blocks?: GeneratedBlock[];
  isSimulated?: boolean;
  error?: string;
}

export async function generateScriptReal(payload: {
  mode: 'auto' | 'custom';
  topicPrompt?: string;
  scriptLines?: string[];
  heroOverride?: string;
  language?: string;
  targetDurationSeconds?: number;
}): Promise<GenerateScriptResponse> {
  try {
    const res = await fetch('/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { isSimulated: true, error: data?.error || 'Ошибка генерации сценария' };
    }
    return data;
  } catch (err: any) {
    return { isSimulated: true, error: err?.message || 'Сервер недоступен' };
  }
}

export interface GenerateImageResult {
  imageBase64?: string;
  mimeType?: string;
  isSimulated: boolean;
  error?: string;
}

export async function generateImageReal(payload: {
  prompt: string;
  modelCode: string;
  aspectRatio: string;
  referenceImageBase64?: string;
  referenceMime?: string;
  heroReferenceImage?: { base64: string; mimeType: string };
  styleReferenceImages?: { base64: string; mimeType: string }[];
  referenceImages?: { base64: string; mimeType: string }[];
  castReferences?: { name: string; base64: string; mimeType: string }[];
}): Promise<GenerateImageResult> {
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { isSimulated: true, error: data?.error || 'Ошибка генерации изображения' };
    }
    return data;
  } catch (err: any) {
    return { isSimulated: true, error: err?.message || 'Сервер недоступен' };
  }
}

export interface ParsedSceneElements {
  characters: { name: string; role: string; prompt: string }[];
  locations: { name: string; type: string; prompt: string }[];
  error?: string;
}

export async function parseSceneElementsReal(scriptText: string): Promise<ParsedSceneElements> {
  try {
    const res = await fetch('/api/parse-scene-elements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptText }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { characters: [], locations: [], error: data?.error || 'Ошибка разбора сценария' };
    }
    return data;
  } catch (err: any) {
    return { characters: [], locations: [], error: err?.message || 'Сервер недоступен' };
  }
}

export interface SynthesizeVoiceResult {
  audioUrl?: string;
  durationMs?: number | null;
  cues?: { index: number; startSec: number; endSec: number; text: string }[];
  srtUrl?: string;
  vttUrl?: string;
  srtText?: string;
  error?: string;
}

export async function synthesizeVoiceReal(payload: {
  text: string;
  voiceId?: string;
  langCode?: string;
}): Promise<SynthesizeVoiceResult> {
  try {
    const res = await fetch('/api/synthesize-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || 'Ошибка озвучки' };
    }
    return data;
  } catch (err: any) {
    return { error: err?.message || 'Сервер недоступен' };
  }
}

export interface TranscribeVoiceResult {
  text?: string;
  durationMs?: number | null;
  error?: string;
}

export async function transcribeVoiceReal(payload: {
  audioBase64: string;
  mimeType?: string;
  language?: string;
}): Promise<TranscribeVoiceResult> {
  try {
    const res = await fetch('/api/transcribe-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || 'Ошибка расшифровки' };
    }
    return data;
  } catch (err: any) {
    return { error: err?.message || 'Сервер недоступен' };
  }
}

export interface GenerateVideoStartResult {
  operationName?: string;
  model?: string;
  count?: number;
  error?: string;
}

export async function generateVideoReal(payload: {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  modelCode: string;
  count: number;
  firstFrame?: { base64: string; mimeType: string };
  lastFrame?: { base64: string; mimeType: string };
  referenceImages?: { base64: string; mimeType: string }[];
}): Promise<GenerateVideoStartResult> {
  try {
    const res = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || 'Не удалось запустить генерацию видео' };
    }
    return data;
  } catch (err: any) {
    return { error: err?.message || 'Сервер недоступен' };
  }
}

export interface VideoStatusResult {
  done?: boolean;
  count?: number;
  error?: any;
}

export async function pollVideoStatusReal(operationName: string): Promise<VideoStatusResult> {
  try {
    const res = await fetch('/api/video-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationName }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error || 'Ошибка проверки статуса' };
    }
    return data;
  } catch (err: any) {
    return { error: err?.message || 'Сервер недоступен' };
  }
}

export function getVideoStreamUrl(operationName: string, index: number): string {
  return `/api/video-stream?op=${encodeURIComponent(operationName)}&index=${index}`;
}

export function getVideoDownloadUrl(operationName: string, index: number): string {
  return `/api/video-download?op=${encodeURIComponent(operationName)}&index=${index}`;
}
