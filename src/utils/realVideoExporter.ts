/**
 * Real In-Browser Video & Audio Exporter
 * Renders the timeline frame-by-frame via HTMLCanvasElement & Web Audio API MediaRecorder,
 * and downloads a real, playable MP4/WebM video file with sound to user's device.
 */

import { TimelineClip, StoryScene, AspectRatio } from '../types';
import { drawProceduralScene } from './proceduralCanvas';
import { AspectRatioKey, getAspectRatioConfig } from '../config/aspectRatios';
import { ELEVEN_LANGUAGES } from '../types/languages';

export interface ExportProgressCallback {
  (progressPercent: number, statusText: string): void;
}

export interface VideoExportOptions {
  projectName: string;
  clips: TimelineClip[];
  scenes: StoryScene[];
  totalDuration: number;
  aspectRatio: AspectRatioKey;
  fps?: number;
  bgMusicVolume?: number;
  languageId?: string;
  onProgress?: ExportProgressCallback;
  // The real narration mp3 (Lumean/uploaded). Piped into the recorded audio
  // graph so the exported file actually has the user's voiceover instead of
  // just the ambient sine drone.
  narrationAudioUrl?: string;
  // Match the Montage preview settings so what you saw is what you exported.
  showSubtitles?: boolean;
  showInFrameCaption?: boolean;
  autoTransitions?: boolean;
  transitionDuration?: number;
}

