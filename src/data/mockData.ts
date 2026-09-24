import { CharacterItem, LocationItem, ProjectData, StoryScene, StylePreset, TimelineClip } from '../types';

export const INITIAL_STYLES: StylePreset[] = [
  {
    id: 'none',
    name: 'Без стиля',
    count: 0,
    previewColor: '#1a1816',
    description: 'Оригинальный вид без глобального фильтра',
    accent: '#a8a29e'
  },
  {
    id: 'cinematic',
    name: 'Кинематографичный',
    count: 146,
    previewColor: '#2b2118',
    description: 'Кинематографичный 35мм фильм, тёплый мягкий свет и текстура',
    accent: '#f59e0b'
  },
  {
    id: 'anime',
    name: 'аниме',
    count: 4,
    previewColor: '#241b2f',
    description: 'Современный детальный аниме-арт, насыщенные градиенты',
    accent: '#c084fc'
  },
  {
    id: 'miniature',
    name: 'Миниатюра',
    count: 5,
    previewColor: '#172722',
    description: 'Tilt-shift макро эффект, игрушечный мир, размытие планов',
    accent: '#34d399'
  }
];

export const INITIAL_CHARACTERS: CharacterItem[] = [
  {
    id: 'char-1',
    name: 'Фотограф',
    role: 'A middle-aged street photographer with retro camera',
    prompt: 'Street photographer in worn canvas jacket holding vintage 35mm rangefinder camera, focused look, natural street light',
    avatarColor: '#d97706',
    approved: true
  },
  {
    id: 'char-2',
    name: 'Доктор',
    role: 'A man in his forties with smart spectacles and clipboard',
    prompt: 'Thoughtful physician in dark modern medical coat checking digital clipboard, warm clinic light',
    avatarColor: '#2563eb',
    approved: true
  },
  {
    id: 'char-3',
    name: 'Посетитель',
    role: 'A young man with messenger bag in neutral clothes',
    prompt: 'Curious young man in grey hoodie with canvas messenger bag looking at store showcase, soft dusk lighting',
    avatarColor: '#059669',
    approved: true
  },
  {
    id: 'char-4',
    name: 'Работник',
    role: 'A skilled technician in dark overalls in a tidy workshop',
    prompt: 'Hardworking technician in dark industrial uniform holding precision wrench, focused expression, cinematic backlight',
    avatarColor: '#b45309',
    approved: true
  },
  {
    id: 'char-5',
    name: 'Тренер',
    role: 'Athletic coach in sportswear holding whistle and stopwatch',
    prompt: 'Confident athletic trainer in black athletic polo with stopwatch around neck, modern sports center background',
    avatarColor: '#dc2626',
    approved: true
  },
  {
    id: 'char-6',
    name: 'Мастер',
    role: 'A precision craftsman inspecting intricate clockwork',
    prompt: 'Experienced watchmaker with magnifying eyepiece inspecting fine golden gears at wooden desk, macro focal depth',
    avatarColor: '#7c3aed',
    approved: true
  },
  {
    id: 'char-7',
    name: 'Владелец',
    role: 'Mature self-made entrepreneur in simple tailored shirt',
    prompt: 'Calm business owner in navy linen shirt standing before his busy private car wash facility, sunset lens flare',
    avatarColor: '#4f46e5',
    approved: true
  },
  {
    id: 'char-8',
    name: 'Бухгалтер',
    role: 'Focused finance auditor reviewing physical ledgers',
    prompt: 'Female financial analyst in glasses reviewing thick leather-bound tax ledger under warm bankers lamp',
    avatarColor: '#db2777',
    approved: true
  },
  {
    id: 'char-9',
    name: 'Клиент',
    role: 'Regular satisfied customer receiving finished service',
    prompt: 'Smiling everyday customer picking up crisply packaged suit from dry cleaner counter, clean commercial lighting',
    avatarColor: '#0891b2',
    approved: true
  },
  {
    id: 'char-10',
    name: 'Инспектор',
    role: 'City safety inspector holding tablet checklist',
    prompt: 'Serious city inspector in high-visibility utility vest checking digital tablet checklist in parking structure',
    avatarColor: '#e11d48',
    approved: true
  }
];

