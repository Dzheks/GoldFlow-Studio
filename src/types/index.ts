export type ViewMode = 
  | 'dashboard'
  | 'factory'
  | 'montage'
  | 'voice'
  | 'images'
  | 'video'
  | 'assistant'
  | 'preview'
  | 'my-works';

export interface StylePreset {
  id: string;
  name: string;
  count: number;
  previewColor: string;
  description: string;
  accent: string;
  thumbnailUrl?: string;
  // Custom user-created styles: reference images actually sent as inlineData
  // to the image model on every generation for this style, plus an optional
  // negative prompt appended to every prompt.
  referenceImages?: { base64: string; mimeType: string }[];
  negativePrompt?: string;
}

export interface CharacterItem {
  id: string;
  name: string;
  role: string;
  prompt: string;
  avatarColor: string;
  customImage?: string;
  approved: boolean;
}

export interface LocationItem {
  id: string;
  name: string;
  type: string;
  prompt: string;
  coverColor: string;
  customImage?: string;
  approved: boolean;
}

export interface StoryScene {
  id: number;
  title: string;
  duration: number; // in seconds
  description: string;
  prompt: string;
  characters?: string[];
  location?: string;
  generatedImageUrl?: string;
  videoUrl?: string;
  motionType: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
  transition: 'crossfade' | 'fade-black' | 'zoom' | 'cut';
}

export interface TimelineClip {
  id: string;
  trackId: 'video' | 'voice' | 'music' | 'titles';
  name: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  color: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  text?: string;
  motion?: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
  transition?: 'crossfade' | 'fade-black' | 'zoom' | 'cut';
  transitionDuration?: number;
  volume?: number;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  duration: number; // seconds
  aspectRatio: AspectRatio;
  preset: string;
  fps: number;
  scenesCount: number;
  imagesCount: number;
  scriptText: string;
  narrationAudioUrl?: string; // real Lumean TTS mp3 for the whole script, once synthesized
  scenes: StoryScene[];
  characters: CharacterItem[];
  locations: LocationItem[];
  timelineClips: TimelineClip[];
  styleId: string;
  customStyles: StylePreset[];
  heroRefImage?: { base64: string; mimeType: string } | null;
  heroName?: string;
  model: string;
  autoTransitions: boolean;
  syncWithVoice: boolean;
  removePauses: boolean;
  speedUpPlans: boolean;
  clipHoldDuration: number;
  bgMusicVolume: number;
  transitionDuration: number;
}
