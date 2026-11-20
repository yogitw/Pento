export type VisualMode =
  | 'photo-rxking'
  | 'photo-ninjarr'
  | 'photo-satria'
  | 'photo-engine'
  | 'diagram-2t'
  | 'tachometer-rev'
  | 'custom-media';

export type CameraMotion =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'tilt-up'
  | 'tilt-down'
  | 'ken-burns-drift'
  | 'dolly-swing'
  | 'pulse-rev';

export type TransitionStyle = 'crossfade' | 'slide-left' | 'zoom-punch' | 'flash-beat';

export type MotionFxMode = 'clean' | 'embers-smoke' | 'speed-flare';

export type CaptionTheme = 'viral-yellow' | 'clean-white' | 'racing-red';

export type VoiceId = 'Fenrir' | 'Puck' | 'Charon' | 'Kore';

export type StyleMode =
  | 'Edukasi Teknis & Cara Kerja'
  | 'Review Legenda 2-Tak'
  | 'Adu Spek & Karakter Suara'
  | 'Mitos vs Fakta Bengkel';

export interface BikeSpec {
  label: string;
  value: string;
}

export interface CustomMediaAsset {
  url: string;
  kind: 'image' | 'video';
  name: string;
}

export interface SceneItem {
  id: string;
  title: string;
  durationSec: number;
  narration: string;
  caption: string;
  techBadge: string;
  visualMode: VisualMode;
  cameraMotion: CameraMotion;
  accentHex: string;
  audioBase64?: string;
  audioMimeType?: string;
  audioStatus: 'idle' | 'generating' | 'ready' | 'error';
  audioError?: string;
  customMedia?: CustomMediaAsset;
}

export interface StoryboardProject {
  title: string;
  hookText: string;
  bikeLabel: string;
  specs: BikeSpec[];
  scenes: SceneItem[];
  tags: string[];
  description: string;
  transitionStyle?: TransitionStyle;
  motionFx?: MotionFxMode;
}

export interface PromptPreset {
  id: string;
  label: string;
  bikeLabel: string;
  styleMode: StyleMode;
  durationTarget: number;
  prompt: string;
}
