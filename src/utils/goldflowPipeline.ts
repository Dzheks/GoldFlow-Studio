import { StoryScene, TimelineClip } from '../types';
import { DirectorNineFields, compileNineFieldsPrompt } from '../types/goldflow';
import { generateSceneThumbnailDataUrl } from './proceduralCanvas';
import { ELEVEN_LANGUAGES } from '../types/languages';
import { AspectRatioKey } from '../config/aspectRatios';
import { generateScriptReal, generateImageReal } from '../services/geminiPipelineClient';

export interface ArchitectBlock {
  blockNum: number;
  title: string;
  objective: string;      // О чём блок
  mandatoryEnd: string;   // Чем обязан кончиться
  pacing: string;         // Темп и саспенс
}

export interface HeroReference {
  name: string;
  role: string;
  appearance: string;
  clothing: string;
  keyFeature: string;
  locationMaster: string;
  thumbnailUrl: string;
}

export interface GeneratedGoldFlowPipeline {
  architectBlocks: ArchitectBlock[];
  heroMaster: HeroReference;
  scenes: StoryScene[];
  scriptText: string;
  timelineClips: TimelineClip[];
  totalDuration: number;
}

interface NarrativeTheme {
  isNigeria: boolean;
  settingCity: string;
  settingCountry: string;
  period: string;
  heroName: string;
  heroRole: string;
  heroDesc: string;
  heroClothes: string;
  heroFeature: string;
  bankLocation: string;
  blocks: {
    title: string;
    objective: string;
    mandatoryEnd: string;
    pacing: string;
    scriptLine: string;
    fields: DirectorNineFields;
    motion: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
  }[];
}

/**
 * Builds thematic narrative structure dynamically based on user prompt or custom text.
 */