export async function exportRealTimelineVideo(options: VideoExportOptions): Promise<Blob> {
  const {
    projectName,
    clips,
    scenes,
    totalDuration,
    aspectRatio,
    fps = 30,
    bgMusicVolume = 0.2,
    languageId = 'ru',
    onProgress,
    narrationAudioUrl,
    showSubtitles = true,
    showInFrameCaption = false,
    autoTransitions = true,
    transitionDuration = 0.5,
  } = options;

  // Determine canvas resolution based on aspect ratio
  const ratioConfig = getAspectRatioConfig(aspectRatio);
  let width = 1280;
  let height = 720;

  if (aspectRatio === '9:16') {
    width = 720;
    height = 1280;
  } else if (aspectRatio === '1:1') {
    width = 1080;
    height = 1080;
  } else if (aspectRatio === '4:3') {
    width = 960;
    height = 720;
  } else if (aspectRatio === '3:4') {
    width = 720;
    height = 960;
  }

  // Create offscreen canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  // Set up Audio Context and Destination
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  let audioCtx: AudioContext | null = null;
  let mediaDest: MediaStreamAudioDestinationNode | null = null;

  try {
    audioCtx = new AudioCtx();
    mediaDest = audioCtx.createMediaStreamDestination();
  } catch (err) {
    console.warn('AudioContext not available for export, continuing video-only', err);
  }

  // Attach the real narration mp3 (if present) plus a very quiet ambient drone
  // to the recorded audio stream. Before, only the sine wave was piped in —
  // so exports were technically "with audio" but had no actual voiceover.
  let narrationAudioEl: HTMLAudioElement | null = null;
  if (audioCtx && mediaDest) {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, audioCtx.currentTime);
      // Ducking: drone stays quiet when narration is present so the voice sits on top.
      const droneLevel = (narrationAudioUrl ? 0.04 : 0.15) * bgMusicVolume;
      gain.gain.setValueAtTime(droneLevel, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(mediaDest);
      osc.start();
    } catch { /* ignore */ }
    if (narrationAudioUrl) {
      try {
        narrationAudioEl = document.createElement('audio');
        narrationAudioEl.src = narrationAudioUrl;
        narrationAudioEl.crossOrigin = 'anonymous';
        narrationAudioEl.preload = 'auto';
        // Route mp3 through Web Audio so it hits the recorder's destination.
        // NOTE: an element passed to createMediaElementSource is muted on
        // ordinary playback; that's fine — its audio still reaches the graph.
        const src = audioCtx.createMediaElementSource(narrationAudioEl);
        const narrationGain = audioCtx.createGain();
        narrationGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
        src.connect(narrationGain);
        narrationGain.connect(mediaDest);
      } catch (err) {
        console.warn('Narration mp3 could not be attached to export audio graph:', err);
        narrationAudioEl = null;
      }
    }
  }

  // Set up MediaStream from Canvas and Audio
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream();

  canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
  if (mediaDest) {
    mediaDest.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
  }

  // Determine best supported MIME type
  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }
  if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
    mimeType = 'video/mp4;codecs=h264,aac';
  } else if (MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 3_500_000,
  });

  const recordedChunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  recorder.start(100);

  const langConfig = ELEVEN_LANGUAGES.find((l) => l.id === languageId) || ELEVEN_LANGUAGES[0];
  const inFrameCaption = showInFrameCaption ? langConfig.sampleCaption : undefined;

  // Real-time render: MediaRecorder captures a live stream, and the narration
  // <audio> element plays back in wall-clock time. So the render loop MUST
  // advance ≈1000/fps ms per frame (setInterval), not as fast as rAF allows —
  // otherwise a 693s script would be rendered in a minute of frames but the
  // audio track would still be 693s and drift wildly out of sync.
  const totalFrames = Math.max(15, Math.ceil(totalDuration * fps));
  const frameIntervalMs = 1000 / fps;
  const videoClipsSorted = clips.filter((c) => c.trackId === 'video').sort((a, b) => a.startTime - b.startTime);

  return new Promise<Blob>((resolve, reject) => {
    let currentFrame = 0;
    let intervalId: number | null = null;
    const startWallClock = performance.now();

    // Start the real narration element (if any) as close to the recorder as
    // possible so audio and video timelines share the same t=0.
    if (narrationAudioEl) {
      narrationAudioEl.currentTime = 0;
      narrationAudioEl.play().catch((err) => {
        console.warn('Narration playback in exporter failed to start:', err);
      });
    }

    const finalize = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      if (narrationAudioEl) narrationAudioEl.pause();
      recorder.onstop = () => {
        if (audioCtx) audioCtx.close().catch(() => {});
        const finalBlob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(finalBlob);
        const link = document.createElement('a');
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        link.href = url;
        link.download = `${projectName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')}_GoldFlow.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 20000);
        resolve(finalBlob);
      };
      recorder.stop();
    };

    const renderFrameAt = (currentTimeSec: number) => {
      // Active video clip at this timeline second.
      const activeVideoClip = videoClipsSorted.find(
        (c) => currentTimeSec >= c.startTime && currentTimeSec < c.startTime + c.duration
      ) || videoClipsSorted[0] || clips[0];
      const activeVoiceClip = clips.find(
        (c) => c.trackId === 'voice' && currentTimeSec >= c.startTime && currentTimeSec < c.startTime + c.duration
      );
      const sceneIndex = activeVideoClip ? videoClipsSorted.indexOf(activeVideoClip) : 0;
      const scene = scenes[sceneIndex] || scenes[0];
      const sceneTime = activeVideoClip ? currentTimeSec - activeVideoClip.startTime : 1.0;
      const sceneDuration = activeVideoClip ? activeVideoClip.duration : 4.0;

      // Cross-fade at the end of the clip (matches the Montage preview).
      let transProgress = 0;
      if (autoTransitions && activeVideoClip && sceneTime > sceneDuration - transitionDuration) {
        transProgress = Math.min(1, (sceneTime - (sceneDuration - transitionDuration)) / transitionDuration);
      }

      // Subtitles: prefer per-cue text on the voice track, else fall back to
      // the current scene's own line — matches the Montage preview so what
      // the user previewed is what they downloaded.
      const subtitleText = showSubtitles
        ? (activeVoiceClip?.text || scene?.description || undefined)
        : undefined;

      drawProceduralScene(ctx, width, height, {
        sceneId: scene?.id || sceneIndex + 1,
        title: scene?.title || activeVideoClip?.name || 'GoldFlow Кадр',
        timeSec: sceneTime,
        durationSec: sceneDuration,
        motionType: scene?.motionType || activeVideoClip?.motion || 'zoom-in',
        transitionProgress: transProgress * 0.75,
        aspectRatio,
        activeSubtitle: subtitleText,
        imageUrl: activeVideoClip?.imageUrl || scene?.generatedImageUrl,
        inFrameCaption,
      });
    };

    intervalId = window.setInterval(() => {
      const elapsed = (performance.now() - startWallClock) / 1000;
      // Prefer the real audio clock when it's playing — keeps video locked to
      // the true narration timeline even if setInterval drifts.
      const currentTimeSec = narrationAudioEl && narrationAudioEl.currentTime > 0
        ? narrationAudioEl.currentTime
        : elapsed;

      if (currentTimeSec >= totalDuration || currentFrame >= totalFrames) {
        finalize();
        return;
      }

      renderFrameAt(currentTimeSec);
      currentFrame++;

      const progressPercent = Math.min(99, Math.round((currentTimeSec / totalDuration) * 100));
      if (onProgress && currentFrame % 4 === 0) {
        onProgress(progressPercent, `Рендеринг ${currentTimeSec.toFixed(1)}с из ${totalDuration.toFixed(1)}с`);
      }
    }, frameIntervalMs);
  });
}