export const INITIAL_LOCATIONS: LocationItem[] = [
  {
    id: 'loc-1',
    name: 'Офис',
    type: 'A dark wood back office with banker lamp',
    prompt: 'Moody mahogany back office at dusk, glowing green glass desk lamp, filing cabinets, warm cinematic shadows',
    coverColor: '#362417',
    approved: true
  },
  {
    id: 'loc-2',
    name: 'Магазин',
    type: 'A small unassuming storefront on a rainy street',
    prompt: 'Unassuming corner storefront on rain-washed asphalt sidewalk with amber interior window lights, Leica aesthetic',
    coverColor: '#1c2833',
    approved: true
  },
  {
    id: 'loc-3',
    name: 'Автомойка',
    type: 'An automated car wash tunnel with blue neon lights',
    prompt: 'Long industrial car wash tunnel with soap foam spray, high-pressure mist, striking blue and gold neon tubes',
    coverColor: '#1b3b3a',
    approved: true
  },
  {
    id: 'loc-4',
    name: 'Салон красоты',
    type: 'A modern minimalist barbershop with warm mirrors',
    prompt: 'Sleek dark barber salon with arched illuminated back-lit mirrors, leather chairs, polished concrete floor',
    coverColor: '#2b213a',
    approved: true
  },
  {
    id: 'loc-5',
    name: 'Химчистка',
    type: 'A dry cleaning facility with rotating garment racks',
    prompt: 'Industrial dry cleaning facility with endless motorized overhead conveyor lines of plastic-wrapped clothes',
    coverColor: '#202f3c',
    approved: true
  },
  {
    id: 'loc-6',
    name: 'Паркинг',
    type: 'A multi-level underground concrete parking garage',
    prompt: 'Atmospheric multi-level concrete parking structure with long amber safety lights, deep vanishing perspective',
    coverColor: '#26292b',
    approved: true
  },
  {
    id: 'loc-7',
    name: 'Бар',
    type: 'A quiet vintage corner bar with amber bottles',
    prompt: 'Cozy vintage neighborhood speakeasy bar with back-lit amber liquor bottles, dark brass trim, evening haze',
    coverColor: '#3d2516',
    approved: true
  }
];

export const INITIAL_SCRIPT = `# Ограбление века в Ницце
**Формат:** Документальный клиповый триллер
**Хронометраж:** 1 мин (~6 ключевых планов)
**Аудитория:** Широкая
**Тон:** Кинематографичный, напряжённый саспенс

1984 год. Ницца. Самое охраняемое хранилище на всём побережье.
Никакой стрельбы и шума. Только секундомер, чертежи канализации и абсолютная тишина.
Подземный коллектор прямо под полом депозитария. Стена поддаётся без звука.
Шестьдесят секунд на стальную дверь толщиной в полметра.
Пока датчики тревоги молчали, сумки уже грузились в фургон у моря.
Идеальный план, который не оставил жандармерии ни единой зацепки.`;

export const INITIAL_PROMPTS_TEXT = `1. Ницца, Английская набережная, фасад банка 1984 года, утреннее солнце, кинематографичный план
2. Полутемная мастерская за портом, старинная схема городской канализации на деревянном столе
3. Фургон связи в переулке, секундомер, осциллограф звуковых волн, предельная концентрация
4. Подземный коллектор под хранилищем, гидравлический домкрат раздвигает бетон перекрытия
5. Набережная у старого порта в предрассветных сумерках, парусиновые сумки грузят в багажник
6. Быстроходный катер выходит в открытое море, залитый полуденным солнцем город у подножия Альп`;

export const INITIAL_SCENES: StoryScene[] = [
  {
    id: 1,
    title: 'Фасад банка и набережная',
    duration: 4.5,
    description: '1984 год. Ницца. Самое охраняемое хранилище на всём Лазурном побережье.',
    prompt: 'Ницца, Английская набережная, фасад банка 1984 года, утреннее солнце, кинематографичный план',
    motionType: 'zoom-in',
    transition: 'crossfade'
  },
  {
    id: 2,
    title: 'Чертежи и схема тоннеля',
    duration: 4.0,
    description: 'Полутемная мастерская за портом, старинная схема городской канализации на деревянном столе.',
    prompt: 'Полутемная мастерская за портом, старинная схема городской канализации на деревянном столе',
    motionType: 'pan-left',
    transition: 'crossfade'
  },
  {
    id: 3,
    title: 'Фургон связи и хронограф',
    duration: 3.5,
    description: 'Никакой стрельбы и спешки. Только секундомер, датчики звука и полная тишина.',
    prompt: 'Фургон связи в переулке, секундомер, осциллограф звуковых волн, предельная концентрация',
    motionType: 'zoom-out',
    transition: 'fade-black'
  },
  {
    id: 4,
    title: 'Пробитие перекрытия',
    duration: 4.0,
    description: 'Подземный коллектор прямо под полом депозитария. Стена поддаётся без звука.',
    prompt: 'Подземный коллектор под хранилищем, гидравлический домкрат раздвигает бетон перекрытия',
    motionType: 'static',
    transition: 'crossfade'
  },
  {
    id: 5,
    title: 'Отход через набережную',
    duration: 4.0,
    description: 'Пока датчики молчали, парусиновые сумки уже грузились в багажник фургона.',
    prompt: 'Набережная у старого порта в предрассветных сумерках, парусиновые сумки грузят в багажник',
    motionType: 'pan-right',
    transition: 'crossfade'
  },
  {
    id: 6,
    title: 'Финал в открытом море',
    duration: 4.0,
    description: 'Идеальный план не оставляет следов. Только чистую легенду на сорок лет.',
    prompt: 'Быстроходный катер выходит в открытое море, залитый полуденным солнцем город у подножия Альп',
    motionType: 'zoom-in',
    transition: 'crossfade'
  }
];