function analyzeTopicAndBuildTheme(input: string, customTextLines?: string[]): NarrativeTheme {
  const lower = input.toLowerCase();
  const isNigeria = lower.includes('нигери') || lower.includes('лагос') || lower.includes('nigeria') || lower.includes('lagos');
  const isPlane = lower.includes('самолет') || lower.includes('рейс') || lower.includes('тихий океан') || lower.includes('полет');
  const isCoffee = lower.includes('кофе') || lower.includes('напиток') || lower.includes('зерна');
  const isCyber = lower.includes('хакер') || lower.includes('кибер') || lower.includes('код') || lower.includes('сервер');
  const isCar = lower.includes('авто') || lower.includes('машин') || lower.includes('спорткар') || lower.includes('гонк') || lower.includes('дрифт');

  if (isNigeria) {
    return {
      isNigeria: true,
      settingCity: 'Лагос',
      settingCountry: 'Нигерия',
      period: '1990-е / жара и шум мегаполиса',
      heroName: 'Эммануэль Окоро',
      heroRole: 'Организатор и аналитик',
      heroDesc: 'Высокий нигериец 36 лет, проницательный взгляд, аккуратная бородка',
      heroClothes: 'Тёмно-синяя хлопковая рубашка с закатанными рукавами, кожаные часы',
      heroFeature: 'Тонкий шрам над левой бровью, хладнокровная выдержка',
      bankLocation: 'Центральный коммерческий банк на Брод-стрит, остров Лагос',
      blocks: [
        {
          title: 'Блок 1 · Экспозиция и остров Лагос',
          objective: 'Ввести зрителя в колорит раскалённого Лагоса, шум улицы Брод-стрит и неприступный фасад колониального банка.',
          mandatoryEnd: 'Камера фиксирует главный вход банка сквозь поток жёлтых маршруток «Данфо».',
          pacing: 'Умеренный саспенс, нарастающее напряжение',
          scriptLine: customTextLines?.[0] || 'Лагос. Полдень. Сорок градусов в тени, и самый охраняемый сейф Западной Африки {{pause=0.8s}} прямо посреди раскалённой улицы Брод-стрит.',
          fields: {
            lens: 'Широкий 24 мм Anamorphic, уличная перспектива',
            action: 'Эммануэль наблюдает за сменой охраны сквозь окно кафе напротив',
            moment: 'Солнечный блик скользит по циферблату наручных часов',
            foreground: 'Стеклянный запотевший стакан с ледяной водой на столе',
            location: 'Лагос, остров Лагос, улица Брод-стрит у здания банка',
            background: 'Поток жёлтых микроавтобусов «Данфо» и уличные торговцы',
            texture: 'Раскалённый пыльный асфальт, жалюзи, выцветшие вывески',
            light: 'Яростное экваториальное солнце, слепящие блики и густые тени',
            mood: 'Жара, шум большого африканского города, скрытая концентрация',
          },
          motion: 'zoom-in',
        },
        {
          title: 'Блок 2 · Схема и резервный генератор',
          objective: 'Показать инженерную уязвимость здания: центральное электричество отключается, запуск дизеля создаёт слепую зону в 90 секунд.',
          mandatoryEnd: 'Чертёж проводки генератора совпадает с точным моментом отключения питания района.',
          pacing: 'Интеллектуальный расчет, акцент на детали',
          scriptLine: customTextLines?.[1] || 'В Нигерии свет гаснет трижды в день. Но когда отключается городская сеть, автоматика ждёт ровно девяносто секунд до старта дизеля.',
          fields: {
            lens: '50 мм f/1.2 с малой глубиной резкости',
            action: 'Палец в кожаной перчатке обводит на синьке кабель аварийного генератора',
            moment: 'За секунду до щелчка портативного радиомодуля',
            foreground: 'Механический таймер, чашка чёрного чая и паяльник',
            location: 'Подвальная мастерская в квартале Икеджа',
            background: 'Стены с наклеенными фотографиями датчиков тревоги и графиками смен',
            texture: 'Грубый бетон, пожелтевшая калька, медная оплётка кабелей',
            light: 'Одинокая лампа накаливания над верстаком, глубокий полумрак вокруг',
            mood: 'Абсолютный математический расчет без права на осечку',
          },
          motion: 'pan-left',
        },
        {
          title: 'Блок 3 · Проникновение под шумом ливня',
          objective: 'Начало операции: тропический ливень глушит звук, команда преодолевает внешний периметр охраны.',
          mandatoryEnd: 'Группа внутри вентиляционной шахты депозитария без поднятия тревоги.',
          pacing: 'Высокое напряжение, динамичное действие',
          scriptLine: customTextLines?.[2] || 'Сезон дождей пришёл вовремя. Тропический ливень глушит любой скрежет, а охрана укрывается под навесом проходной.',
          fields: {
            lens: '35 мм кинематографичный репортажный',
            action: 'Два человека в спецовках электросети поднимают решётку дренажного люка',
            moment: 'Капли дождя разбиваются о стальной обод люка в свете молнии',
            foreground: 'Стена воды тропического дождя и потоки мутной воды под ногами',
            location: 'Служебный переулок за зданием банка на Брод-стрит',
            background: 'Тёмный массивный кирпичный фасад хранилища под потоками воды',
            texture: 'Мокрый тёмный кирпич, стекающие струи, ржавый металл люка',
            light: 'Вспышка далёкой грозовой молнии и тусклый фонарь проходной',
            mood: 'Опасность на грани разоблачения, адреналин',
          },
          motion: 'zoom-in',
        },
        {
          title: 'Блок 4 · Кульминация и стальные ячейки',
          objective: 'Вскрытие главного сейфового депозитария с помощью бесшумного термического гидравлического клина.',
          mandatoryEnd: 'Массивная бронированная дверь открыта, ячейки с наличными и золотом доступны.',
          pacing: 'Пик напряжения, обратный отсчёт секунд',
          scriptLine: customTextLines?.[3] || 'Никакой взрывчатки. Гидравлический пресс и алмазный бур обходят замки Chubbs за четыре минуты без единого выстрела.',
          fields: {
            lens: '85 мм крупный план с акцентом на фактуру стали',
            action: 'Эммануэль аккуратно извлекает цилиндр замка хранилища',
            moment: 'Тяжёлый ригель с тихим щелчком выходит из паза',
            foreground: 'Искры от алмазного напыления и струйка серого дыма',
            location: 'Главное подземное хранилище банка, глубина 6 метров',
            background: 'Стены из матовой нержавеющей стали с сотнями депозитных ячеек',
            texture: 'Фрезерованная броневая сталь, резиновые уплотнители, латунные ключи',
            light: 'Холодный направленный луч налобного фонаря, глубокие тени в углах',
            mood: 'Хирургическая точность, триумф мастерства',
          },
          motion: 'pan-right',
        },
        {
          title: 'Блок 5 · Отход через лагуну Лагоса',
          objective: 'Побег с грузом: не через пробки города, а по воде лагуны Лагоса на деревянной скоростной лодке.',
          mandatoryEnd: 'Полицейские сирены застревают в уличной пробке, пока лодка набирает ход.',
          pacing: 'Облегчение, динамичный рывок на свободу',
          scriptLine: customTextLines?.[4] || 'Пока полиция пробиралась сквозь мёртвую пробку моста Картера, три парусиновые сумки уже легли на дно моторной лодки в лагуне.',
          fields: {
            lens: '35 мм динамичный трекинг с борта катера',
            action: 'Моторная лодка рассекает тёмные воды лагуны Лагоса на полной скорости',
            moment: 'Эммануэль оглядывается на удаляющиеся огни высоток Брод-стрит',
            foreground: 'Белый пенный бурун от мотора и парусиновые мешки у борта',
            location: 'Лагуна Лагоса, между островом и материком',
            background: 'Силуэты ночного Лагоса, портовые краны и свет моста',
            texture: 'Тёмная маслянистая вода, солёные брызги, потертое дерево лодки',
            light: 'Лунный свет на ряби воды и янтарные огни причала на горизонте',
            mood: 'Освобождение, ощущение безупречно выполненного плана',
          },
          motion: 'zoom-out',
        },
        {
          title: 'Блок 6 · Финал и легенда',
          objective: 'Итог и кинематографическая развязка: ни единого пострадавшего, легенда на десятилетия.',
          mandatoryEnd: 'Кадр растворяется в рассветном океанском горизонте.',
          pacing: 'Глубокий философский финал, послевкусие победы',
          scriptLine: customTextLines?.[5] || 'Идеальное дело помнят не по шуму, а по тишине, которая остаётся после. Ни капли крови, ни единого пойманного.',
          fields: {
            lens: '50 мм классический, чистая кинематографичная панорама',
            action: 'Силуэт героя на рассветном песчаном пляже Атлантики',
            moment: 'Первый луч утреннего солнца касается океанской волны',
            foreground: 'Золотистый песок атлантического побережья, ракушки',
            location: 'Пляж Тарква-Бей у выхода в Гвинейский залив',
            background: 'Бескрайний Атлантический океан в рассветной дымке',
            texture: 'Мягкий влажный песок, морская пена, свежий морской воздух',
            light: 'Первые лучи тёплого рассвета, нежно-розовое и золотое небо',
            mood: 'Чистый триумф, свобода, рождение кинематографичной легенды',
          },
          motion: 'zoom-in',
        },
      ],
    };
  }

  // Generic or custom topic fallback with high cinematic quality
  const topicLabel = input.trim() || 'Кинематографичная история';
  return {
    isNigeria: false,
    settingCity: isCar ? 'Монте-Карло' : isPlane ? 'Тихий океан' : isCoffee ? 'Стамбул' : 'Европа',
    settingCountry: 'Мир',
    period: 'Современность / Ретро',
    heroName: 'Алекс Вэнс',
    heroRole: 'Главный протагонист',
    heroDesc: 'Мужчина 35 лет, сосредоточенный взгляд, уверенные точные движения',
    heroClothes: 'Тёмно-графитовое пальто, строгий свитер, механические часы',
    heroFeature: 'Спокойный пронизывающий взгляд профессионала',
    bankLocation: 'Архитектурный комплекс в центре исторического города',
    blocks: [
      {
        title: 'Блок 1 · Экспозиция и масштаб',
        objective: 'Задать масштаб происходящего, окружение и центральный вопрос истории.',
        mandatoryEnd: 'Зритель видит главный объект и осознаёт сложность вызова.',
        pacing: 'Спокойная уверенность, кинематографичный размах',
        scriptLine: customTextLines?.[0] || `Каждая великая история начинается там, где обычный расчет уступает место безупречной дерзости.`,
        fields: {
          lens: '35 мм Anamorphic, утренний золотой свет',
          action: 'Главный герой наблюдает за объектом с открытой террасы',
          moment: 'Первый взгляд на горизонт перед началом событий',
          foreground: 'Каменный парапет, чашка эспрессо, раскрытый блокнот',
          location: 'Панорамная видовая площадка над городом',
          background: 'Утренний город в лёгкой туманной дымке',
          texture: 'Холодный гранит, полированное стекло, утренний туман',
          light: 'Низкое золотое солнце, мягкие длинные тени',
          mood: 'Предвкушение большого события',
        },
        motion: 'zoom-in',
      },
      {
        title: 'Блок 2 · Завязка и скрытая деталь',
        objective: 'Раскрыть ключевой механизм или секрет, который упускали все остальные.',
        mandatoryEnd: 'Найден ключ к решению неприступной задачи.',
        pacing: 'Интеллектуальный фокус на деталях',
        scriptLine: customTextLines?.[1] || `Большинство ищет сложные решения там, где достаточно увидеть одну незаметную брешь в системе.`,
        fields: {
          lens: '50 мм f/1.4 макро, акцент на текстуру',
          action: 'Рука поворачивает ключ или настраивает точный прибор',
          moment: 'Тонкая регулировка за мгновение до срабатывания механизма',
          foreground: 'Прецизионные инструменты, латунный циркуль, увеличительное стекло',
          location: 'Кабинет аналитика с картами и чертежами',
          background: 'Книжные полки и архивные чертежи на стенах',
          texture: 'Старая чертёжная бумага, матированная сталь, дерево',
          light: 'Направленная настольная лампа, тёплый конус света в полумраке',
          mood: 'Абсолютная концентрация мысли',
        },
        motion: 'pan-left',
      },
      {
        title: 'Блок 3 · Подготовка и точка невозврата',
        objective: 'Показать синхронизацию и запуск плана в действие.',
        mandatoryEnd: 'Все системы активированы, обратный отсчёт пошёл.',
        pacing: 'Нарастающий ритм, собранность',
        scriptLine: customTextLines?.[2] || `Когда стрелка доходит до двенадцати, сомнения выключаются. Остаётся только тайминг и дисциплина.`,
        fields: {
          lens: '85 мм кинолинза, малая глубина резкости',
          action: 'Сверка хронографа и последний кивок напарнику',
          moment: 'Секундная стрелка делает решающий шаг',
          foreground: 'Швейцарский хронометр на кожаном ремешке крупно',
          location: 'Зона подготовки перед главным входом',
          background: 'Огни приборной панели и мерцающие датчики',
          texture: 'Тёмная матовая ткань, сапфировое стекло, холодный металл',
          light: 'Контрастные боковые блики, кинематографичный саспенс',
          mood: 'Предельная собранность перед прыжком',
        },
        motion: 'zoom-out',
      },
      {
        title: 'Блок 4 · Кульминация и прорыв',
        objective: 'Кульминационный момент: преодоление главного препятствия на грани фола.',
        mandatoryEnd: 'Цель достигнута, замок или рубеж пройден.',
        pacing: 'Пик напряжения, максимальная динамика',
        scriptLine: customTextLines?.[3] || `Секунда на принятие решения. Никакого страха — только точный расчёт, выверенный до миллиметра.`,
        fields: {
          lens: '28 мм динамичный ракурс снизу',
          action: 'Стремительное движение к цели сквозь защитные рубежи',
          moment: 'За долю секунды до окончательного успеха',
          foreground: 'Сноп микро-искр или блик линзы на стекле',
          location: 'Сердце объекта, главное хранилище или пункт управления',
          background: 'Массивные стальные двери и ряды контрольных огней',
          texture: 'Тяжёлая литая броня, шлифованный титан, стекло',
          light: 'Резкий контровой свет, глубокие кинематографичные тени',
          mood: 'Высшее напряжение сил, триумф воли',
        },
        motion: 'zoom-in',
      },
      {
        title: 'Блок 5 · Развязка и отрыв',
        objective: 'Показать безупречный выход и исчезновение без единого следа.',
        mandatoryEnd: 'Герои вне зоны досягаемости, преследователи остаются ни с чем.',
        pacing: 'Стремительное облегчение, скорость',
        scriptLine: customTextLines?.[4] || `Пока охрана пыталась понять, что произошло, город уже поглотил любые следы операции.`,
        fields: {
          lens: '40 мм репортажная оптика, кинематографичный трекинг',
          action: 'Автомобиль растворяется в вечернем городском потоке',
          moment: 'Задние габаритные огни скрываются за поворотом набережной',
          foreground: 'Мокрый асфальт с отражением неоновых вывесок',
          location: 'Вечерний скоростной автобан вдоль береговой линии',
          background: 'Панорама ночного города с тысячами огней',
          texture: 'Блестящий лак кузова, капли дождя на лобовом стекле',
          light: 'Красные и янтарные полосы автомобильного света в сумерках',
          mood: 'Чистый отрыв, возвращение контроля',
        },
        motion: 'pan-right',
      },
      {
        title: 'Блок 6 · Финал и послевкусие',
        objective: 'Завершить историю красивой и запоминающейся финальной мыслью.',
        mandatoryEnd: 'Фильм ставит точку сильной фразой, готовой к репостам и просмотру.',
        pacing: 'Глубокий философский финал, тишина после бури',
        scriptLine: customTextLines?.[5] || `Потому что настоящие шедевры создаются тихо, а говорят о них годами.`,
        fields: {
          lens: '50 мм классический полнокадровый объектив',
          action: 'Герой смотрит на закат над открытым морским горизонтом',
          moment: 'Солнце касается кромки воды, вспышка зелёного луча',
          foreground: 'Тихая водная гладь, лёгкая рябь волн',
          location: 'Открытое побережье на краю света',
          background: 'Бескрайнее закатное небо от золотого к индиго',
          texture: 'Тёплый вечерний бриз, шёпот волн, спокойствие',
          light: 'Последние лучи золотого часа, волшебный тёплый градиент',
          mood: 'Полная свобода, кинематографичный катарсис',
        },
        motion: 'zoom-out',
      },
    ],
  };
}

