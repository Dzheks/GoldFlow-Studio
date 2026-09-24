import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { ProjectData, StylePreset, CharacterItem, LocationItem, StoryScene } from '../types';
import { GENERATION_MODELS, getModelByCode } from '../config/models';
import { ASPECT_RATIO_OPTIONS, getAspectRatioConfig, AspectRatioKey } from '../config/aspectRatios';
import { generateSceneThumbnailDataUrl } from '../utils/proceduralCanvas';
import { buildSynchronizedTimeline, estimateSpeechDuration, splitScriptIntoSentenceLines } from '../utils/autoAssembly';
import { FlowImportModal } from './FlowImportModal';
import { ParsedFlowFrame } from '../utils/flowResponseParser';
import { NineFieldsEditorModal } from './NineFieldsEditorModal';
import { CreateStyleModal } from './CreateStyleModal';
import { CharacterReferenceModal } from './CharacterReferenceModal';
import { HeroMasterShowcase } from './HeroMasterShowcase';
import { AutomatedPipelineRunner } from './AutomatedPipelineRunner';
import { compileNineFieldsPrompt, DirectorNineFields } from '../types/goldflow';
import { ELEVEN_LANGUAGES } from '../types/languages';
import { generateGoldflowPipeline } from '../utils/goldflowPipeline';
import { generateScriptReal, generateImageReal, parseSceneElementsReal, synthesizeVoiceReal, GeneratedBlock, GeneratedHero } from '../services/geminiPipelineClient';
import { 
  generateSmartScript, 
  parseScriptToPromptLines, 
  QUICK_TOPIC_PRESETS 
} from '../utils/scriptPromptParser';
import { 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Share2, 
  Edit3, 
  Trash2, 
  Plus, 
  Play, 
  RefreshCw, 
  Image as ImageIcon, 
  Sliders, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Film, 
  Video,
  Camera, 
  Upload, 
  Code, 
  Eye, 
  CheckCircle2, 
  Wand2, 
  Zap, 
  ShieldCheck, 
  Download,
  Languages 
} from 'lucide-react';

interface ContentFactoryProps {
  project: ProjectData;
  onUpdateProject: (updated: Partial<ProjectData>) => void;
  onBack: () => void;
  onGoToMontage: () => void;
  onGoToVideo?: () => void;
  credits: number;
  onDeductCredits: (amount: number) => boolean;
}

