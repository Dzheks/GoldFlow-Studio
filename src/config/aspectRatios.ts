export type AspectRatioKey = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

export interface AspectRatioOption {
  id: AspectRatioKey;
  label: string; // Отображение в UI
  code: string; // Код в запросе (enum Vr / backend)
  width: number;
  height: number;
  cssAspectRatio: string;
  description: string;
}

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    id: '16:9',
    label: '16:9 (Горизонталь)',
    code: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
    width: 1920,
    height: 1080,
    cssAspectRatio: '16 / 9',
    description: 'YouTube, видеоролики, горизонтальные мониторы',
  },
  {
    id: '9:16',
    label: '9:16 (Shorts / Reels)',
    code: 'IMAGE_ASPECT_RATIO_PORTRAIT',
    width: 1080,
    height: 1920,
    cssAspectRatio: '9 / 16',
    description: 'YouTube Shorts, Reels, TikTok, мобильный экран',
  },
  {
    id: '1:1',
    label: '1:1 (Квадрат)',
    code: 'IMAGE_ASPECT_RATIO_SQUARE',
    width: 1080,
    height: 1080,
    cssAspectRatio: '1 / 1',
    description: 'Квадратный формат для ленты и обложек',
  },
  {
    id: '4:3',
    label: '4:3 (Классика)',
    code: 'IMAGE_ASPECT_RATIO_FOUR_BY_THREE',
    width: 1440,
    height: 1080,
    cssAspectRatio: '4 / 3',
    description: 'Классическое соотношение сторон (ретро, ТВ, планшеты)',
  },
  {
    id: '3:4',
    label: '3:4 (Портрет)',
    code: 'IMAGE_ASPECT_RATIO_THREE_BY_FOUR',
    width: 1080,
    height: 1440,
    cssAspectRatio: '3 / 4',
    description: 'Вертикальный фото-формат для карточек',
  },
];

export const DEFAULT_ASPECT_RATIO: AspectRatioKey = '16:9';

export function getAspectRatioConfig(ratioOrCode: string): AspectRatioOption {
  return (
    ASPECT_RATIO_OPTIONS.find(
      (r) => r.id === ratioOrCode || r.code === ratioOrCode
    ) || ASPECT_RATIO_OPTIONS[0]
  );
}