/**
 * The Real Complete Automated 6-Stage Pipeline Generator:
 * 01 — Архитектор строит скелет (блочная композиция)
 * 02 — Сценарист пишет по блокам (закадровый текст)
 * 03 — Раскадровщик придумывает кадр на строку (по 9 полям)
 * 04 — Эталоны держат героев (мастер-образцы персонажа и локации)
 * 05 — Кадры оживают (движение камеры, анимация)
 * 06 — Монтаж кладётся по словам озвучки (разметка таймингов и таймлайн)
 */
export function generateGoldflowPipeline(
  topicPrompt: string,
  heroNameOverride?: string,
  languageId: string = 'ru',
  customFullScript?: string
): GeneratedGoldFlowPipeline {
  const cleanPrompt = topicPrompt.trim() || 'ролик про ограбление банка в Нигерии';
  const langConfig = ELEVEN_LANGUAGES.find((l) => l.id === languageId) || ELEVEN_LANGUAGES[0];

  // If user provided custom full text, split into non-empty sentences/paragraphs
  let customTextLines: string[] | undefined = undefined;
  if (customFullScript && customFullScript.trim().length > 20) {
    const lines = customFullScript
      .split(/\n+|\.\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    if (lines.length >= 3) {
      customTextLines = lines;
    }
  }

  // 1. Analyze topic & Build Narrative Theme
  const theme = analyzeTopicAndBuildTheme(cleanPrompt, customTextLines);
  const effectiveHeroName = heroNameOverride || theme.heroName;

  // STAGE 01: Архитектор строит скелет
  const architectBlocks: ArchitectBlock[] = theme.blocks.map((b, idx) => ({
    blockNum: idx + 1,
    title: b.title,
    objective: b.objective,
    mandatoryEnd: b.mandatoryEnd,
    pacing: b.pacing,
  }));

  // STAGE 04: Эталон героя
  const heroMaster: HeroReference = {
    name: effectiveHeroName,
    role: theme.heroRole,
    appearance: theme.heroDesc,
    clothing: theme.heroClothes,
    keyFeature: theme.heroFeature,
    locationMaster: theme.bankLocation,
    thumbnailUrl: generateSceneThumbnailDataUrl(
      1,
      `Эталон: ${effectiveHeroName}`,
      `Портрет героя ${effectiveHeroName}, ${theme.heroDesc}, одежда: ${theme.heroClothes}, освещение: кинематографичное, 85mm портрет`,
      '16:9',
      'cinematic'
    ),
  };

  // STAGE 02 & 03: Сценарист пишет по блокам & Раскадровщик придумывает кадр на строку по 9 полям
  const scenes: StoryScene[] = theme.blocks.map((block, idx) => {
    const sceneId = idx + 1;
    const prompt = compileNineFieldsPrompt(block.fields, effectiveHeroName);

    // Calculate natural duration based on script length (average reading speed: 120-140 words/min = ~2 words/sec + 1s pause)
    const wordCount = block.scriptLine.split(/\s+/).length;
    const calculatedDuration = Math.max(3.5, Math.min(8.0, Number((wordCount * 0.45 + 1.2).toFixed(1))));

    const generatedImageUrl = generateSceneThumbnailDataUrl(
      sceneId,
      block.title,
      prompt,
      '16:9',
      'cinematic'
    );

    return {
      id: sceneId,
      title: block.title,
      duration: calculatedDuration,
      description: block.scriptLine,
      prompt,
      motionType: block.motion,
      transition: 'crossfade',
      generatedImageUrl,
    };
  });

  // STAGE 02: Полный текст сценария
  const scriptText = theme.blocks.map((b) => b.scriptLine).join('\n\n');

  // STAGE 05 & 06: Кадры оживают & Монтаж кладётся по словам озвучки
  let currentStart = 0;
  const timelineClips: TimelineClip[] = [];

  // Video track: each scene laid out exactly for its calculated speech duration
  scenes.forEach((sc, idx) => {
    const block = theme.blocks[idx];
    timelineClips.push({
      id: `clip-video-${sc.id}`,
      trackId: 'video',
      name: sc.title,
      startTime: Number(currentStart.toFixed(2)),
      duration: sc.duration,
      color: '#d97706',
      imageUrl: sc.generatedImageUrl,
      text: sc.description,
      motion: block.motion,
      transition: 'crossfade',
      transitionDuration: 0.5,
    });
    currentStart += sc.duration;
  });

  const totalDuration = Number(currentStart.toFixed(2));

  // Voice track: aligned accurately under each phrase
  let voiceStart = 0;
  scenes.forEach((sc, idx) => {
    timelineClips.push({
      id: `clip-voice-${sc.id}`,
      trackId: 'voice',
      name: `Фраза ${idx + 1}: ${sc.description.slice(0, 24)}...`,
      startTime: Number(voiceStart.toFixed(2)),
      duration: sc.duration,
      color: '#3b82f6',
      text: sc.description,
      volume: 1.0,
    });
    voiceStart += sc.duration;
  });

  // Music & Atmosphere track
  timelineClips.push({
    id: `clip-music-master`,
    trackId: 'music',
    name: theme.isNigeria
      ? 'Саундтрек: Атмосферный африканский перкуссионный саспенс'
      : 'Саундтрек: Кинематографичный эмбиент & саспенс',
    startTime: 0,
    duration: totalDuration,
    color: '#10b981',
    volume: 0.25,
  });

  // Titles track
  timelineClips.push({
    id: `clip-titles-1`,
    trackId: 'titles',
    name: theme.isNigeria ? 'Титры: ЛАГОС · 1990' : 'Титры: КИНОПРОЕКТ',
    startTime: 0.5,
    duration: 3.5,
    color: '#8b5cf6',
    text: theme.isNigeria ? 'ЛАГОС · ОСТРОВ ЛАГОС · БРОД-СТРИТ' : cleanPrompt.toUpperCase(),
  });

  return {
    architectBlocks,
    heroMaster,
    scenes,
    scriptText,
    timelineClips,
    totalDuration,
  };
}

/**
 * Assembles timeline clips (video/voice/music/titles tracks) from finished scenes.
 * Shared by both the demo template pipeline and the real Gemini-backed pipeline.
 */
function assembleTimelineFromScenes(
  scenes: StoryScene[],
  titleText: string,
  musicLabel: string
): { timelineClips: TimelineClip[]; totalDuration: number } {
  const timelineClips: TimelineClip[] = [];
  let currentStart = 0;

  scenes.forEach((sc) => {
    timelineClips.push({
      id: `clip-video-${sc.id}`,
      trackId: 'video',
      name: sc.title,
      startTime: Number(currentStart.toFixed(2)),
      duration: sc.duration,
      color: '#d97706',
      imageUrl: sc.generatedImageUrl,
      text: sc.description,
      motion: sc.motionType,
      transition: 'crossfade',
      transitionDuration: 0.5,
    });
    currentStart += sc.duration;
  });

  const totalDuration = Number(currentStart.toFixed(2));

  let voiceStart = 0;
  scenes.forEach((sc, idx) => {
    timelineClips.push({
      id: `clip-voice-${sc.id}`,
      trackId: 'voice',
      name: `Фраза ${idx + 1}: ${sc.description.slice(0, 24)}...`,
      startTime: Number(voiceStart.toFixed(2)),
      duration: sc.duration,
      color: '#3b82f6',
      text: sc.description,
      volume: 1.0,
    });
    voiceStart += sc.duration;
  });

  timelineClips.push({
    id: 'clip-music-master',
    trackId: 'music',
    name: musicLabel,
    startTime: 0,
    duration: totalDuration,
    color: '#10b981',
    volume: 0.25,
  });

  timelineClips.push({
    id: 'clip-titles-1',
    trackId: 'titles',
    name: `Титры: ${titleText.slice(0, 40)}`,
    startTime: 0.5,
    duration: 3.5,
    color: '#8b5cf6',
    text: titleText.toUpperCase(),
  });

  return { timelineClips, totalDuration };
}

/**
 * The REAL automated 6-stage pipeline: calls Gemini for script/storyboard (stages 01-03)
 * and Nano Banana for hero + scene images (stages 04-05), then assembles the timeline (06).
 * Falls back to the deterministic demo template (generateGoldflowPipeline) if no
 * GEMINI_API_KEY is configured on the server or the API call fails.
 */
export async function generateGoldflowPipelineAsync(
  topicPrompt: string,
  heroNameOverride: string | undefined,
  languageId: string,
  customFullScript: string | undefined,
  selectedRatio: AspectRatioKey,
  selectedModelCode: string,
  onProgress: (stageIndex: number, message: string) => void
): Promise<{ pipeline: GeneratedGoldFlowPipeline; isSimulated: boolean; error?: string }> {
  let scriptLines: string[] | undefined;
  if (customFullScript && customFullScript.trim().length > 20) {
    const lines = customFullScript
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    if (lines.length >= 2) scriptLines = lines;
  }

  onProgress(0, '01–03 — Архитектор и сценарист пишут сюжет и раскадровку (Gemini)...');
  const scriptRes = await generateScriptReal({
    mode: scriptLines ? 'custom' : 'auto',
    topicPrompt,
    scriptLines,
    heroOverride: heroNameOverride,
    language: languageId,
  });

  if (scriptRes.isSimulated || !scriptRes.blocks?.length || !scriptRes.heroMaster) {
    const demo = generateGoldflowPipeline(topicPrompt, heroNameOverride, languageId, customFullScript);
    return { pipeline: demo, isSimulated: true, error: scriptRes.error };
  }

  const blocks = scriptRes.blocks;
  const heroInfo = scriptRes.heroMaster;

  onProgress(3, '04 — Генерация эталонного изображения героя (Flow / Nano Banana)...');
  const heroPrompt = `Портрет героя ${heroInfo.name}, ${heroInfo.appearance}, одежда: ${heroInfo.clothing}, ключевая примета: ${heroInfo.keyFeature}. Кинематографичное освещение, 85mm портрет, единый визуальный стиль всей серии.`;
  const heroImg = await generateImageReal({
    prompt: heroPrompt,
    modelCode: selectedModelCode,
    aspectRatio: '1:1',
  });
  const heroThumb = heroImg.imageBase64
    ? `data:${heroImg.mimeType};base64,${heroImg.imageBase64}`
    : generateSceneThumbnailDataUrl(1, `Эталон: ${heroInfo.name}`, heroPrompt, '16:9', 'cinematic');

  const heroMaster: HeroReference = {
    name: heroInfo.name,
    role: heroInfo.role,
    appearance: heroInfo.appearance,
    clothing: heroInfo.clothing,
    keyFeature: heroInfo.keyFeature,
    locationMaster: heroInfo.locationMaster,
    thumbnailUrl: heroThumb,
  };

  const scenes: StoryScene[] = [];
  let anySceneSimulated = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    onProgress(4, `05 — Генерация кадра ${i + 1} из ${blocks.length} (Flow / Nano Banana)...`);

    const prompt = compileNineFieldsPrompt(block.nineFields, heroMaster.name);
    const imgRes = await generateImageReal({
      prompt,
      modelCode: selectedModelCode,
      aspectRatio: selectedRatio,
      referenceImageBase64: heroImg.imageBase64,
      referenceMime: heroImg.mimeType,
    });

    if (imgRes.isSimulated) anySceneSimulated = true;

    const generatedImageUrl = imgRes.imageBase64
      ? `data:${imgRes.mimeType};base64,${imgRes.imageBase64}`
      : generateSceneThumbnailDataUrl(i + 1, block.title, prompt, selectedRatio, 'cinematic');

    const wordCount = block.scriptLine.split(/\s+/).length;
    const calculatedDuration = Math.max(3.5, Math.min(8.0, Number((wordCount * 0.45 + 1.2).toFixed(1))));

    scenes.push({
      id: i + 1,
      title: block.title,
      duration: calculatedDuration,
      description: block.scriptLine,
      prompt,
      motionType: block.motionType,
      transition: 'crossfade',
      generatedImageUrl,
    });
  }

  onProgress(5, '06 — Сборка таймлайна под озвучку...');
  const architectBlocks: ArchitectBlock[] = blocks.map((b, idx) => ({
    blockNum: idx + 1,
    title: b.title,
    objective: b.objective,
    mandatoryEnd: b.mandatoryEnd,
    pacing: b.pacing,
  }));

  const scriptText = blocks.map((b) => b.scriptLine).join('\n\n');
  const { timelineClips, totalDuration } = assembleTimelineFromScenes(
    scenes,
    topicPrompt || heroMaster.name,
    'Саундтрек: сгенерированная сюжетная линия (Gemini)'
  );

  return {
    pipeline: { architectBlocks, heroMaster, scenes, scriptText, timelineClips, totalDuration },
    isSimulated: anySceneSimulated,
  };
}
