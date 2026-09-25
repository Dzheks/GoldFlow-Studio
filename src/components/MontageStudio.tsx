import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, TimelineClip, StoryScene } from '../types';
import { drawProceduralScene, generateSceneThumbnailDataUrl } from '../utils/proceduralCanvas';
import { buildSynchronizedTimeline } from '../utils/autoAssembly';
import { soundEngine } from '../utils/audioSynthesizer';
import { ASPECT_RATIO_OPTIONS, getAspectRatioConfig, AspectRatioKey } from '../config/aspectRatios';
import { exportRealTimelineVideo } from '../utils/realVideoExporter';
import { ELEVEN_LANGUAGES } from '../types/languages';
import { NineFieldsEditorModal } from './NineFieldsEditorModal';
import { DirectorNineFields, compileNineFieldsPrompt } from '../types/goldflow';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Volume2, 
  VolumeX, 
  Scissors, 
  Trash2, 
  Copy, 
  Sliders, 
  Layers, 
  Share2, 
  ChevronDown,
  Sparkles,
  Maximize2,
  Check,
  Type,
  Music,
  Mic,
  Film,
  Wand2,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';

interface MontageStudioProps {
  project: ProjectData;
  onUpdateProject: (updated: Partial<ProjectData>) => void;
  onBack: () => void;
  credits: number;
  onDeductCredits: (amount: number) => boolean;
}