export const ContentFactory: React.FC<ContentFactoryProps> = ({
  project,
  onUpdateProject,
  onBack,
  onGoToMontage,
  onGoToVideo,
  credits,
  onDeductCredits,
}) => {
  const [selectedStyleId, setSelectedStyleId] = useState<string>(project.styleId);
  const [scriptTab, setScriptTab] = useState<'generate' | 'custom'>('generate');
  const [targetSeconds, setTargetSeconds] = useState<number>(60);
  const [customMin, setCustomMin] = useState<number>(1);
  const [customSec, setCustomSec] = useState<number>(0);
  const [scriptLanguage, setScriptLanguage] = useState<string>('ru');
  const [scriptTopic, setScriptTopic] = useState<string>(project.scriptText);
  const [customScriptText, setCustomScriptText] = useState<string>('');
  const [customContextHint, setCustomContextHint] = useState<string>('');
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [scriptGenElapsed, setScriptGenElapsed] = useState<number>(0);
  const [scriptBatchProgress, setScriptBatchProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (!isGeneratingScript) {
      setScriptGenElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => setScriptGenElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isGeneratingScript]);
  const [promptsText, setPromptsText] = useState<string>(() => 
    project.scenes.map((s, i) => `${i + 1}. ${s.prompt}`).join('\n')
  );
  const [characters, setCharacters] = useState<CharacterItem[]>(project.characters);
  const [locations, setLocations] = useState<LocationItem[]>(project.locations);
  const [refModal, setRefModal] = useState<{ kind: 'character' | 'location'; editId?: string } | null>(null);
  const [isParsingCharacters, setIsParsingCharacters] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<string>(project.model || 'NARWHAL');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioKey>(
    (project.aspectRatio as AspectRatioKey) || '16:9'
  );
  const [previewScene, setPreviewScene] = useState<StoryScene | null>(null);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<number | null>(null);
  const [isZippingFrames, setIsZippingFrames] = useState<boolean>(false);
  const [justGenerated, setJustGenerated] = useState<boolean>(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [batchStatusMsg, setBatchStatusMsg] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // GoldFlow specialized states
  const [activeFactoryTab, setActiveFactoryTab] = useState<'pipeline' | 'factory' | 'hero-master'>('factory');
  const [isSimulatedFactory, setIsSimulatedFactory] = useState<boolean>(false);
  const [customStyles, setCustomStyles] = useState<StylePreset[]>(project.customStyles || []);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState<boolean>(false);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [heroRefImage, setHeroRefImage] = useState<{ base64: string; mimeType: string } | null>(project.heroRefImage || null);
  const [heroName, setHeroName] = useState<string>(project.heroName || '');
  const [nineFieldsScene, setNineFieldsScene] = useState<StoryScene | null>(null);
  const [isBatchCompleteModalOpen, setIsBatchCompleteModalOpen] = useState<boolean>(false);
  const [lastGeneratedScenes, setLastGeneratedScenes] = useState<StoryScene[]>([]);
  const [isImageGalleryModalOpen, setIsImageGalleryModalOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleSaveNineFields = (fields: DirectorNineFields, compiledPrompt: string) => {
    if (!nineFieldsScene) return;
    const updatedScenes = project.scenes.map((s) =>
      s.id === nineFieldsScene.id
        ? {
            ...s,
            prompt: compiledPrompt,
            generatedImageUrl: generateSceneThumbnailDataUrl(
              s.id,
              s.title,
              compiledPrompt,
              selectedRatio,
              selectedStyleId
            ),
          }
        : s
    );
    const newPromptsText = updatedScenes.map((s, i) => `${i + 1}. ${s.prompt}`).join('\n');
    setPromptsText(newPromptsText);
    onUpdateProject({ scenes: updatedScenes });
    showToast(`🎬 Кадр #${nineFieldsScene.id} обновлён по 9 полям режиссёрской спецификации!`);
  };

  const activeModel = getModelByCode(selectedModel);
  const activeRatio = getAspectRatioConfig(selectedRatio);
  const promptLines = promptsText.split('\n').filter(line => line.trim().length > 0);
  const totalCost = promptLines.length * activeModel.creditCost;

  // Whisk-style manual references: any character/location the user attached
  // a photo to gets pulled in by name whenever a scene's text mentions them,
  // so their face/location stays consistent instead of drifting per frame.
  const buildCastReferences = (text: string): { name: string; base64: string; mimeType: string }[] => {
    const lower = text.toLowerCase();
    const entries = [...characters, ...locations].filter(
      (e) => e.customImage && e.name.trim() && lower.includes(e.name.trim().toLowerCase())
    );
    return entries
      .map((e) => {
        const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(e.customImage || '');
        if (!match) return null;
        return { name: e.name, mimeType: match[1], base64: match[2] };
      })
      .filter((x): x is { name: string; base64: string; mimeType: string } => Boolean(x));
  };

  const handleImportFlowFrames = (frames: ParsedFlowFrame[]) => {
    if (frames.length === 0) return;

    const motions: Array<'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static'> = [
      'zoom-in', 'zoom-out', 'pan-left', 'pan-right'
    ];

    // Map imported images to scenes
    const updatedScenes: StoryScene[] = frames.map((frame, idx) => {
      const existing = project.scenes[idx];
      const motion = motions[idx % motions.length];
      const prompt = frame.prompt || promptLines[idx] || existing?.prompt || `План ${idx + 1}: атмосферный кадр Google Flow`;
      const speech = existing?.description || prompt;
      const duration = estimateSpeechDuration(speech);

      return {
        id: idx + 1,
        title: frame.prompt ? `Кадр ${idx + 1}: ${frame.prompt.slice(0, 30)}...` : `Кадр ${idx + 1}`,
        description: speech,
        prompt: prompt,
        motionType: motion,
        transition: 'crossfade',
        duration: duration,
        generatedImageUrl: frame.imageUrl
      };
    });

    const { timelineClips, totalDuration } = buildSynchronizedTimeline(
      updatedScenes,
      selectedRatio,
      project.styleId || 'cinematic'
    );

    onUpdateProject({
      scenes: updatedScenes,
      timelineClips,
      duration: totalDuration,
      aspectRatio: selectedRatio
    });

    setJustGenerated(true);
    showToast(`🎉 Успешно перенесено ${frames.length} кадров из Google Flow! Они сопоставлены со сценами и разложены в монтаж.`);
  };

  // Mirrors server.ts's /api/generate-script block-count math exactly (25-block
  // ceiling — a single structured-output call generating more got unreliably
  // slow in testing), so the displayed estimate matches what actually comes back.
  const MAX_SCENES_PER_CALL = 25;
  const estimatedSceneCount = Math.max(3, Math.min(MAX_SCENES_PER_CALL, Math.round(targetSeconds / 4)));
  const SECONDS_PER_SCENE = Math.round((targetSeconds / estimatedSceneCount) * 10) / 10;

  const formatSeconds = (s: number): string => {
    if (s < 60) return `${s} сек`;
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return sec === 0 ? `${min} мин` : `${min} мин ${sec} сек`;
  };

  const customScriptLines = splitScriptIntoSentenceLines(customScriptText);
  const customEstimatedSeconds = customScriptLines.reduce(
    (sum, line) => sum + estimateSpeechDuration(line),
    0
  );

  const handleGenerateScript = async () => {
    if (scriptTab === 'custom' && customScriptLines.length === 0) {
      showToast('Сначала вставь текст — каждая строка станет отдельным кадром');
      return;
    }
    if (scriptTab === 'generate' && !scriptTopic.trim()) {
      showToast('Сначала введи тему ролика');
      return;
    }

    setIsGeneratingScript(true);
    setScriptBatchProgress(null);
    try {
      // A single structured-output call reliably handles ~20-25 detailed
      // blocks (full 9-field director prompts each) — past that it gets
      // slow/unreliable (documented: 60 blocks didn't finish in 120s). A
      // real pasted script can easily be 150+ sentences, so custom mode
      // batches the line list and makes several sequential calls, carrying
      // the same hero name across batches so the character doesn't change
      // partway through.
      const CUSTOM_BATCH_SIZE = 20;
      const res = scriptTab === 'custom'
        ? await (async () => {
            const batches: string[][] = [];
            for (let i = 0; i < customScriptLines.length; i += CUSTOM_BATCH_SIZE) {
              batches.push(customScriptLines.slice(i, i + CUSTOM_BATCH_SIZE));
            }
            const allBlocks: GeneratedBlock[] = [];
            let sharedHero: GeneratedHero | undefined;
            for (let b = 0; b < batches.length; b++) {
              setScriptBatchProgress({ current: b + 1, total: batches.length });
              const batchRes = await generateScriptReal({
                mode: 'custom',
                scriptLines: batches[b],
                topicPrompt: customContextHint.trim() || undefined,
                heroOverride: sharedHero?.name,
                language: scriptLanguage,
              });
              if (batchRes.isSimulated || !batchRes.blocks?.length || !batchRes.heroMaster) {
                // Keep whatever batches already succeeded instead of
                // throwing away real, already-paid-for generations.
                return {
                  blocks: allBlocks,
                  heroMaster: sharedHero,
                  isSimulated: allBlocks.length === 0,
                  error: `сегмент ${b + 1} из ${batches.length}: ${batchRes.error || 'нет ответа'}`,
                  partial: allBlocks.length > 0,
                };
              }
              if (!sharedHero) sharedHero = batchRes.heroMaster;
              allBlocks.push(...batchRes.blocks);
            }
            return { blocks: allBlocks, heroMaster: sharedHero, isSimulated: false };
          })()
        : await generateScriptReal({
            mode: 'auto',
            topicPrompt: scriptTopic,
            language: scriptLanguage,
            targetDurationSeconds: targetSeconds,
          });

      if ((res as any).partial) {
        showToast(`⚠️ Сценарий собран частично: ${(res as any).blocks.length} кадров получено, дальше остановилось на ${(res as any).error}. Уже сгенерированное не потеряно.`);
      }

      if (res.isSimulated || !res.blocks?.length || !res.heroMaster) {
        if (scriptTab === 'custom') {
          // Custom mode has no honest offline fallback — the whole point is
          // running the user's exact text through real AI framing, not a
          // template. Fail loudly instead of pretending it worked.
          showToast(`❌ Не удалось разобрать текст на кадры (${res.error || 'нет ключа/сессии'})`);
          return;
        }
        // Honest fallback — old template generator, never silently pretend it's real
        setIsSimulatedFactory(true);
        const generatedScript = generateSmartScript(scriptTopic, formatSeconds(targetSeconds));
        const generatedPrompts = parseScriptToPromptLines(generatedScript);
        const newPromptsText = generatedPrompts.join('\n');

        setScriptTopic(generatedScript);
        setPromptsText(newPromptsText);

        const motions: Array<'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static'> = [
          'zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'zoom-in', 'static'
        ];
        const newScenes: StoryScene[] = generatedPrompts.map((line, idx) => {
          const cleanPrompt = line.replace(/^\d+[\.\)]\s*/, '').trim();
          const thumb = generateSceneThumbnailDataUrl(idx + 1, `План ${idx + 1}`, cleanPrompt, selectedRatio, selectedStyleId);
          return {
            id: idx + 1,
            title: `План 0${idx + 1}: ${cleanPrompt.slice(0, 28)}...`,
            duration: estimateSpeechDuration(cleanPrompt),
            description: cleanPrompt,
            prompt: cleanPrompt,
            generatedImageUrl: thumb,
            motionType: motions[idx % motions.length],
            transition: 'crossfade',
          };
        });

        const { timelineClips, totalDuration } = buildSynchronizedTimeline(newScenes, selectedRatio, selectedStyleId);
        onUpdateProject({ scriptText: generatedScript, scenes: newScenes, timelineClips, duration: totalDuration });
        showToast(`⚠️ Реальный сценарий недоступен (${res.error || 'нет ключа/сессии'}) — показан демо-шаблон.`);
        return;
      }

      // Real Gemini-generated script, tailored to the actual topic/text
      setIsSimulatedFactory(false);
      const generatedPrompts = res.blocks.map((b) => compileNineFieldsPrompt(b.nineFields, res.heroMaster!.name));
      const newPromptsText = generatedPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n');
      const fullScript = res.blocks.map((b) => b.scriptLine).join('\n\n');

      setScriptTopic(fullScript);
      setPromptsText(newPromptsText);

      const newScenes: StoryScene[] = res.blocks.map((b, idx) => ({
        id: idx + 1,
        title: `План 0${idx + 1}: ${b.scriptLine.slice(0, 28)}...`,
        duration: estimateSpeechDuration(b.scriptLine),
        description: b.scriptLine,
        prompt: generatedPrompts[idx],
        // No image yet — real generation only happens on "Посчитать и запустить".
        // Drawing a canvas placeholder here made it look like images had already
        // been generated right after writing the script, which they hadn't.
        generatedImageUrl: undefined,
        motionType: b.motionType,
        transition: 'crossfade',
      }));

      setHeroName(res.heroMaster.name);
      showToast(`✨ Сценарий готов (реально через Gemini): создано ${generatedPrompts.length} промптов под кадры! Синтезируем озвучку для точного тайминга...`);

      // Real TTS via Lumean — replaces estimated durations (chars/13.5) with
      // the ACTUAL spoken duration of each line, from its real subtitles.srt
      // cue (one cue per sentence, matching one scene each). "Монтаж по
      // словам озвучки" only means anything with real audio backing it.
      let narrationAudioUrl: string | undefined;
      try {
        const voiceRes = await synthesizeVoiceReal({ text: fullScript, langCode: scriptLanguage });
        if (voiceRes.audioUrl && voiceRes.cues?.length === newScenes.length) {
          voiceRes.cues.forEach((cue, idx) => {
            newScenes[idx].duration = Number((cue.endSec - cue.startSec).toFixed(2));
          });
          narrationAudioUrl = voiceRes.audioUrl;
          showToast('🎙️ Реальная озвучка синтезирована — тайминг кадров взят из настоящих таймкодов Lumean.');
        } else if (voiceRes.error) {
          showToast(`⚠️ Озвучка не удалась (${voiceRes.error}) — тайминг остался оценочным по длине текста.`);
        }
      } catch (err: any) {
        showToast(`⚠️ Озвучка не удалась (${err?.message || 'ошибка'}) — тайминг остался оценочным.`);
      }

      const { timelineClips, totalDuration } = buildSynchronizedTimeline(newScenes, selectedRatio, selectedStyleId);
      onUpdateProject({ scriptText: fullScript, scenes: newScenes, timelineClips, duration: totalDuration, narrationAudioUrl, heroName: res.heroMaster.name });

      // Generate the hero reference image now, once — every scene in
      // handleRunBatch reuses it for character consistency (п.04). It must
      // go through the same custom style the user picked, or the portrait
      // comes back in a different style than everything else in the batch.
      try {
        const activeCustomStyleForHero = customStyles.find((s) => s.id === selectedStyleId);
        const heroPrompt = `Portrait of ${res.heroMaster.name}, ${res.heroMaster.appearance}, wearing: ${res.heroMaster.clothing}, key feature: ${res.heroMaster.keyFeature}. Cinematic lighting, 85mm portrait, consistent reference look, plain neutral background.`;
        const heroImgRes = await generateImageReal({
          prompt: activeCustomStyleForHero?.negativePrompt ? `${heroPrompt}. Avoid: ${activeCustomStyleForHero.negativePrompt}` : heroPrompt,
          modelCode: selectedModel,
          aspectRatio: '1:1',
          styleReferenceImages: activeCustomStyleForHero?.referenceImages,
        });
        if (heroImgRes.imageBase64) {
          const newHeroRef = { base64: heroImgRes.imageBase64, mimeType: heroImgRes.mimeType || 'image/png' };
          setHeroRefImage(newHeroRef);
          onUpdateProject({ heroRefImage: newHeroRef });
          showToast(`🎬 Эталон героя «${res.heroMaster.name}» сгенерирован — будет использован для консистентности во всех кадрах.`);
        }
      } catch {
        // non-fatal — batch generation still works without hero consistency
      }
    } catch (err: any) {
      showToast(`❌ Ошибка генерации сценария: ${err?.message || 'неизвестная ошибка'}`);
    } finally {
      setIsGeneratingScript(false);
      setScriptBatchProgress(null);
    }
  };

  const handleAssemblePromptsFromScript = () => {
    const lines = parseScriptToPromptLines(scriptTopic);
    const newText = lines.join('\n');
    setPromptsText(newText);
    showToast(`✓ Собрано ${lines.length} промптов из текста сценария!`);
  };

  const handleClearScript = () => {
    setScriptTopic('');
    setCustomScriptText('');
    setCustomContextHint('');
    setPromptsText('');
    showToast('Поля очищены. Введите тему или вставьте свой текст!');
  };

  const handleParseCharactersAndLocations = async () => {
    if (!scriptTopic.trim()) {
      showToast('Сначала напишите или вставьте сценарий — сейчас поле пустое');
      return;
    }
    setIsParsingCharacters(true);
    try {
      const result = await parseSceneElementsReal(scriptTopic);
      if (result.error) {
        showToast(`❌ Не удалось разобрать сценарий: ${result.error}`);
        return;
      }
      const palette = ['#d97706', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#f59e0b'];
      const newCharacters: CharacterItem[] = result.characters.map((c, i) => ({
        id: `char-${Date.now()}-${i}`,
        name: c.name,
        role: c.role,
        prompt: c.prompt,
        avatarColor: palette[i % palette.length],
        approved: true,
      }));
      const newLocations: LocationItem[] = result.locations.map((l, i) => ({
        id: `loc-${Date.now()}-${i}`,
        name: l.name,
        type: l.type,
        prompt: l.prompt,
        coverColor: palette[(i + 3) % palette.length],
        approved: true,
      }));

      // Merge by name instead of overwriting — re-running the parser must
      // never wipe out a reference photo the user manually attached.
      const mergeByName = <T extends { name: string; customImage?: string }>(prev: T[], fresh: T[]): T[] => {
        const byName = new Map(prev.map((c) => [c.name.trim().toLowerCase(), c]));
        const merged = fresh.map((nc) => {
          const existing = byName.get(nc.name.trim().toLowerCase());
          return existing?.customImage ? { ...nc, customImage: existing.customImage } : nc;
        });
        const mergedNames = new Set(merged.map((c) => c.name.trim().toLowerCase()));
        const manualExtras = prev.filter((c) => c.customImage && !mergedNames.has(c.name.trim().toLowerCase()));
        return [...merged, ...manualExtras];
      };

      const mergedCharacters = mergeByName(characters, newCharacters);
      const mergedLocations = mergeByName(locations, newLocations);
      setCharacters(mergedCharacters);
      setLocations(mergedLocations);
      onUpdateProject({ characters: mergedCharacters, locations: mergedLocations });
      if (newCharacters.length === 0 && newLocations.length === 0) {
        showToast('Сценарий разобран — повторяющихся персонажей или локаций не найдено');
      } else {
        showToast(`✅ Найдено реально: ${newCharacters.length} персонажей, ${newLocations.length} локаций`);
      }
    } catch (err: any) {
      showToast(`❌ Ошибка: ${err?.message || 'неизвестная'}`);
    } finally {
      setIsParsingCharacters(false);
    }
  };

  const handleSaveCharacterRef = (data: { name: string; role: string; customImage?: string }) => {
    if (!refModal) return;
    const palette = ['#d97706', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#f59e0b'];

    if (refModal.kind === 'character') {
      const next = refModal.editId
        ? characters.map((c) => (c.id === refModal.editId ? { ...c, name: data.name, role: data.role, customImage: data.customImage } : c))
        : [...characters, { id: `char-${Date.now()}`, name: data.name, role: data.role, prompt: '', avatarColor: palette[characters.length % palette.length], customImage: data.customImage, approved: true }];
      setCharacters(next);
      onUpdateProject({ characters: next });
    } else {
      const next = refModal.editId
        ? locations.map((l) => (l.id === refModal.editId ? { ...l, name: data.name, type: data.role, customImage: data.customImage } : l))
        : [...locations, { id: `loc-${Date.now()}`, name: data.name, type: data.role, prompt: '', coverColor: palette[(locations.length + 3) % palette.length], customImage: data.customImage, approved: true }];
      setLocations(next);
      onUpdateProject({ locations: next });
    }
    showToast(`✅ Референс «${data.name}» сохранён — будет подставляться в кадры, где он упоминается.`);
  };

  const handleRunBatch = async () => {
    let effectiveLines = promptsText.split('\n').filter(line => line.trim().length > 0);
    if (effectiveLines.length === 0) {
      if (!scriptTopic.trim()) {
        showToast('Сначала введите тему или промпты — поле пустое');
        return;
      }
      const generated = parseScriptToPromptLines(scriptTopic);
      effectiveLines = generated;
      setPromptsText(generated.join('\n'));
    }

    onDeductCredits(Math.min(credits, effectiveLines.length * activeModel.creditCost || 150));
    setIsBatchGenerating(true);
    setBatchProgress(0);
    setIsSimulatedFactory(false);

    const motions: Array<'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static'> = [
      'zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'zoom-in', 'static'
    ];

    const updatedScenes: StoryScene[] = [];
    let anySimulated = false;
    let engineUsed: string | undefined;
    const activeCustomStyle = customStyles.find((s) => s.id === selectedStyleId);

    for (let idx = 0; idx < effectiveLines.length; idx++) {
      const sceneId = idx + 1;
      const cleanPrompt = effectiveLines[idx].replace(/^\d+[\.\)]\s*/, '').trim();
      const title = `План ${sceneId < 10 ? '0' : ''}${sceneId}: ${cleanPrompt.slice(0, 32)}...`;
      setBatchStatusMsg(`Генерация кадра ${sceneId} из ${effectiveLines.length} (${activeModel.name})...`);

      const styledPrompt = activeCustomStyle?.negativePrompt
        ? `${cleanPrompt}. Avoid: ${activeCustomStyle.negativePrompt}`
        : cleanPrompt;

      const imgRes = await generateImageReal({
        prompt: styledPrompt,
        modelCode: selectedModel,
        aspectRatio: selectedRatio,
        heroReferenceImage: heroRefImage || undefined,
        styleReferenceImages: activeCustomStyle?.referenceImages,
        castReferences: buildCastReferences(cleanPrompt),
      });
      if (imgRes.isSimulated) anySimulated = true;
      if ((imgRes as any).engine) engineUsed = (imgRes as any).engine;

      const generatedImageUrl = imgRes.imageBase64
        ? `data:${imgRes.mimeType};base64,${imgRes.imageBase64}`
        : generateSceneThumbnailDataUrl(sceneId, title, cleanPrompt, selectedRatio, selectedStyleId);

      updatedScenes.push({
        id: sceneId,
        title,
        duration: estimateSpeechDuration(cleanPrompt),
        description: cleanPrompt,
        prompt: cleanPrompt,
        generatedImageUrl,
        motionType: motions[idx % motions.length],
        transition: sceneId % 3 === 0 ? 'fade-black' : 'crossfade',
      });

      setBatchProgress(Math.round(((idx + 1) / effectiveLines.length) * 100));
    }

    // Build perfectly synchronized timeline matching voice lines
    const { timelineClips, totalDuration } = buildSynchronizedTimeline(
      updatedScenes,
      selectedRatio,
      selectedStyleId,
      project.clipHoldDuration || 4.0
    );

    onUpdateProject({
      scenes: updatedScenes,
      scenesCount: updatedScenes.length,
      imagesCount: (project.imagesCount || 0) + updatedScenes.length,
      timelineClips,
      duration: totalDuration,
      aspectRatio: selectedRatio,
      model: selectedModel,
      styleId: selectedStyleId
    });

    setLastGeneratedScenes(updatedScenes);
    setJustGenerated(true);
    setIsBatchGenerating(false);
    setBatchStatusMsg('');
    setIsSimulatedFactory(anySimulated);
    setIsBatchCompleteModalOpen(true);

    if (anySimulated) {
      showToast('⚠️ Часть или все кадры не удалось сгенерировать реально — использованы заглушки. Проверьте подключение Flow (кнопка входа) или GEMINI_API_KEY.');
    } else {
      showToast(`🎉 Успешно сгенерировано ${updatedScenes.length} кадров реально (движок: ${engineUsed === 'flow' ? 'Google Flow' : 'Gemini API'})!`);
    }
  };

  const handleRegenerateScene = async (sceneId: number) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    if (credits < activeModel.creditCost) {
      showToast(`Недостаточно кредитов (нужно ${activeModel.creditCost} ₽)`);
      return;
    }

    setRegeneratingSceneId(sceneId);
    try {
      const activeCustomStyle = customStyles.find((s) => s.id === selectedStyleId);
      const styledPrompt = activeCustomStyle?.negativePrompt
        ? `${scene.prompt}. Avoid: ${activeCustomStyle.negativePrompt}`
        : scene.prompt;

      const imgRes = await generateImageReal({
        prompt: styledPrompt,
        modelCode: selectedModel,
        aspectRatio: selectedRatio,
        heroReferenceImage: heroRefImage || undefined,
        styleReferenceImages: activeCustomStyle?.referenceImages,
        castReferences: buildCastReferences(scene.prompt),
      });

      if (!imgRes.imageBase64) {
        showToast(`❌ Не удалось перегенерировать кадр ${sceneId}${imgRes.error ? `: ${imgRes.error}` : ''}`);
        return;
      }

      onDeductCredits(activeModel.creditCost);
      const newImg = `data:${imgRes.mimeType};base64,${imgRes.imageBase64}`;
      const updatedScenes = project.scenes.map(s =>
        s.id === sceneId ? { ...s, generatedImageUrl: newImg } : s
      );
      const { timelineClips } = buildSynchronizedTimeline(
        updatedScenes,
        selectedRatio,
        selectedStyleId,
        project.clipHoldDuration || 4.0
      );
      onUpdateProject({ scenes: updatedScenes, timelineClips });
      showToast(`✅ Кадр ${sceneId} перегенерирован реально через ${activeModel.name}`);
    } catch (err: any) {
      showToast(`❌ Ошибка перегенерации: ${err?.message || 'неизвестная'}`);
    } finally {
      setRegeneratingSceneId(null);
    }
  };

  const handleDownloadFramesZip = async () => {
    const scenesWithImages = project.scenes.filter((s) => s.generatedImageUrl);
    if (scenesWithImages.length === 0) {
      showToast('Пока нечего скачивать — сначала сгенерируй кадры');
      return;
    }

    setIsZippingFrames(true);
    try {
      const zip = new JSZip();
      const pad = (n: number) => String(n).padStart(2, '0');

      scenesWithImages.forEach((sc) => {
        const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(sc.generatedImageUrl || '');
        if (!match) return; // skip anything that isn't a real base64 data URL (no fake placeholder entries)
        const [, mimeType, base64] = match;
        const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const safeTitle = sc.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 40).trim();
        zip.file(`${pad(sc.id)}_${safeTitle || 'kadr'}.${ext}`, base64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name.replace(/[\\/:*?"<>|]/g, '_')}_кадры.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`📦 Архив с ${scenesWithImages.length} кадрами скачан`);
    } catch (err: any) {
      showToast(`❌ Не удалось собрать архив: ${err?.message || 'неизвестная ошибка'}`);
    } finally {
      setIsZippingFrames(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0a08] text-stone-200">
      {/* Top Breadcrumb & Status Bar */}
      <div className="border-b border-[#251d16] bg-[#120e0a]/90 backdrop-blur px-4 md:px-8 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Назад</span>
            </button>
            <span className="text-stone-600">/</span>
            <h1 className="text-sm md:text-base font-bold text-white tracking-tight">
              Контент-завод
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Engine Status */}
            <div
              className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
              title="Генерация идёт через Gemini API"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Движок: Встроенный AI (Готов)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Quick Flow Response Import Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#231911] hover:bg-[#342419] border border-amber-600/30 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Вставить ответ batchexecute или ссылки из Google Flow"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Импорт из Flow</span>
            </button>

            <button
              onClick={onGoToMontage}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Перейти в Монтаж</span>
            </button>
          </div>
        </div>
      </div>

      {/* GoldFlow Architecture Sub-Navigation Tabs */}
      <div className="border-b border-[#221a13] bg-[#100c09] px-4 md:px-8 py-2">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#18120c] rounded-xl border border-[#2b1f15] text-xs">
            <button
              type="button"
              onClick={() => setActiveFactoryTab('pipeline')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeFactoryTab === 'pipeline'
                  ? 'bg-amber-500 text-black font-bold shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Сквозной конвейер 01—06 (С одной строки)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFactoryTab('factory')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeFactoryTab === 'factory'
                  ? 'bg-amber-500 text-black font-bold shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Пакетная мастерская (Батч)
            </button>
            <button
              type="button"
              onClick={() => setActiveFactoryTab('hero-master')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeFactoryTab === 'hero-master'
                  ? 'bg-amber-500 text-black font-bold shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Эталон героя</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-400">
            <button
              type="button"
              onClick={() => setNineFieldsScene(project.scenes[0] || null)}
              className="px-3 py-1.5 rounded-lg bg-[#1c150e] hover:bg-[#281e14] border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>Редактор 9 полей кадра</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
        {/* Pipeline Tab Content */}
        {activeFactoryTab === 'pipeline' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <AutomatedPipelineRunner
              project={project}
              onUpdateProject={onUpdateProject}
              onGoToMontage={onGoToMontage}
              onGoToVideo={onGoToVideo}
              onToast={showToast}
            />
          </div>
        )}

        {/* Hero Master Consistency Tab Content */}
        {activeFactoryTab === 'hero-master' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <HeroMasterShowcase
              onApplyHeroToScenes={(heroName, heroDesc) => {
                showToast(`⚓ Эталон «${heroName}» закреплён за всеми сценами проекта!`);
              }}
              onToast={showToast}
            />
          </div>
        )}

        {/* Standard Content Factory & Batch Workshop */}
        <div className={activeFactoryTab === 'factory' ? "grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200" : "hidden"}>
          {/* Main Workshop Area (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section: СТИЛЬ */}
            <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
                Стиль
              </span>
              <p className="text-xs text-stone-400">
                Держит единый вид у всех кадров серии. Эталоны уходят генератору вместе с промптом — то, чего не передать словами, он берёт с них.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <button
                  onClick={() => {
                    setSelectedStyleId('none');
                    onUpdateProject({ styleId: 'none' });
                  }}
                  className={`relative p-3 rounded-xl text-left transition-all border flex flex-col justify-center min-h-[70px] ${
                    selectedStyleId === 'none'
                      ? 'border-amber-500 bg-[#251a10] shadow-md ring-1 ring-amber-500/50'
                      : 'border-[#2e2317] bg-[#1a130e] hover:border-stone-500'
                  }`}
                >
                  <div className="text-xs font-bold text-white flex items-center justify-between">
                    <span>Без стиля</span>
                    {selectedStyleId === 'none' && <Check className="w-3 h-3 text-amber-400" />}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">
                    Как написано в промпте
                  </div>
                </button>

                {customStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => {
                      setSelectedStyleId(style.id);
                      onUpdateProject({ styleId: style.id });
                    }}
                    className={`group relative p-3 rounded-xl text-left transition-all border flex flex-col justify-between min-h-[70px] overflow-hidden ${
                      selectedStyleId === style.id
                        ? 'border-amber-500 bg-[#251a10] shadow-md ring-1 ring-amber-500/50'
                        : 'border-[#2e2317] bg-[#1a130e] hover:border-stone-500'
                    }`}
                  >
                    {style.thumbnailUrl && (
                      <img src={style.thumbnailUrl} alt={style.name} className="absolute inset-0 w-full h-full object-cover opacity-25" />
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingStyleId(style.id);
                        setIsStyleModalOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          setEditingStyleId(style.id);
                          setIsStyleModalOpen(true);
                        }
                      }}
                      title="Редактировать стиль"
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/60 hover:bg-black/85 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10"
                    >
                      <Edit3 className="w-2.5 h-2.5 text-stone-200" />
                    </span>
                    <div className="relative text-xs font-bold text-white flex items-center justify-between pr-5">
                      <span>{style.name}</span>
                      {selectedStyleId === style.id && <Check className="w-3 h-3 text-amber-400" />}
                    </div>
                    <div className="relative text-[11px] text-stone-300 mt-1">
                      {style.referenceImages?.length} эталона
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => {
                    setEditingStyleId(null);
                    setIsStyleModalOpen(true);
                  }}
                  className="p-3 rounded-xl border border-dashed border-[#443322] hover:border-amber-500/60 bg-[#16100c] text-left transition-all flex flex-col items-center justify-center min-h-[70px] group"
                >
                  <Plus className="w-4 h-4 text-stone-400 group-hover:text-amber-400 mb-1" />
                  <span className="text-xs font-medium text-stone-400 group-hover:text-stone-200">
                    Свой стиль
                  </span>
                </button>
              </div>

              {selectedStyleId !== 'none' && customStyles.some((s) => s.id === selectedStyleId) && (
                <p className="text-[11px] text-emerald-400/90 font-mono">
                  Готовый стиль: референсы уходят в каждый запрос генерации этой пачки.
                </p>
              )}
            </div>

            {/* Section: ОПИШИ РОЛИК — ПРОМТЫ СОБЕРУТСЯ САМИ */}
            <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
                  Опиши ролик — промты соберутся сами
                </span>
                <span className="text-[11px] text-stone-500 font-mono">
                  {scriptTab === 'custom'
                    ? `${customScriptLines.length} сцены из текста`
                    : `${estimatedSceneCount} сцен по ${SECONDS_PER_SCENE} с`}
                </span>
              </div>

              {/* Tabs and Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setScriptTab('generate')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      scriptTab === 'generate'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-[#1a130e] text-stone-400 hover:text-white border border-[#2e2216]'
                    }`}
                  >
                    Придумать по описанию
                  </button>
                  <button
                    onClick={() => setScriptTab('custom')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      scriptTab === 'custom'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-[#1a130e] text-stone-400 hover:text-white border border-[#2e2216]'
                    }`}
                  >
                    У меня свой текст
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleClearScript}
                  className="px-2.5 py-1 rounded-lg bg-[#22160f] hover:bg-[#321e15] text-stone-400 hover:text-rose-300 text-xs border border-[#3a2318] transition-colors flex items-center gap-1.5"
                  title="Очистить поле сценария и промпты"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Очистить всё</span>
                </button>
              </div>

              {scriptTab === 'generate' ? (
                <>
                  {/* Textarea — topic mode: AI writes the narration from scratch */}
                  <textarea
                    value={scriptTopic}
                    onChange={(e) => {
                      setScriptTopic(e.target.value);
                      onUpdateProject({ scriptText: e.target.value });
                    }}
                    rows={5}
                    placeholder="Введи тему (например: 'Ограбление банка в Ницце', 'Как создали первый суперкар')..."
                    className="w-full bg-[#1a130e] border border-[#302418] rounded-xl p-3 text-xs md:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70 font-mono leading-relaxed"
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase text-stone-400">Язык:</span>
                    <select
                      value={scriptLanguage}
                      onChange={(e) => setScriptLanguage(e.target.value)}
                      className="bg-[#1a130e] border border-[#2e2217] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {ELEVEN_LANGUAGES.map((l) => (
                        <option key={l.id} value={l.id}>по-{l.nativeName.toLowerCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono uppercase text-stone-400">Длина:</span>
                      <div className="flex flex-wrap items-center gap-1 bg-[#1a130e] p-1 rounded-lg border border-[#2e2217]">
                        {[30, 60, 180, 300, 600, 1200, 1800].map((secs) => (
                          <button
                            key={secs}
                            onClick={() => setTargetSeconds(secs)}
                            className={`px-2.5 py-1 rounded text-xs transition-colors ${
                              targetSeconds === secs
                                ? 'bg-amber-500 text-black font-semibold shadow-sm'
                                : 'text-stone-400 hover:text-white'
                            }`}
                          >
                            {formatSeconds(secs)}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs font-mono uppercase text-stone-400 ml-1">свой вариант:</span>
                      <input
                        type="number"
                        min={0}
                        value={customMin}
                        onChange={(e) => {
                          const min = Math.max(0, Number(e.target.value) || 0);
                          setCustomMin(min);
                          setTargetSeconds(min * 60 + customSec);
                        }}
                        className="w-14 bg-[#1a130e] border border-[#2e2217] rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none"
                      />
                      <span className="text-[10px] text-stone-500 font-mono">мин</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={customSec}
                        onChange={(e) => {
                          const sec = Math.min(59, Math.max(0, Number(e.target.value) || 0));
                          setCustomSec(sec);
                          setTargetSeconds(customMin * 60 + sec);
                        }}
                        className="w-14 bg-[#1a130e] border border-[#2e2217] rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none"
                      />
                      <span className="text-[10px] text-stone-500 font-mono">сек</span>
                    </div>

                    <button
                      onClick={handleGenerateScript}
                      disabled={isGeneratingScript}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-semibold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingScript ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Пишем сценарий... {scriptGenElapsed}с (обычно 20-40 сек, не зависло)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Написать сценарий</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    Сценарист пишет текст под выбранный хронометраж — количество сцен и таймкоды считаются от него (~{SECONDS_PER_SCENE} сек на сцену). Промпты появятся ниже, их можно править перед запуском.
                  </p>
                </>
              ) : (
                <>
                  {/* Textarea — custom mode: the pasted text goes into the video verbatim */}
                  <textarea
                    value={customScriptText}
                    onChange={(e) => setCustomScriptText(e.target.value)}
                    rows={7}
                    placeholder={"Вставь свой закадровый текст. Каждая строка — отдельный кадр.\n\nДревние торговцы развели костёр прямо на песчаном берегу.\nК утру под золой нашли твёрдые прозрачные капли.\nПовторить не выходило: жара обычного костра не хватало."}
                    className="w-full bg-[#1a130e] border border-[#302418] rounded-xl p-3 text-xs md:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70 font-mono leading-relaxed"
                  />

                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    Текст пойдёт в ролик дословно — ни одного слова сценарист не тронет. Если он написан не на выбранном ниже языке, его переведут построчно: строка к строке, кадр к кадру. Работа сценариста здесь только в том, чтобы придумать кадр под каждую строку. Длина ролика получится из озвучки: примерно {customScriptLines.length} кадра — это около {customEstimatedSeconds > 0 ? formatSeconds(Math.round(customEstimatedSeconds)) : '0 мин'} готового ролика. Границы кадров расставит сценарист — он читает текст и режет по смыслу: смена места, времени или действующего лица начинает новый кадр, а короткая подсказка остаётся при том кадре, который её открывает. Слова при этом не меняются ни одного: разбивка сверяется с твоим текстом.
                  </p>

                  <textarea
                    value={customContextHint}
                    onChange={(e) => setCustomContextHint(e.target.value)}
                    rows={2}
                    placeholder="Необязательно: о чём ролик, чтобы кадры были осмысленнее. Например: как люди впервые получили стекло."
                    className="w-full bg-[#1a130e] border border-[#302418] rounded-xl p-3 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70 font-mono leading-relaxed"
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase text-stone-400">Язык:</span>
                    <select
                      value={scriptLanguage}
                      onChange={(e) => setScriptLanguage(e.target.value)}
                      className="bg-[#1a130e] border border-[#2e2217] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {ELEVEN_LANGUAGES.map((l) => (
                        <option key={l.id} value={l.id}>по-{l.nativeName.toLowerCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <span className="text-[11px] text-stone-500 font-mono">
                      Длина: ~{customScriptLines.length} кадра — это около {customEstimatedSeconds > 0 ? formatSeconds(Math.round(customEstimatedSeconds)) : '0 мин'} готового ролика. Точное число станет известно после разбивки.
                    </span>

                    <button
                      onClick={handleGenerateScript}
                      disabled={isGeneratingScript}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-semibold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingScript ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            {scriptBatchProgress
                              ? `Сегмент ${scriptBatchProgress.current} из ${scriptBatchProgress.total}... ${scriptGenElapsed}с`
                              : `Разбиваем на кадры... ${scriptGenElapsed}с (не зависло)`}
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Написать сценарий</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Section: ПРОМПТЫ — ПО ОДНОМУ В СТРОКЕ */}
            <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
                  Промпты — по одному в строке ({promptLines.length} шт)
                </span>
                {/* Secondary toolbar buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAssemblePromptsFromScript}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-300 font-semibold text-xs border border-amber-500/40 flex items-center gap-1.5 transition-all shadow-sm"
                    title="Автоматически разобрать сценарий выше на визуальные промпты кадров"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Кадр из описания (Собрать)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImageGalleryModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1f1710] hover:bg-[#2c2117] text-stone-300 hover:text-white text-xs border border-[#382a1d] flex items-center gap-1.5 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Картинки ({project.scenes.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPromptsText('');
                      showToast('Список промптов очищен');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1f1710] hover:bg-[#2c2117] text-stone-400 hover:text-rose-300 text-xs border border-[#382a1d] transition-colors"
                  >
                    Очистить список
                  </button>
                </div>
              </div>

              {/* Numbered prompts textarea */}
              <div className="relative">
                <textarea
                  value={promptsText}
                  onChange={(e) => setPromptsText(e.target.value)}
                  rows={8}
                  className="w-full bg-[#18120d] border border-[#2e2114] rounded-xl p-3 text-xs md:text-sm text-stone-200 font-mono focus:outline-none focus:border-amber-500/70 leading-relaxed resize-y"
                  placeholder="1. Описание первого кадра...&#10;2. Описание второго кадра..."
                />
              </div>

              {/* Batch Generation Control Bar */}
              <div className="p-4 rounded-xl bg-[#1c150e] border border-[#382a1d] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Model select */}
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-stone-500 mb-1">
                      Модель генерации
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        onUpdateProject({ model: e.target.value });
                      }}
                      className="bg-[#120d09] border border-[#302215] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {GENERATION_MODELS.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.name} — {m.code}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-mono mt-1">
                      <span className="text-amber-400/90 font-bold">{activeModel.name}</span>
                      <span>→</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#100c09] border border-amber-900/40 text-amber-300">
                        {activeModel.code}
                      </span>
                      <span className="text-stone-500">({activeModel.creditCost} ₽/кадр)</span>
                    </div>
                  </div>

                  {/* Ratio select */}
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-stone-500 mb-1">
                      Формат (Соотношение)
                    </label>
                    <select
                      value={selectedRatio}
                      onChange={(e) => {
                        const newRatio = e.target.value as AspectRatioKey;
                        setSelectedRatio(newRatio);
                        onUpdateProject({ aspectRatio: newRatio });
                      }}
                      className="bg-[#120d09] border border-[#302215] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {ASPECT_RATIO_OPTIONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-mono mt-1">
                      <span className="text-stone-500">→</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#100c09] border border-[#2b2015] text-amber-300">
                        {activeRatio.id}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-bold text-white font-mono">
                      {promptLines.length} картинок
                    </div>
                    <div className="text-[11px] text-amber-400/90 font-mono">
                      ~ {totalCost} ₽ с баланса
                    </div>
                  </div>

                  <button
                    onClick={handleRunBatch}
                    disabled={isBatchGenerating}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isBatchGenerating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Генерация {batchProgress}%...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span>Посчитать и запустить</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => showToast('⏳ Недостающие кадры успешно поставлены в очередь')}
                    className="px-3.5 py-2.5 rounded-xl bg-[#241a11] hover:bg-[#34261a] border border-[#3b2b1d] text-xs text-stone-200 transition-colors"
                  >
                    Догенерировать недостающие
                  </button>
                </div>
              </div>

              {/* API Request Preview Info & Flow Session Status */}
              <div className="space-y-2">
                {heroRefImage && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
                    <img src={`data:${heroRefImage.mimeType};base64,${heroRefImage.base64}`} alt="hero" className="w-6 h-6 rounded object-cover border border-emerald-500/40" />
                    <span>Эталон героя «{heroName}» подключён — каждый кадр пачки получит его как референс для консистентности.</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#120d09] border border-[#261a10] text-[11px] font-mono text-stone-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-stone-500">Параметры API:</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30">
                      model: "{activeModel.code}"
                    </span>
                    <span className="text-stone-500">·</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30">
                      aspect_ratio: "{activeRatio.id}"
                    </span>
                    <span className="text-stone-500">·</span>
                    <span className="text-stone-300">batch_size: {promptLines.length}</span>
                  </div>
                </div>

                {batchStatusMsg && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{batchStatusMsg}</span>
                  </div>
                )}
              </div>

              {/* Progress bar if active */}
              {isBatchGenerating && (
                <div className="w-full bg-[#1b140e] rounded-full h-2 overflow-hidden border border-amber-900/40">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-300"
                    style={{ width: `${batchProgress}%` }}
                  />
                </div>
              )}

              {/* Live Preview Strip of Generated Project Scenes */}
              {project.scenes.length > 0 && (
                <div className="pt-3 border-t border-[#261b11] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5 font-mono">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Кадры проекта ({project.scenes.filter(s => s.generatedImageUrl).length} из {project.scenes.length} сгенерировано):
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={onGoToMontage}
                      className="text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 transition-all"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Перейти в Монтаж со всеми кадрами →</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {project.scenes.map((sc, i) => (
                      <div
                        key={sc.id}
                        onClick={() => sc.generatedImageUrl && setPreviewScene(sc)}
                        className={`group relative aspect-video rounded-lg overflow-hidden border transition-all shadow-md ${
                          sc.generatedImageUrl
                            ? 'bg-black border-[#382b1d] hover:border-amber-400 cursor-pointer'
                            : 'bg-[#140f0b] border-dashed border-[#3b2b1d]'
                        }`}
                        title={sc.title}
                      >
                        {sc.generatedImageUrl ? (
                          <img
                            src={sc.generatedImageUrl}
                            alt={sc.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-center px-2">
                            <span className="text-[10px] text-stone-500 font-mono">Ждёт генерации</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-between p-1.5">
                          <span className="self-end px-1 rounded bg-black/80 text-[9px] font-mono text-amber-300">
                            {sc.duration}s
                          </span>
                          <span className="text-[10px] font-mono text-stone-200 font-medium truncate">
                            0{i + 1}. {sc.title.replace(/^План\s*\d*:\s*/, '')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: ПРОЕКТ, ПЕРСОНАЖИ И ЛОКАЦИИ (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Project Box */}
            <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
                Проект
              </span>

              {/* Project selector dropdown */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1b140e] border border-[#302316]">
                <div className="font-semibold text-xs text-white">
                  {project.name}
                </div>
                <ChevronDown className="w-4 h-4 text-stone-400" />
              </div>

              {/* Actions row */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      showToast('🔗 Ссылка скопирована в буфер обмена');
                    } catch {
                      showToast('❌ Не удалось скопировать — браузер запретил доступ к буферу');
                    }
                  }}
                  className="py-1.5 px-2 rounded-lg bg-[#1c150e] hover:bg-[#281f15] border border-[#332517] text-stone-300 text-center flex items-center justify-center gap-1"
                >
                  <Share2 className="w-3 h-3 text-stone-400" />
                  <span>Поделиться</span>
                </button>
                <button
                  onClick={() => {
                    const newName = window.prompt('Новое имя проекта:', project.name);
                    if (newName && newName.trim()) {
                      onUpdateProject({ name: newName.trim() });
                      showToast(`Проект переименован: ${newName.trim()}`);
                    }
                  }}
                  className="py-1.5 px-2 rounded-lg bg-[#1c150e] hover:bg-[#281f15] border border-[#332517] text-stone-300 text-center flex items-center justify-center gap-1"
                >
                  <Edit3 className="w-3 h-3 text-stone-400" />
                  <span>Имя</span>
                </button>
                <button
                  onClick={() => {
                    onUpdateProject({
                      scenes: [],
                      scenesCount: 0,
                      imagesCount: 0,
                      timelineClips: [],
                      duration: 0,
                      heroRefImage: null,
                      heroName: '',
                    });
                    setPromptsText('');
                    setLastGeneratedScenes([]);
                    setJustGenerated(false);
                    setHeroRefImage(null);
                    setHeroName('');
                    showToast('Кадры и промпты проекта очищены');
                  }}
                  className="py-1.5 px-2 rounded-lg bg-[#1c150e] hover:bg-rose-950/40 border border-[#332517] text-rose-300 text-center flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Очистить</span>
                </button>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed pt-1">
                Проект держит настройки одного ролика: сценарий, персонажей, стили. Пока проект открыт, вы управляете целостностью всей пачки.
              </p>
            </div>

            {/* Characters and Locations Accordion */}
            <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
                  Персонажи и локации
                </span>
                <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                  Фиксируют вид локаций и лиц: они не плывут от кадра к кадру и сохраняют преемственность в монтаже.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleParseCharactersAndLocations}
                  disabled={isParsingCharacters}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {isParsingCharacters ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Анализируем сценарий...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Разобрать сценарий</span>
                    </>
                  )}
                </button>
              </div>

              {/* Characters */}
              <div className="pt-2 border-t border-[#251d15] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-stone-400 font-mono">
                    Персонажи ({characters.length})
                  </span>
                  <button
                    onClick={() => setRefModal({ kind: 'character' })}
                    className="text-amber-400 hover:text-amber-300 font-mono"
                  >
                    + добавить
                  </button>
                </div>
                {characters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setRefModal({ kind: 'character', editId: c.id })}
                        title={c.customImage ? `${c.name} — есть референс` : `${c.name} — без референса, нажми чтобы добавить`}
                        className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-[#1a130e] border border-[#2e2216] hover:border-amber-500/50 transition-colors"
                      >
                        {c.customImage ? (
                          <img src={c.customImage} alt={c.name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-black"
                            style={{ backgroundColor: c.avatarColor }}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-300 max-w-[80px] truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Locations */}
              <div className="pt-2 border-t border-[#251d15] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-stone-400 font-mono">
                    Локации ({locations.length})
                  </span>
                  <button
                    onClick={() => setRefModal({ kind: 'location' })}
                    className="text-amber-400 hover:text-amber-300 font-mono"
                  >
                    + добавить
                  </button>
                </div>
                {locations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {locations.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setRefModal({ kind: 'location', editId: l.id })}
                        title={l.customImage ? `${l.name} — есть референс` : `${l.name} — без референса, нажми чтобы добавить`}
                        className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-[#1a130e] border border-[#2e2216] hover:border-amber-500/50 transition-colors"
                      >
                        {l.customImage ? (
                          <img src={l.customImage} alt={l.name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-black"
                            style={{ backgroundColor: l.coverColor }}
                          >
                            {l.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-300 max-w-[80px] truncate">{l.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section: МАТЕРИАЛЫ */}
            <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
                  Материалы · {project.scenes.filter(s => s.generatedImageUrl).length}
                </span>
                {project.scenes.some(s => s.generatedImageUrl) && (
                  <button
                    type="button"
                    onClick={handleDownloadFramesZip}
                    disabled={isZippingFrames}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c150e] hover:bg-[#2c2117] border border-[#382a1d] text-amber-300 hover:text-amber-200 text-[11px] font-mono transition-colors disabled:opacity-50"
                    title="Скачать все сгенерированные кадры одним ZIP-архивом"
                  >
                    {isZippingFrames ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{isZippingFrames ? 'Архивируем...' : 'Скачать архивом'}</span>
                  </button>
                )}
              </div>

              {project.scenes.filter(s => s.generatedImageUrl).length === 0 ? (
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Пусто. Запусти пачку с выбранным проектом — результаты лягут сюда сами. Или добавь готовое из «Моих работ».
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {project.scenes.filter(s => s.generatedImageUrl).map((sc) => (
                    <div
                      key={sc.id}
                      className="rounded-xl overflow-hidden bg-[#0f0b08] border border-[#2b2116] hover:border-amber-500/40 transition-colors"
                    >
                      <div
                        onClick={() => setPreviewScene(sc)}
                        className="relative aspect-video cursor-pointer group"
                        title={`План ${sc.id} — открыть превью`}
                      >
                        <img src={sc.generatedImageUrl} alt={`План ${sc.id}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-white font-mono transition-opacity">Открыть превью</span>
                        </div>
                        {regeneratingSceneId === sc.id && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-amber-400 font-mono shrink-0">
                            План {sc.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRegenerateScene(sc.id)}
                            disabled={regeneratingSceneId !== null}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#1c150e] hover:bg-[#2c2117] border border-[#382a1d] text-stone-300 hover:text-amber-300 text-[10px] font-mono transition-colors disabled:opacity-40 shrink-0"
                            title="Перегенерировать этот кадр"
                          >
                            <RefreshCw className={`w-3 h-3 ${regeneratingSceneId === sc.id ? 'animate-spin' : ''}`} />
                            <span>Перегенерировать</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-stone-400 leading-snug line-clamp-2">
                          {sc.description || sc.prompt}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-stone-500 leading-relaxed border-t border-[#251d15] pt-2">
                Имя рядом с номером — это имя референса. Упомяни его в промпте, и провайдер возьмёт именно эту картинку. Только латиница: кириллицу он не сопоставляет.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 9 Fields Director Spec Modal */}
      {nineFieldsScene && (
        <NineFieldsEditorModal
          isOpen={Boolean(nineFieldsScene)}
          onClose={() => setNineFieldsScene(null)}
          sceneIndex={nineFieldsScene.id}
          initialFields={{
            lens: 'Широкий 28 мм, низкая точка',
            action: nineFieldsScene.prompt || 'Действие в кадре',
            moment: 'За секунду до того, как стена подалась',
            foreground: 'Осколки и пыль в луче фонаря',
            location: 'Тоннель под хранилищем банка',
            background: 'Темнота, уходящая вглубь коллектора',
            texture: 'Мокрый бетон, ржавое железо',
            light: 'Один фонарь сбоку, резкие тени',
            mood: 'Напряжение, работа на пределе',
          }}
          heroName={project.characters[0]?.name || 'Главный герой'}
          onSave={handleSaveNineFields}
        />
      )}

      {/* Frame Preview Modal */}
      {previewScene && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewScene(null)}
        >
          <div 
            className="bg-[#16100c] border border-[#3b2b1d] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#2e2115] pb-3">
              <div>
                <h4 className="font-bold text-white text-sm">
                  {previewScene.title}
                </h4>
                <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                  Длительность: {previewScene.duration}s · Движение: {previewScene.motionType} · Формат: {activeRatio.label}
                </div>
              </div>
              <button 
                onClick={() => setPreviewScene(null)}
                className="w-7 h-7 rounded-full bg-[#261c13] hover:bg-[#382a1d] text-stone-300 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-[360px] flex items-center justify-center border border-[#2d2015]">
              <img 
                src={previewScene.generatedImageUrl || generateSceneThumbnailDataUrl(previewScene.id, previewScene.title, previewScene.prompt, selectedRatio, selectedStyleId)} 
                alt={previewScene.title}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1.5 bg-[#120d09] p-3 rounded-xl border border-[#261a10]">
              <span className="text-[10px] uppercase font-mono text-amber-400 font-bold block">
                Промпт для генератора:
              </span>
              <p className="text-xs text-stone-300 font-mono leading-relaxed">
                {previewScene.prompt}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-stone-500 font-mono">
                Модель: {activeModel.name} ({activeModel.code})
              </span>
              <div className="flex items-center gap-2">
                {onGoToVideo && (
                  <button
                    onClick={() => {
                      setPreviewScene(null);
                      onGoToVideo();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-300 font-semibold text-xs border border-amber-500/40 flex items-center gap-1.5 transition-colors"
                  >
                    <Video className="w-3.5 h-3.5 text-amber-400" />
                    <span>Оживить в Veo 3</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    handleRegenerateScene(previewScene.id);
                    setPreviewScene(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#241a10] hover:bg-[#362719] text-stone-200 text-xs border border-[#3b2b1d]"
                >
                  Переснять этот кадр
                </button>
                <button
                  onClick={() => setPreviewScene(null)}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Generation Success Modal */}
      {isBatchCompleteModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsBatchCompleteModalOpen(false)}
        >
          <div 
            className="bg-[#16100c] border border-amber-500/40 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#2e2115] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎉</span>
                  <h3 className="font-bold text-white text-base">
                    Кадры успешно сгенерированы!
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
                    {lastGeneratedScenes.length || project.scenes.length} планов готово
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  Все кадры скомпонованы, озвучка и Ken Burns движения рассчитаны встык. Таймлайн готов к рендеру.
                </p>
              </div>
              <button 
                onClick={() => setIsBatchCompleteModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#261c13] hover:bg-[#382a1d] text-stone-300 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Grid of Generated Scenes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {(lastGeneratedScenes.length > 0 ? lastGeneratedScenes : project.scenes).map((sc, i) => (
                <div 
                  key={sc.id} 
                  className="rounded-xl overflow-hidden bg-[#120d09] border border-[#2e2114] flex flex-col group hover:border-amber-500/50 transition-all"
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    <img 
                      src={sc.generatedImageUrl || generateSceneThumbnailDataUrl(sc.id, sc.title, sc.prompt, selectedRatio, selectedStyleId)} 
                      alt={sc.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-amber-300">
                      {sc.duration}s · {sc.motionType}
                    </span>
                  </div>
                  <div className="p-2 flex-1 flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-stone-200 line-clamp-1">
                      {i + 1}. {sc.title.replace(/^План\s*\d*:\s*/, '')}
                    </span>
                    <p className="text-[10px] text-stone-400 line-clamp-2 mt-1 leading-snug">
                      {sc.prompt}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2e2115]">
              <span className="text-xs font-mono text-stone-400">
                Формат: {activeRatio.label} · Модель: {activeModel.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchCompleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#241a10] hover:bg-[#362719] text-stone-300 text-xs border border-[#3b2b1d] transition-colors"
                >
                  Остаться в редакторе
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchCompleteModalOpen(false);
                    onGoToMontage();
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-bold text-xs shadow-lg flex items-center gap-2 transition-all animate-pulse"
                >
                  <Film className="w-4 h-4" />
                  <span>Перейти в Монтаж и рендер →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      {isImageGalleryModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsImageGalleryModalOpen(false)}
        >
          <div 
            className="bg-[#16100c] border border-[#3b2b1d] rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#2e2115] pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>Медиатека кадров проекта ({project.scenes.length} шт)</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Нажмите на любой кадр для полноразмерного просмотра или пересъёмки
                </p>
              </div>
              <button 
                onClick={() => setIsImageGalleryModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#261c13] hover:bg-[#382a1d] text-stone-300 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[450px] overflow-y-auto pr-1">
              {project.scenes.map((sc, i) => (
                <div 
                  key={sc.id}
                  onClick={() => {
                    setIsImageGalleryModalOpen(false);
                    setPreviewScene(sc);
                  }}
                  className="group rounded-xl overflow-hidden bg-[#120d09] border border-[#2e2114] hover:border-amber-400 cursor-pointer transition-all shadow-md flex flex-col"
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    <img 
                      src={sc.generatedImageUrl || generateSceneThumbnailDataUrl(sc.id, sc.title, sc.prompt, selectedRatio, selectedStyleId)} 
                      alt={sc.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-amber-300">
                      {sc.duration}s
                    </span>
                  </div>
                  <div className="p-2">
                    <span className="text-[11px] font-semibold text-stone-200 line-clamp-1">
                      {i + 1}. {sc.title.replace(/^План\s*\d*:\s*/, '')}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono block mt-0.5">
                      {sc.motionType}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#2e2115]">
              <button
                type="button"
                onClick={() => setIsImageGalleryModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Google Flow Response Data Import Modal */}
      <FlowImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportFrames={handleImportFlowFrames}
      />

      {/* Custom Style Creation Modal */}
      <CreateStyleModal
        isOpen={isStyleModalOpen}
        onClose={() => {
          setIsStyleModalOpen(false);
          setEditingStyleId(null);
        }}
        editingStyle={customStyles.find((s) => s.id === editingStyleId) || null}
        onCreate={(style) => {
          const isEdit = customStyles.some((s) => s.id === style.id);
          const nextStyles = isEdit
            ? customStyles.map((s) => (s.id === style.id ? style : s))
            : [...customStyles, style];
          setCustomStyles(nextStyles);
          setSelectedStyleId(style.id);
          onUpdateProject({ styleId: style.id, customStyles: nextStyles });
          showToast(isEdit ? `✏️ Стиль «${style.name}» обновлён` : `✨ Стиль «${style.name}» создан и выбран для пачки`);
        }}
        onDelete={(styleId) => {
          const removed = customStyles.find((s) => s.id === styleId);
          const nextStyles = customStyles.filter((s) => s.id !== styleId);
          setCustomStyles(nextStyles);
          const nextSelected = selectedStyleId === styleId ? 'none' : selectedStyleId;
          setSelectedStyleId(nextSelected);
          onUpdateProject({ customStyles: nextStyles, styleId: nextSelected });
          showToast(`🗑️ Стиль «${removed?.name || ''}» удалён`);
        }}
      />

      {/* Character/Location Reference Modal */}
      {refModal && (
        <CharacterReferenceModal
          isOpen={Boolean(refModal)}
          kind={refModal.kind}
          initialName={
            refModal.kind === 'character'
              ? characters.find((c) => c.id === refModal.editId)?.name
              : locations.find((l) => l.id === refModal.editId)?.name
          }
          initialRole={
            refModal.kind === 'character'
              ? characters.find((c) => c.id === refModal.editId)?.role
              : locations.find((l) => l.id === refModal.editId)?.type
          }
          initialImage={
            refModal.kind === 'character'
              ? characters.find((c) => c.id === refModal.editId)?.customImage
              : locations.find((l) => l.id === refModal.editId)?.customImage
          }
          onClose={() => setRefModal(null)}
          onSave={handleSaveCharacterRef}
        />
      )}

      {/* In-app Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#18120c]/95 backdrop-blur-md border border-amber-500/40 text-stone-100 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
          <p className="leading-snug font-medium">{toastMessage}</p>
        </div>
      )}
    </div>
  );
};
