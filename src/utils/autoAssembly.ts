import { StoryScene, TimelineClip, AspectRatio } from '../types';
import { generateSceneThumbnailDataUrl } from './proceduralCanvas';

export interface VoiceSceneBlock {
  sceneId: number;
  title: string;
  voiceText: string;
  duration: number; // in seconds
  prompt: string;
  motionType: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
  transition: 'crossfade' | 'fade-black' | 'zoom' | 'cut';
}

/**
 * Calculates speech duration based on text length with natural pauses
 */
export function estimateSpeechDuration(text: string): number {
  const clean = text.trim();
  if (!clean) return 3.0;
  // Natural Russian speech cadence: ~14 characters per second, plus 0.5s pause
  const words = clean.split(/\s+/).length;
  const chars = clean.length;
  const baseDuration = chars / 13.5;
  const pauseFactor = (clean.match(/[,.?!:;—]/g) || []).length * 0.25;
  const duration = Math.max(2.8, Math.min(12.0, baseDuration + pauseFactor));
  return Math.round(duration * 10) / 10;
}

/**
 * Splits pasted narration text into one candidate frame per SENTENCE, not
 * per newline. A script pasted from a doc is usually one paragraph per
 * line — each paragraph holding a dozen sentences — so treating "line" as
 * "frame" undercounts badly (a ~11min/170-sentence script collapsed to
 * ~20 frames, one per paragraph, instead of one per ~3-4s beat). Splits on
 * ./!/? followed by whitespace or end of paragraph; an ellipsis ("...") is
 * treated as a single delimiter, not three. Paragraph breaks (blank lines)
 * are preserved as hard boundaries between the sentence groups they contain.
 */
export function splitScriptIntoSentenceLines(rawText: string): string[] {
  const paragraphs = rawText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const sentences = paragraph.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [paragraph];
    for (const s of sentences) {
      const trimmed = s.trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  return lines;
}

/**
 * Parses script text into synchronized voice lines and scene frames
 */
export function parseScriptToVoiceBlocks(
  scriptText: string,
  promptsList: string[] = []
): VoiceSceneBlock[] {
  // Extract sentences or paragraphs
  const rawLines = scriptText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('**'));

  const motions: Array<'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static'> = [
    'zoom-in',
    'pan-left',
    'zoom-out',
    'pan-right',
    'zoom-in',
    'static',
  ];

  const blocks: VoiceSceneBlock[] = [];
  let sceneIndex = 1;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    // Split long lines into natural sentence beats
    const sentences = line.match(/[^.!?]+[.!?]+/g) || [line];

    for (const sent of sentences) {
      const trimmed = sent.trim();
      if (trimmed.length < 5) continue;

      const prompt =
        promptsList[sceneIndex - 1] ||
        `Cinematic shot illustrating: ${trimmed.slice(0, 80)}, 35mm film photography, 8k detail`;

      const motion = motions[(sceneIndex - 1) % motions.length];
      const duration = estimateSpeechDuration(trimmed);

      blocks.push({
        sceneId: sceneIndex,
        title: `Кадр ${sceneIndex.toString().padStart(2, '0')}: ${trimmed.slice(0, 32)}...`,
        voiceText: trimmed,
        duration,
        prompt,
        motionType: motion,
        transition: sceneIndex % 4 === 0 ? 'fade-black' : 'crossfade',
      });

      sceneIndex++;
    }
  }

  // Fallback if empty
  if (blocks.length === 0) {
    blocks.push({
      sceneId: 1,
      title: 'Кадр 01: Вступление',
      voiceText: 'Есть версия твоего города, которую ты не замечаешь...',
      duration: 4.5,
      prompt: 'Cinematic wide shot of city street at dusk, warm lights',
      motionType: 'zoom-in',
      transition: 'crossfade',
    });
  }

  return blocks;
}

/**
 * Builds synchronized timeline clips (Video, Voice, Music, Titles)
 * perfectly matching scene frames to voiceover timestamps (Goldflow sync logic)
 */
export function buildSynchronizedTimeline(
  scenes: StoryScene[],
  aspectRatio: AspectRatio = '16:9',
  styleTheme: string = 'cinematic',
  clipHoldDuration: number = 4.0
): {
  timelineClips: TimelineClip[];
  totalDuration: number;
} {
  const videoColors = ['#d97706', '#b45309', '#92400e', '#78350f', '#f59e0b', '#d97706', '#ca8a04', '#b45309'];
  const newClips: TimelineClip[] = [];

  let currentPlayhead = 0;

  // 1. Build Video and Voice tracks in perfect sync
  scenes.forEach((scene, index) => {
    // If scene has explicit duration or estimate from prompt/description
    const sceneDuration = scene.duration || clipHoldDuration;
    const color = videoColors[index % videoColors.length];

    // Ensure thumbnail image exists for scene
    const imageUrl =
      scene.generatedImageUrl ||
      generateSceneThumbnailDataUrl(
        scene.id,
        scene.title,
        scene.prompt,
        aspectRatio,
        styleTheme
      );

    // Video Clip
    newClips.push({
      id: `clip-video-${scene.id}-${Date.now()}-${index}`,
      trackId: 'video',
      name: `${index + 1 < 10 ? '0' : ''}${index + 1}. ${scene.title}`,
      startTime: currentPlayhead,
      duration: sceneDuration,
      color,
      imageUrl,
      motion: scene.motionType || 'zoom-in',
      transition: scene.transition || 'crossfade',
      transitionDuration: 0.5,
    });

    // Voice Clip exactly matching this video beat
    newClips.push({
      id: `clip-voice-${scene.id}-${Date.now()}-${index}`,
      trackId: 'voice',
      name: `Озвучка: Кадр ${index + 1}`,
      startTime: currentPlayhead,
      duration: sceneDuration,
      color: '#2563eb',
      volume: 1.0,
      text: scene.description || scene.title,
    });

    currentPlayhead += sceneDuration;
  });

  const totalDuration = Math.max(12, Math.round(currentPlayhead * 10) / 10);

  // 2. Add Ambient Background Music Track spanning the whole video
  newClips.push({
    id: `clip-music-${Date.now()}`,
    trackId: 'music',
    name: 'Фон: Dark Cinematic Lo-Fi 120bpm',
    startTime: 0,
    duration: totalDuration,
    color: '#10b981',
    volume: 0.15,
  });

  // 3. Add Titles / CTAs at key moments
  newClips.push({
    id: `clip-title-intro-${Date.now()}`,
    trackId: 'titles',
    name: 'Плашка: Заголовок выпуска',
    startTime: 0.5,
    duration: Math.min(4.0, totalDuration * 0.3),
    color: '#eab308',
    text: scenes[0]?.title || 'Скрытые бизнесы',
  });

  if (totalDuration > 15) {
    newClips.push({
      id: `clip-title-cta-${Date.now()}`,
      trackId: 'titles',
      name: 'Плашка: Призыв подписаться',
      startTime: Math.round(totalDuration * 0.65),
      duration: 3.5,
      color: '#ef4444',
      text: '🔔 ПОДПИШИСЬ — новые выпуски каждый вторник',
    });
  }

  return {
    timelineClips: newClips,
    totalDuration,
  };
}