export const MontageStudio: React.FC<MontageStudioProps> = ({
  project,
  onUpdateProject,
  onBack,
  credits,
  onDeductCredits,
}) => {
  // Player state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(24);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'project' | 'voice' | 'titles' | 'sound' | 'files'>('project');
  const [inspectorTab, setInspectorTab] = useState<'clip' | 'style' | 'assembly'>('clip');

  // Timeline & Selection state
  const [clips, setClips] = useState<TimelineClip[]>(project.timelineClips);
  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip-v1');
  const [timelineZoom, setTimelineZoom] = useState<number>(1.0); // 1.0 = normal
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>('ru');
  const [editingNineFieldsScene, setEditingNineFieldsScene] = useState<StoryScene | null>(null);

  // Montage Settings
  const [autoTransitions, setAutoTransitions] = useState<boolean>(project.autoTransitions);
  const [syncWithVoice, setSyncWithVoice] = useState<boolean>(project.syncWithVoice);
  const [removePauses, setRemovePauses] = useState<boolean>(project.removePauses);
  const [speedUpPlans, setSpeedUpPlans] = useState<boolean>(project.speedUpPlans);
  const [clipHoldDuration, setClipHoldDuration] = useState<number>(project.clipHoldDuration || 4.0);
  const [duckingLevel, setDuckingLevel] = useState<number>(project.bgMusicVolume || 0.15);
  const [transitionDuration, setTransitionDuration] = useState<number>(project.transitionDuration || 0.5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>(
    (project.aspectRatio as AspectRatioKey) || '16:9'
  );
  const [fps, setFps] = useState<number>(project.fps || 30);
  const [preset, setPreset] = useState<string>(project.preset || 'YouTube — обычное видео');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);
  // Real narration audio player: the voice track's audioUrl plays here instead
  // of the browser TTS. The single continuous clip that buildSynchronizedTimeline
  // now emits when there's a real mp3 drives play/pause/seek.
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationClip = clips.find((c) => c.trackId === 'voice' && !!c.audioUrl);

  // Recalculate duration from clips
  useEffect(() => {
    const maxEnd = clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 24);
    setTotalDuration(Math.max(24, Math.ceil(maxEnd)));
  }, [clips]);

  // Audio start / stop when playing. If a real narration mp3 is on the voice
  // track, we play IT (properly seeks and pauses with the transport). If not,
  // fall back to per-scene browser TTS the way it worked before.
  useEffect(() => {
    if (isPlaying) {
      soundEngine.startBackgroundAmbience(duckingLevel);
      if (narrationClip?.audioUrl) {
        const el = narrationAudioRef.current;
        if (el && !isMuted) {
          el.currentTime = Math.max(0, currentTime - narrationClip.startTime);
          el.muted = isMuted;
          el.play().catch(() => { /* browser might block autoplay until user gesture — user's play click IS the gesture */ });
        }
      } else {
        const currentVoiceClip = clips.find(
          c => c.trackId === 'voice' && currentTime >= c.startTime && currentTime < c.startTime + c.duration
        );
        if (currentVoiceClip?.text && !isMuted) {
          soundEngine.speakText(currentVoiceClip.text);
        }
      }
    } else {
      soundEngine.stopBackgroundAmbience();
      soundEngine.stopSpeech();
      if (narrationAudioRef.current) narrationAudioRef.current.pause();
    }
    return () => {
      soundEngine.stopBackgroundAmbience();
      soundEngine.stopSpeech();
      if (narrationAudioRef.current) narrationAudioRef.current.pause();
    };
  }, [isPlaying]);

  // Keep the real narration audio's time in sync with the transport when the
  // user scrubs or the tick loop advances currentTime (small drift correction).
  useEffect(() => {
    const el = narrationAudioRef.current;
    if (!el || !narrationClip?.audioUrl) return;
    const target = Math.max(0, currentTime - narrationClip.startTime);
    if (Math.abs(el.currentTime - target) > 0.4) el.currentTime = target;
  }, [currentTime, narrationClip?.audioUrl, narrationClip?.startTime]);

  // Reflect mute toggle onto the real audio element.
  useEffect(() => {
    if (narrationAudioRef.current) narrationAudioRef.current.muted = isMuted;
  }, [isMuted]);

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying) {
      lastTickTimeRef.current = null;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const tick = (now: number) => {
      if (lastTickTimeRef.current !== null) {
        const delta = (now - lastTickTimeRef.current) / 1000;
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }
      lastTickTimeRef.current = now;
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Find active video clip
    const videoClips = clips.filter(c => c.trackId === 'video').sort((a, b) => a.startTime - b.startTime);
    const activeVideo = videoClips.find(c => currentTime >= c.startTime && currentTime <= c.startTime + c.duration) || videoClips[0];
    
    // Active voice / subtitle
    const activeVoice = clips.find(c => c.trackId === 'voice' && currentTime >= c.startTime && currentTime < c.startTime + c.duration);
    const activeTitle = clips.find(c => c.trackId === 'titles' && currentTime >= c.startTime && currentTime < c.startTime + c.duration);

    const sceneIndex = activeVideo ? videoClips.indexOf(activeVideo) + 1 : 1;
    const sceneTime = activeVideo ? Math.max(0, currentTime - activeVideo.startTime) : 0;
    const sceneDuration = activeVideo ? activeVideo.duration : 4;

    // Transition progress at clip end
    let transProgress = 0;
    if (activeVideo && sceneTime > sceneDuration - transitionDuration) {
      transProgress = (sceneTime - (sceneDuration - transitionDuration)) / transitionDuration;
    }

    const activeScene = project.scenes.find(s => s.id === sceneIndex);

    drawProceduralScene(ctx, canvas.width, canvas.height, {
      sceneId: sceneIndex,
      title: activeVideo?.name || 'Безымянный кадр',
      timeSec: sceneTime,
      durationSec: sceneDuration,
      motionType: activeVideo?.motion || 'zoom-in',
      transitionProgress: autoTransitions ? transProgress * 0.75 : 0,
      aspectRatio,
      activeSubtitle: activeVoice?.text,
      stickerOverlay: activeTitle?.text,
      imageUrl: activeVideo?.imageUrl || activeScene?.generatedImageUrl,
      inFrameCaption: ELEVEN_LANGUAGES.find(l => l.id === selectedLanguageId)?.sampleCaption || '1984 год. Ницца, Франция',
    });
  }, [currentTime, clips, autoTransitions, transitionDuration, aspectRatio, project.scenes, selectedLanguageId]);

  // Keyboard shortcuts (Space = play, S = split, arrows = scrub)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === 'KeyS' && !e.ctrlKey) {
        e.preventDefault();
        handleSplitClipAtPlayhead();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime(t => Math.min(totalDuration, t + (e.shiftKey ? 1.0 : 1 / fps)));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime(t => Math.max(0, t - (e.shiftKey ? 1.0 : 1 / fps)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, fps, totalDuration, selectedClipId, clips]);

  const handleSplitClipAtPlayhead = () => {
    const targetClip = clips.find(c => c.id === selectedClipId) || clips.find(c => c.trackId === 'video' && currentTime > c.startTime && currentTime < c.startTime + c.duration);
    if (!targetClip) return;

    if (currentTime <= targetClip.startTime + 0.5 || currentTime >= targetClip.startTime + targetClip.duration - 0.5) {
      alert('Слишком близко к краю клипа для разреза (минимум 0.5 сек).');
      return;
    }

    soundEngine.playWhoosh();
    const firstDuration = currentTime - targetClip.startTime;
    const secondDuration = targetClip.duration - firstDuration;

    const updatedFirst: TimelineClip = { ...targetClip, duration: firstDuration };
    const secondPart: TimelineClip = {
      ...targetClip,
      id: `clip-v-${Date.now()}`,
      startTime: currentTime,
      duration: secondDuration,
      name: `${targetClip.name} (часть 2)`
    };

    setClips(clips.map(c => c.id === targetClip.id ? updatedFirst : c).concat(secondPart));
    setSelectedClipId(secondPart.id);
  };

  // Goldflow Auto-Sync: Arranges video scenes frame-by-frame aligned with voiceover speech
  const handleGoldflowAutoSync = () => {
    soundEngine.playSuccess();
    const { timelineClips, totalDuration: newTotalDuration } = buildSynchronizedTimeline(
      project.scenes,
      aspectRatio,
      project.styleId || 'cinematic',
      clipHoldDuration,
      project.narrationAudioUrl,
    );
    setClips(timelineClips);
    setTotalDuration(newTotalDuration);
    onUpdateProject({ timelineClips, duration: newTotalDuration });
    alert(`⚡ Автосборка завершена: ${project.scenes.length} кадров из Контент-завода синхронизированы с фразами озвучки!`);
  };

  // If we entered Montage with an older timeline (no real-audio voice clip) but
  // a real narration mp3 exists in the project, rebuild once so the transport
  // gets a working audio track without waiting for a manual "Auto-sync" click.
  useEffect(() => {
    if (!project.narrationAudioUrl) return;
    const hasAudioTrack = project.timelineClips?.some((c) => c.trackId === 'voice' && !!c.audioUrl);
    if (hasAudioTrack) return;
    const { timelineClips, totalDuration: newTotalDuration } = buildSynchronizedTimeline(
      project.scenes,
      aspectRatio,
      project.styleId || 'cinematic',
      clipHoldDuration,
      project.narrationAudioUrl,
    );
    setClips(timelineClips);
    setTotalDuration(newTotalDuration);
    onUpdateProject({ timelineClips, duration: newTotalDuration });
    // Intentionally one-shot: dependencies would loop through onUpdateProject.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.narrationAudioUrl]);

  const handleShuffleLayout = () => {
    soundEngine.playWhoosh();
    let currentStart = 0;
    const reorderedVideo = clips
      .filter(c => c.trackId === 'video')
      .sort(() => Math.random() - 0.5)
      .map(c => {
        const dur = clipHoldDuration + (Math.random() * 0.8 - 0.4);
        const updated = { ...c, startTime: currentStart, duration: dur };
        currentStart += dur;
        return updated;
      });

    const otherClips = clips.filter(c => c.trackId !== 'video');
    setClips([...reorderedVideo, ...otherClips]);
    alert('Кадры переразложены по новому сиду монтажа!');
  };

  const handleExportVideo = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStatusText('Инициализация медиакодека и аудио-микшера...');
    soundEngine.playWhoosh();

    try {
      await exportRealTimelineVideo({
        projectName: project.name || 'GoldFlow_Movie',
        clips,
        scenes: project.scenes,
        totalDuration,
        aspectRatio,
        fps,
        bgMusicVolume: duckingLevel,
        languageId: selectedLanguageId,
        onProgress: (percent, statusText) => {
          setExportProgress(percent);
          setExportStatusText(statusText);
        },
      });
      soundEngine.playSuccess();
      setExportStatusText('✓ Готово! Файл видео со звуком успешно сохранён на диск.');
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Ошибка при экспорте видео: ' + (err.message || 'Сбой видеокодека'));
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 3500);
    }
  };

  const handleReshootSingleClip = (newFields: DirectorNineFields) => {
    if (!selectedClip) return;
    const newPrompt = compileNineFieldsPrompt(newFields);
    const videoIndex = clips.filter(c => c.trackId === 'video').findIndex(c => c.id === selectedClip.id);
    const sceneId = videoIndex >= 0 ? (project.scenes[videoIndex]?.id || videoIndex + 1) : 1;
    
    // Generate new visual specifically for this single frame
    const newThumbnail = generateSceneThumbnailDataUrl(
      sceneId + Math.floor(Math.random() * 50) + 10,
      selectedClip.name,
      newPrompt,
      aspectRatio,
      'cinematic'
    );

    // Update clip
    const updatedClips = clips.map(c => {
      if (c.id === selectedClip.id) {
        return {
          ...c,
          imageUrl: newThumbnail,
        };
      }
      return c;
    });

    // Update scene in project
    const updatedScenes = project.scenes.map((s, idx) => {
      if (idx === videoIndex) {
        return {
          ...s,
          prompt: newPrompt,
          generatedImageUrl: newThumbnail,
        };
      }
      return s;
    });

    setClips(updatedClips);
    onUpdateProject({ timelineClips: updatedClips, scenes: updatedScenes });
    setEditingNineFieldsScene(null);
    soundEngine.playSuccess();
  };

  const selectedClip = clips.find(c => c.id === selectedClipId);

  // Format time mm:ss.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0e0b08] text-stone-200 flex flex-col select-none">
      {/* Hidden real-narration audio element: play/pause/seek is driven by the
          transport above so the mp3 stays in lock-step with the timeline. */}
      {narrationClip?.audioUrl && (
        <audio ref={narrationAudioRef} src={narrationClip.audioUrl} preload="auto" style={{ display: 'none' }} />
      )}
      {/* Top Header Bar */}
      <div className="border-b border-[#261d15] bg-[#130f0b] px-4 py-2 flex items-center justify-between text-xs">
        {/* Left: Back & Project name */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold text-white">{project.name}</span>
          </button>
        </div>

        {/* Center: Format Controls */}
        <div className="flex items-center gap-3">
          {/* Aspect ratio */}
          <div className="flex items-center gap-1 bg-[#1a140f] px-2 py-1 rounded border border-[#302316]">
            <select
              value={aspectRatio}
              onChange={(e) => {
                const newRatio = e.target.value as AspectRatioKey;
                setAspectRatio(newRatio);
                onUpdateProject({ aspectRatio: newRatio });
              }}
              className="bg-transparent text-stone-200 text-xs focus:outline-none"
            >
              {ASPECT_RATIO_OPTIONS.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#1a140f] text-white">
                  {r.label} ({r.code})
                </option>
              ))}
            </select>
          </div>

          {/* Preset */}
          <div className="flex items-center gap-1 bg-[#1a140f] px-2 py-1 rounded border border-[#302316]">
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="bg-transparent text-stone-200 text-xs focus:outline-none"
            >
              <option value="YouTube — обычное видео">YouTube — обычное видео</option>
              <option value="YouTube Shorts">YouTube Shorts</option>
              <option value="VK Клипы">VK Клипы</option>
              <option value="Reels / TikTok">Reels / TikTok</option>
            </select>
          </div>

          {/* FPS */}
          <div className="flex items-center gap-1 bg-[#1a140f] px-2 py-1 rounded border border-[#302316]">
            <select
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="bg-transparent text-stone-200 text-xs focus:outline-none"
            >
              <option value={30}>30 к/с</option>
              <option value={60}>60 к/с</option>
            </select>
          </div>

          <button
            onClick={() => alert('Проект успешно сохранен!')}
            className="px-3 py-1 rounded bg-[#241a10] hover:bg-[#322417] text-stone-200 border border-[#3c2b1d] transition-colors"
          >
            Сохранить
          </button>

          <span className="text-[11px] text-stone-500 hidden xl:inline">
            Ссылка скопирована — по ней монтаж открывается только на просмотр
          </span>
        </div>

        {/* Right: Credits badge */}
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded bg-[#18120d] border border-[#2e2014] text-amber-300 font-mono text-[11px]">
            {credits} кредитов · {credits} ₽
          </div>
          <button
            onClick={onBack}
            className="text-stone-400 hover:text-white transition-colors"
          >
            Выйти
          </button>
        </div>
      </div>

      {/* Main Workspace: 3-column layout (Left Tabs & Controls, Center Canvas Player, Right Inspector) */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-[460px]">
        {/* Left Column: Project assembly tabs & controls (3 cols) */}
        <div className="col-span-12 md:col-span-3 border-r border-[#261d15] bg-[#120e0a] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[#251b13] pb-2 text-xs">
              {(['project', 'voice', 'titles', 'sound', 'files'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded-t transition-colors ${
                    activeTab === tab
                      ? 'text-amber-400 font-semibold border-b-2 border-amber-400'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {tab === 'project' && 'Проект'}
                  {tab === 'voice' && 'Голос'}
                  {tab === 'titles' && 'Титры'}
                  {tab === 'sound' && 'Звук'}
                  {tab === 'files' && 'Файлы'}
                </button>
              ))}
            </div>

            {/* Selected project pill & actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a140e] border border-[#2b2014] text-xs">
                <span className="font-semibold text-white truncate">
                  {project.name} · 0 видео, {clips.filter(c => c.trackId === 'video').length} фото
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => alert('Ссылка на просмотр скопирована!')}
                  className="flex-1 py-1 rounded bg-[#1c150e] hover:bg-[#281f15] border border-[#332517] text-stone-300 text-center"
                >
                  Ссылка на просмотр
                </button>
                <button
                  onClick={onBack}
                  className="px-3 py-1 rounded bg-[#1c150e] hover:bg-[#281f15] border border-[#332517] text-stone-400 hover:text-white"
                >
                  Закрыть
                </button>
              </div>

              <p className="text-[11px] text-stone-500">
                0 роликов, {clips.filter(c => c.trackId === 'video').length} кадров. Разложатся по номерам сцен.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleGoldflowAutoSync}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-black font-extrabold text-xs transition-all shadow-lg flex items-center justify-center gap-2 group"
              >
                <Wand2 className="w-4 h-4 text-black group-hover:rotate-12 transition-transform" />
                <span>Автосборка под озвучку</span>
              </button>

              {/* In-Frame Language Selector */}
              <div className="pt-1">
                <label className="text-[10px] text-stone-400 font-mono block mb-1">
                  Язык надписей в кадре:
                </label>
                <select
                  value={selectedLanguageId}
                  onChange={(e) => setSelectedLanguageId(e.target.value)}
                  className="w-full bg-[#16100b] border border-[#2e2116] rounded-lg px-2 py-1 text-xs text-stone-200 font-mono focus:outline-none focus:border-amber-500"
                >
                  {ELEVEN_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#120e0a]">
                      {l.name} ({l.nativeName}) · «{l.sampleCaption}»
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleExportVideo}
                disabled={isExporting}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Рендеринг {exportProgress}%...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 fill-black" />
                    <span>Смонтировать и скачать MP4</span>
                  </>
                )}
              </button>

              {isExporting && exportStatusText && (
                <div className="p-2 rounded bg-black/50 border border-amber-500/30 text-[10px] font-mono text-amber-300 text-center animate-pulse">
                  {exportStatusText}
                </div>
              )}
              
              <button
                onClick={handleShuffleLayout}
                className="w-full py-1.5 rounded-lg bg-[#1a130d] hover:bg-[#251b13] border border-[#382a1b] text-xs text-stone-400 hover:text-stone-200 transition-colors"
              >
                Перемешать сид порядка
              </button>
            </div>

            {/* Checkbox Options */}
            <div className="space-y-2 pt-2 border-t border-[#231a12] text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-stone-300">
                <input
                  type="checkbox"
                  checked={autoTransitions}
                  onChange={(e) => setAutoTransitions(e.target.checked)}
                  className="rounded border-[#382b1c] text-amber-500 focus:ring-0"
                />
                <span>Переходы между сценами</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-stone-300">
                <input
                  type="checkbox"
                  checked={syncWithVoice}
                  onChange={(e) => setSyncWithVoice(e.target.checked)}
                  className="rounded border-[#382b1c] text-amber-500 focus:ring-0"
                />
                <span>Подогнать под озвучку</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-stone-400">
                <input
                  type="checkbox"
                  checked={removePauses}
                  onChange={(e) => setRemovePauses(e.target.checked)}
                  className="rounded border-[#382b1c] text-amber-500 focus:ring-0"
                />
                <span>Вырезать паузы (вертикальные)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-stone-400">
                <input
                  type="checkbox"
                  checked={speedUpPlans}
                  onChange={(e) => setSpeedUpPlans(e.target.checked)}
                  className="rounded border-[#382b1c] text-amber-500 focus:ring-0"
                />
                <span>Ускорять планы (вертикальные)</span>
              </label>
            </div>

            {/* Numeric Sliders / Controls */}
            <div className="space-y-2.5 pt-2 border-t border-[#231a12] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-400">Кадр держится, сек</span>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="12"
                  value={clipHoldDuration}
                  onChange={(e) => setClipHoldDuration(Number(e.target.value))}
                  className="w-16 bg-[#18120d] border border-[#302216] rounded px-2 py-1 text-center font-mono text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-400">Звук роликов под голосом</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={duckingLevel}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDuckingLevel(val);
                    soundEngine.setMusicVolume(val);
                  }}
                  className="w-16 bg-[#18120d] border border-[#302216] rounded px-2 py-1 text-center font-mono text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-400">Длина перехода, сек</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2"
                  value={transitionDuration}
                  onChange={(e) => setTransitionDuration(Number(e.target.value))}
                  className="w-16 bg-[#18120d] border border-[#302216] rounded px-2 py-1 text-center font-mono text-white text-xs"
                />
              </div>

              <button
                onClick={handleShuffleLayout}
                className="w-full py-1.5 rounded bg-[#1c150e] hover:bg-[#281f15] border border-[#332517] text-stone-300 text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Перемешать заново</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#231a12] text-[10px] text-stone-500 leading-normal">
            Раскладка повторима: один и тот же номер даёт один и тот же монтаж. Понравился результат — номер можно записать.
            <div className="mt-2 flex items-center gap-3 text-[11px] text-amber-400/80 font-mono">
              <button onClick={() => alert('Настройка долей эффектов')} className="hover:underline">
                ДОЛИ ЭФФЕКТОВ
              </button>
              <button onClick={() => alert('Расширенная конфигурация параметров')} className="hover:underline">
                НАСТРОИТЬ
              </button>
            </div>
          </div>
        </div>

        {/* Center Column: Video Preview Player (6 cols on lg) */}
        <div className="col-span-12 md:col-span-6 bg-[#0a0806] flex flex-col justify-between p-3 relative">
          {/* Canvas Viewport with Framing Box — shrank to fit 1080p laptops
              without vertical scroll (was 620/380/500 max, ~25% smaller now). */}
          <div className="flex-1 flex items-center justify-center relative min-h-[220px]">
            <div
              className={`relative border-2 border-dashed border-[#57432b] rounded-lg overflow-hidden shadow-2xl transition-all ${
                aspectRatio === '16:9' ? 'w-full max-w-[460px] aspect-video' :
                aspectRatio === '9:16' ? 'h-full max-h-[300px] aspect-[9/16]' :
                aspectRatio === '4:3' ? 'w-full max-w-[380px] aspect-[4/3]' :
                aspectRatio === '3:4' ? 'h-full max-h-[300px] aspect-[3/4]' :
                'w-full max-w-[300px] aspect-square'
              }`}
            >
              <canvas
                ref={canvasRef}
                width={getAspectRatioConfig(aspectRatio).width}
                height={getAspectRatioConfig(aspectRatio).height}
                className="w-full h-full object-contain bg-black cursor-pointer"
                onClick={() => setIsPlaying(!isPlaying)}
              />

              {/* Safe guides watermark — shows the human aspect label, not the
                  internal enum ("IMAGE_ASPECT_RATIO_LANDSCAPE" leak). */}
              <div className="absolute inset-4 pointer-events-none border border-amber-500/10 rounded flex items-center justify-center">
                <span className="text-[10px] font-mono text-amber-500/40 uppercase tracking-widest">
                  Безопасная зона · {getAspectRatioConfig(aspectRatio).label}
                </span>
              </div>
            </div>
          </div>

          {/* Under Canvas Controls & Scrubber */}
          <div className="pt-3 space-y-2 border-t border-[#211911]">
            <div className="flex items-center gap-3">
              {/* Play/Pause Button */}
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setIsPlaying(!isPlaying);
                }}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-black" />
                    <span>Пауза</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Играть</span>
                  </>
                )}
              </button>

              {/* Time Scrubber */}
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max={totalDuration}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => setCurrentTime(Number(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-[#251c14] rounded-lg cursor-pointer"
                />
              </div>

              {/* Timestamp Counter */}
              <div className="font-mono text-xs text-amber-300 font-semibold tabular-nums shrink-0">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </div>

              {/* Volume toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-stone-400 hover:text-white p-1"
                title={isMuted ? 'Включить звук' : 'Выключить звук'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Shortcuts hint bar */}
            <div className="text-[10px] text-stone-500 text-center font-mono pt-1">
              Пробел — играть • S — разрезать • Ctrl+X — вырезать • Ctrl+V — вставить • Ctrl+D — дублировать • Ctrl+S — сохранить • Стрелки — по кадру
            </div>
          </div>
        </div>

        {/* Right Column: Clip Inspector (3 cols) */}
        <div className="col-span-12 md:col-span-3 border-l border-[#261d15] bg-[#120e0a] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            {/* Inspector Tabs */}
            <div className="flex items-center gap-1 border-b border-[#251b13] pb-2 text-xs">
              <button
                onClick={() => setInspectorTab('clip')}
                className={`flex-1 py-1 rounded transition-colors text-center ${
                  inspectorTab === 'clip'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Клип
              </button>
              <button
                onClick={() => setInspectorTab('style')}
                className={`flex-1 py-1 rounded transition-colors text-center ${
                  inspectorTab === 'style'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Оформление
              </button>
              <button
                onClick={() => setInspectorTab('assembly')}
                className={`flex-1 py-1 rounded transition-colors text-center ${
                  inspectorTab === 'assembly'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Сборка
              </button>
            </div>

            {inspectorTab === 'clip' && (
              <div className="space-y-3 text-xs">
                {selectedClip ? (
                  <>
                    <div className="p-3 rounded-xl bg-[#1a140e] border border-[#2e2115] space-y-2.5">
                      {selectedClip.imageUrl && (
                        <div className="w-full h-24 rounded-lg overflow-hidden border border-[#3b2b1d] bg-black flex items-center justify-center">
                          <img 
                            src={selectedClip.imageUrl} 
                            alt={selectedClip.name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white truncate max-w-[170px]">
                          {selectedClip.name}
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono">
                          {selectedClip.duration.toFixed(1)} сек
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono">
                        Начало: {selectedClip.startTime.toFixed(1)}s · Конец: {(selectedClip.startTime + selectedClip.duration).toFixed(1)}s
                      </div>
                      
                      {selectedClip.text && (
                        <div className="p-2 rounded bg-[#120e0a] border border-[#2b2014] text-stone-300 text-[11px]">
                          <span className="text-amber-400 font-mono text-[10px] block mb-0.5">Фраза озвучки:</span>
                          «{selectedClip.text}»
                        </div>
                      )}
                    </div>

                    {/* Motion In Frame selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-stone-300">
                        Движение в кадре (Ken Burns):
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'zoom-in', label: 'Наезд (Zoom In)' },
                          { id: 'zoom-out', label: 'Отъезд (Zoom Out)' },
                          { id: 'pan-left', label: 'Панорама влево' },
                          { id: 'pan-right', label: 'Панорама вправо' },
                          { id: 'static', label: 'Статика' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setClips(clips.map(c => c.id === selectedClip.id ? { ...c, motion: m.id as any } : c));
                            }}
                            className={`p-2 rounded-lg text-left text-[11px] border transition-colors ${
                              selectedClip.motion === m.id
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-medium'
                                : 'bg-[#18120d] border-[#2c2014] text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Transition selector */}
                    <div className="space-y-1.5 pt-2 border-t border-[#231a12]">
                      <label className="block text-[11px] font-semibold text-stone-300">
                        Переход:
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'crossfade', label: 'Растворение' },
                          { id: 'fade-black', label: 'Затемнение' },
                          { id: 'zoom', label: 'Зум-переход' },
                          { id: 'cut', label: 'Прямая склейка' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setClips(clips.map(c => c.id === selectedClip.id ? { ...c, transition: t.id as any } : c));
                            }}
                            className={`p-2 rounded-lg text-left text-[11px] border transition-colors ${
                              selectedClip.transition === t.id
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-medium'
                                : 'bg-[#18120d] border-[#2c2014] text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reshoot frame by 9 fields */}
                    {selectedClip.trackId === 'video' && (
                      <div className="pt-2 border-t border-[#231a12]">
                        <button
                          type="button"
                          onClick={() => {
                            const videoIndex = clips.filter(c => c.trackId === 'video').findIndex(c => c.id === selectedClip.id);
                            const scene = project.scenes[videoIndex] || {
                              id: videoIndex + 1,
                              title: selectedClip.name,
                              duration: selectedClip.duration,
                              description: selectedClip.text || selectedClip.name,
                              prompt: '',
                              motionType: selectedClip.motion || 'zoom-in',
                              transition: 'crossfade',
                            };
                            setEditingNineFieldsScene(scene);
                          }}
                          className="w-full py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Film className="w-3.5 h-3.5 text-amber-400" />
                          <span>Переснять кадр (9 полей)</span>
                        </button>
                        <span className="text-[10px] text-stone-500 block text-center mt-1 font-mono">
                          Правка без пересъёмки: обновится только этот кадр
                        </span>
                      </div>
                    )}

                    {/* Actions for clip */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={handleSplitClipAtPlayhead}
                        className="flex-1 py-1.5 rounded-lg bg-[#241a10] hover:bg-[#342517] border border-[#3b2a1b] text-stone-200 text-xs flex items-center justify-center gap-1.5"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Разрезать (S)</span>
                      </button>
                      <button
                        onClick={() => {
                          setClips(clips.filter(c => c.id !== selectedClip.id));
                          setSelectedClipId(null);
                        }}
                        className="py-1.5 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/40 text-rose-300 text-xs"
                        title="Удалить клип"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-stone-500 text-center py-10 leading-relaxed">
                    Выбери клип на дорожке — здесь появятся движение в кадре, переход, громкость и затухание.
                  </div>
                )}
              </div>
            )}

            {inspectorTab === 'style' && (
              <div className="space-y-3 text-xs">
                <label className="block text-[11px] font-semibold text-stone-300">
                  Добавить плашку на экран:
                </label>
                <div className="space-y-2">
                  {[
                    'ПОДПИШИСЬ — новые выпуски каждый вторник',
                    'ЛАЙК И КОММЕНТАРИЙ ПОД ВИДЕО',
                    'ССЫЛКА НА ПРОДОЛЖЕНИЕ В ОПИСАНИИ'
                  ].map((presetText) => (
                    <button
                      key={presetText}
                      onClick={() => {
                        const newTitleClip: TimelineClip = {
                          id: `clip-t-${Date.now()}`,
                          trackId: 'titles',
                          name: presetText.slice(0, 20),
                          startTime: currentTime,
                          duration: 3.5,
                          color: '#ef4444',
                          text: presetText
                        };
                        setClips([...clips, newTitleClip]);
                        alert('Плашка добавлена на дорожку титров!');
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-[#18120d] border border-[#2b2014] hover:border-amber-500/40 text-stone-300 text-[11px] transition-colors"
                    >
                      + {presetText}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {inspectorTab === 'assembly' && (
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#18120d] border border-[#2b2014] text-stone-300 space-y-1.5">
                  <div className="font-semibold text-white">Параметры рендера:</div>
                  <div>• Разрешение: Full HD 1080p</div>
                  <div>• Кодек: H.264 / AAC</div>
                  <div>• Битрэйт: 12 Mbps (High Profile)</div>
                  <div>• Метод: WebCodecs Hardware Acceleration</div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#231a12] text-[10px] text-stone-500">
            GoldFlow Engine v2.4 · Локальный рендер в браузере
          </div>
        </div>
      </div>

      {/* Bottom Multi-Track Timeline */}
      <div className="border-t border-[#261d15] bg-[#110e0b] p-3 space-y-2">
        {/* Timeline Header: Zoom Slider and track labels */}
        <div className="flex items-center justify-between text-xs pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-400 font-mono uppercase">Масштаб:</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(Number(e.target.value))}
              className="w-24 accent-amber-500 h-1 bg-[#251c14] rounded cursor-pointer"
            />
          </div>
          <div className="text-[11px] text-stone-500">
            Материалы перетаскиваются на дорожки мыслью и курсором
          </div>
        </div>

        {/* Tracks Canvas & Grid */}
        <div className="relative bg-[#0c0907] border border-[#241a12] rounded-xl p-2 overflow-x-auto min-h-[170px]">
          {/* Moving Playhead Scrubber Red Line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-amber-400 z-30 pointer-events-none transition-all shadow-[0_0_8px_rgba(245,158,11,0.8)]"
            style={{
              left: `${80 + (currentTime / totalDuration) * 920 * timelineZoom}px`,
            }}
          >
            <div className="w-3 h-3 bg-amber-400 rotate-45 -ml-[5px] -mt-1 rounded-sm shadow-sm" />
          </div>

          {/* Time markers bar */}
          <div className="flex items-center pl-20 pb-2 border-b border-[#1c150e] text-[10px] font-mono text-stone-500 space-x-20">
            {[0, 5, 10, 15, 20, 25, 30].map((t) => (
              <span key={t}>0:{t.toString().padStart(2, '0')}</span>
            ))}
          </div>

          {/* Track 1: Видео */}
          <div className="flex items-center py-1.5 border-b border-[#1a140f] relative min-h-[36px]">
            <div className="w-20 text-[11px] font-bold text-amber-200 shrink-0 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-amber-400" />
              <span>Видео</span>
            </div>
            <div className="flex-1 relative h-8">
              {clips
                .filter((c) => c.trackId === 'video')
                .map((clip) => {
                  const left = (clip.startTime / totalDuration) * 920 * timelineZoom;
                  const width = (clip.duration / totalDuration) * 920 * timelineZoom;
                  const isSelected = clip.id === selectedClipId;

                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClipId(clip.id)}
                      className={`absolute top-0 bottom-0 rounded-md px-1.5 flex items-center justify-between text-[11px] font-semibold truncate cursor-pointer transition-all border ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-400/40 z-20 text-white shadow-lg'
                          : 'border-[#523d26] text-stone-200 hover:brightness-110'
                      }`}
                      style={{
                        left: `${left}px`,
                        width: `${Math.max(45, width)}px`,
                        backgroundColor: clip.color || '#b45309',
                      }}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {clip.imageUrl && (
                          <img 
                            src={clip.imageUrl} 
                            alt="" 
                            className="w-5 h-5 rounded object-cover shrink-0 border border-black/40 shadow-sm" 
                          />
                        )}
                        <span className="truncate">{clip.name}</span>
                      </div>
                      <span className="text-[9px] font-mono text-amber-200 ml-1 shrink-0 bg-black/40 px-1 rounded">
                        {clip.duration.toFixed(1)}s
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Track 2: Озвучка */}
          <div className="flex items-center py-1.5 border-b border-[#1a140f] relative min-h-[36px]">
            <div className="w-20 text-[11px] font-bold text-sky-200 shrink-0 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              <span>Озвучка</span>
            </div>
            <div className="flex-1 relative h-8">
              {clips
                .filter((c) => c.trackId === 'voice')
                .map((clip) => {
                  const left = (clip.startTime / totalDuration) * 920 * timelineZoom;
                  const width = (clip.duration / totalDuration) * 920 * timelineZoom;
                  const isSelected = clip.id === selectedClipId;

                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClipId(clip.id)}
                      className={`absolute top-0 bottom-0 rounded-md px-2 flex items-center justify-between text-[11px] font-semibold truncate cursor-pointer border ${
                        isSelected
                          ? 'border-sky-400 ring-2 ring-sky-400/40 z-20 text-white'
                          : 'border-sky-800 text-stone-100 hover:brightness-110'
                      }`}
                      style={{
                        left: `${left}px`,
                        width: `${Math.max(40, width)}px`,
                        backgroundColor: '#1d4ed8',
                      }}
                    >
                      <span className="truncate">{clip.name}</span>
                      <span className="text-[9px] font-mono text-sky-200 ml-1">
                        {clip.duration.toFixed(1)}s
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Track 3: Музыка */}
          <div className="flex items-center py-1.5 border-b border-[#1a140f] relative min-h-[36px]">
            <div className="w-20 text-[11px] font-bold text-emerald-200 shrink-0 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              <span>Музыка</span>
            </div>
            <div className="flex-1 relative h-8">
              {clips
                .filter((c) => c.trackId === 'music')
                .map((clip) => {
                  const left = (clip.startTime / totalDuration) * 920 * timelineZoom;
                  const width = (clip.duration / totalDuration) * 920 * timelineZoom;

                  return (
                    <div
                      key={clip.id}
                      className="absolute top-0 bottom-0 rounded-md px-2 flex items-center justify-between text-[11px] font-semibold truncate border border-emerald-800 text-emerald-100 bg-[#065f46]"
                      style={{
                        left: `${left}px`,
                        width: `${Math.max(40, width)}px`,
                      }}
                    >
                      <span className="truncate">{clip.name}</span>
                      <span className="text-[9px] font-mono text-emerald-200 ml-1">
                        Vol {duckingLevel * 100}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Track 4: Титры */}
          <div className="flex items-center py-1.5 relative min-h-[36px]">
            <div className="w-20 text-[11px] font-bold text-rose-200 shrink-0 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-rose-400" />
              <span>Титры</span>
            </div>
            <div className="flex-1 relative h-8">
              {clips
                .filter((c) => c.trackId === 'titles')
                .map((clip) => {
                  const left = (clip.startTime / totalDuration) * 920 * timelineZoom;
                  const width = (clip.duration / totalDuration) * 920 * timelineZoom;

                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClipId(clip.id)}
                      className="absolute top-0 bottom-0 rounded-md px-2 flex items-center justify-between text-[11px] font-semibold truncate border border-rose-700 text-rose-100 bg-[#991b1b] cursor-pointer"
                      style={{
                        left: `${left}px`,
                        width: `${Math.max(40, width)}px`,
                      }}
                    >
                      <span className="truncate">{clip.name}</span>
                      <span className="text-[9px] font-mono text-rose-200 ml-1">
                        {clip.duration.toFixed(1)}s
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {editingNineFieldsScene && (
        <NineFieldsEditorModal
          isOpen={true}
          sceneIndex={editingNineFieldsScene.id}
          onClose={() => setEditingNineFieldsScene(null)}
          onSave={(fields) => {
            handleReshootSingleClip(fields);
          }}
        />
      )}
    </div>
  );
};