export const INITIAL_TIMELINE_CLIPS: TimelineClip[] = [
  // Video track
  {
    id: 'clip-v1',
    trackId: 'video',
    name: '01. Улица и витрина',
    startTime: 0,
    duration: 4.5,
    color: '#d97706',
    motion: 'zoom-in',
    transition: 'crossfade',
    transitionDuration: 0.5
  },
  {
    id: 'clip-v2',
    trackId: 'video',
    name: '02. Стол менеджера',
    startTime: 4.5,
    duration: 4.0,
    color: '#b45309',
    motion: 'pan-left',
    transition: 'crossfade',
    transitionDuration: 0.5
  },
  {
    id: 'clip-v3',
    trackId: 'video',
    name: '03. Чеки и квитанции',
    startTime: 8.5,
    duration: 3.5,
    color: '#92400e',
    motion: 'zoom-out',
    transition: 'fade-black',
    transitionDuration: 0.5
  },
  {
    id: 'clip-v4',
    trackId: 'video',
    name: '04. Механические часы',
    startTime: 12.0,
    duration: 4.0,
    color: '#78350f',
    motion: 'static',
    transition: 'crossfade',
    transitionDuration: 0.5
  },
  {
    id: 'clip-v5',
    trackId: 'video',
    name: '05. Поток прохожих',
    startTime: 16.0,
    duration: 4.0,
    color: '#d97706',
    motion: 'pan-right',
    transition: 'crossfade',
    transitionDuration: 0.5
  },
  {
    id: 'clip-v6',
    trackId: 'video',
    name: '06. Неоновый знак',
    startTime: 20.0,
    duration: 3.8,
    color: '#f59e0b',
    motion: 'zoom-in',
    transition: 'crossfade',
    transitionDuration: 0.5
  },

  // Voice track
  {
    id: 'clip-a1',
    trackId: 'voice',
    name: 'Озвучка: Вступление',
    startTime: 0,
    duration: 8.5,
    color: '#3b82f6',
    volume: 1.0,
    text: 'Есть версия твоего города, которую ты не замечаешь, даже проезжая мимо пять раз в неделю...'
  },
  {
    id: 'clip-a2',
    trackId: 'voice',
    name: 'Озвучка: Скрытые миллионы',
    startTime: 8.5,
    duration: 7.5,
    color: '#2563eb',
    volume: 1.0,
    text: 'Она прячется внутри невзрачных автоматов и запертых дверей, которые приносят миллионы.'
  },
  {
    id: 'clip-a3',
    trackId: 'voice',
    name: 'Озвучка: Топ-10 бизнесов',
    startTime: 16.0,
    duration: 7.8,
    color: '#1d4ed8',
    volume: 1.0,
    text: 'Бизнесы с максимальной отдачей на метр обычно выглядят так, словно не зарабатывают вовсе.'
  },

  // Music track
  {
    id: 'clip-m1',
    trackId: 'music',
    name: 'Фон: Dark Cinematic Lo-Fi 120bpm',
    startTime: 0,
    duration: 23.8,
    color: '#10b981',
    volume: 0.15
  },

  // Titles track
  {
    id: 'clip-t1',
    trackId: 'titles',
    name: 'Плашка: 10 бизнесов на миллион',
    startTime: 0.5,
    duration: 3.5,
    color: '#eab308',
    text: '10 бизнесов, мимо которых ты проходишь каждый день'
  },
  {
    id: 'clip-t2',
    trackId: 'titles',
    name: 'Плашка: Подпишись на канал',
    startTime: 17.0,
    duration: 3.0,
    color: '#ef4444',
    text: '🔔 ПОДПИШИСЬ — новые выпуски каждый вторник'
  }
];

export const INITIAL_PROJECT: ProjectData = {
  id: 'cmt1avcsm000001pasz8de91n',
  name: 'Новый проект',
  createdAt: '23 сентября 2026',
  duration: 0,
  aspectRatio: '16:9',
  preset: 'YouTube — обычное видео',
  fps: 30,
  scenesCount: 0,
  imagesCount: 0,
  scriptText: '',
  scenes: [],
  characters: [],
  locations: [],
  timelineClips: [],
  styleId: 'cinematic',
  customStyles: [],
  heroRefImage: null,
  heroName: '',
  model: 'NARWHAL',
  autoTransitions: true,
  syncWithVoice: true,
  removePauses: false,
  speedUpPlans: false,
  clipHoldDuration: 4.0,
  bgMusicVolume: 0.15,
  transitionDuration: 0.5
};
