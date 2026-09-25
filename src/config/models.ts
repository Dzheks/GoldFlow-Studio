export interface GenerationModel {
  id: string;
  name: string; // Название в UI
  code: string; // Внутренний код
  category: 'image' | 'video';
  description: string;
  badge?: string;
  creditCost: number; // Кредиты
  priceRub: number;   // ₽
  unitLabel: string;  // "за картинку" или "за 8 секунд"
  previewImage?: string;
}

export const GENERATION_IMAGE_MODELS: GenerationModel[] = [
  {
    id: 'nano-banana-2-lite',
    name: 'Nano Banana 2 Lite',
    code: 'HARBOR_SEAL',
    category: 'image',
    description: 'Быстрая генерация для черновиков и перебора идей. Разрешение 1K.',
    badge: 'Lite',
    creditCost: 2,
    priceRub: 2,
    unitLabel: 'за картинку',
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    code: 'NARWHAL',
    category: 'image',
    description: 'Основная модель: баланс качества и скорости.',
    badge: 'Основная',
    creditCost: 4,
    priceRub: 4,
    unitLabel: 'за картинку',
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    code: 'GEM_PIX_2',
    category: 'image',
    description: 'Максимальная детализация. Для превью и обложек. Разрешение 2K.',
    badge: 'PRO',
    creditCost: 4,
    priceRub: 4,
    unitLabel: 'за картинку',
  },
];

export const GENERATION_VIDEO_MODELS: GenerationModel[] = [
  {
    id: 'veo-3-1-fast',
    name: 'Veo 3.1 Fast',
    code: 'VEO_3_1_FAST',
    category: 'video',
    description: 'Рабочая лошадка: текст в видео, фото в видео, звук.',
    badge: 'Fast',
    creditCost: 4,
    priceRub: 4,
    unitLabel: 'за 8 секунд',
  },
  {
    id: 'veo-3-1-quality',
    name: 'Veo 3.1 Quality',
    code: 'VEO_3_1_QUALITY',
    category: 'video',
    description: 'Максимум качества, когда кадр идёт в дело.',
    badge: 'Quality',
    creditCost: 6,
    priceRub: 6,
    unitLabel: 'за 8 секунд',
  },
  {
    id: 'gemini-omni-flash',
    name: 'Gemini Omni Flash',
    code: 'GEMINI_OMNI_FLASH',
    category: 'video',
    description: 'Видео с нативным звуком: голоса и персонажи.',
    badge: 'Omni Voice',
    creditCost: 6,
    priceRub: 6,
    unitLabel: 'за 8 секунд',
  },
];

export const GENERATION_MODELS: GenerationModel[] = [
  ...GENERATION_IMAGE_MODELS,
  ...GENERATION_VIDEO_MODELS,
];

export const DEFAULT_MODEL_CODE = 'NARWHAL';

export function getModelByCode(codeOrName: string): GenerationModel {
  return (
    GENERATION_MODELS.find(
      (m) => m.code === codeOrName || m.name === codeOrName || m.id === codeOrName
    ) || GENERATION_IMAGE_MODELS[1] // Nano Banana 2
  );
}
