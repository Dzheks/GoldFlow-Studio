/**
 * Smart Script-to-Prompt and Topic-to-Script Generator
 * Converts any user topic or custom script into synchronized visual prompts.
 */

export interface ScriptPromptPair {
  sceneId: number;
  title: string;
  voiceText: string;
  promptText: string;
  duration: number;
  motionType: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
}

export const QUICK_TOPIC_PRESETS = [
  {
    id: 'heist',
    label: '🏦 Ограбление банка в Ницце',
    topic: '1984 год. Ограбление самого охраняемого хранилища в Ницце через канализацию без единого выстрела',
  },
  {
    id: 'aviation',
    label: '✈️ Загадка маршрутов самолётов',
    topic: 'Почему коммерческие самолёты никогда не летают по прямой линии через океан',
  },
  {
    id: 'tunnels',
    label: '🚇 Подземные города',
    topic: 'Скрытые заброшенные тоннели и тайные станции метро под мировыми столицами',
  },
  {
    id: 'supercar',
    label: '🏎️ Рождение легендарного суперкара',
    topic: 'Как в старом гараже собрали прототип, обогнавший мировых гигантов автопрома',
  },
];

/**
 * Generates an engaging script from any topic description.
 */
export function generateSmartScript(topicInput: string, lengthLabel: string = '1 мин'): string {
  const cleanTopic = topicInput.trim() || 'Ограбление самого охраняемого банка в Ницце';

  // Topic-sensitive templates
  const isAviation = /самол|полет|рейс|авиа|неб/i.test(cleanTopic);
  const isTunnels = /тоннел|метро|подзем|катакомб/i.test(cleanTopic);
  const isSupercar = /авто|машин|гонк|суперкар|мотор/i.test(cleanTopic);

  if (isAviation) {
    return `# Загадка авиационных маршрутов
**Формат:** Документальное расследование
**Хронометраж:** ${lengthLabel} (~6 ключевых планов)
**Тон:** Интригующий, кинематографичный

Если нарисовать прямой маршрут на плоской карте — самолёт должен лететь строго по центру.
Но на радарах диспетчеров траектория всегда изгибается гигантской дугой на север.
Всё дело в геодезических линиях и искривлении земного шара.
Прямая линия на глобусе на двумерной карте выглядит причудливой кривой.
А в экстренной ситуации каждый километр до ближайшей полосы решает исход рейса.
Небо живёт по законам сферической тригонометрии, которые спасают жизни каждый день.`;
  }

  if (isTunnels) {
    return `# Невидимый город под нашими ногами
**Формат:** Документальное клиповое видео
**Хронометраж:** ${lengthLabel} (~6 ключевых планов)
**Тон:** Саспенс, историческая тайна

Прямо под шумными проспектами мегаполисов скрываются сотни километров пустоты.
Заброшенные служебные ветки, бункеры времен холодной войны и забытые перегоны.
Ни один турист не видит массивные гермозатворы, спрятанные за обычными вентиляционными решетками.
Здесь время остановилось несколько десятилетий назад.
Только капли грунтовых вод нарушают тишину в лучах поисковых фонарей.
Каждый день миллионы людей ходят над тайнами, о которых не пишут в путеводителях.`;
  }

  if (isSupercar) {
    return `# Рождение скорости: как гараж победил гигантов
**Формат:** Динамичный байопик
**Хронометраж:** ${lengthLabel} (~6 ключевых планов)
**Тон:** Драйв, адреналин, триумф

Шесть инженеров-энтузиастов и старый ангар на окраине города.
У них не было миллиардных бюджетов, только чертежная бумага и чистая страсть.
Каждую деталь подвески и кузова выстукивали вручную из авиационного алюминия.
Ночью перед первыми тестами мотор зарычал так, что содрогнулись стены.
На треке в Монце этот безымянный прототип обошел фаворитов на первом же повороте.
Так рождаются легенды, меняющие историю автомобильного мира навсегда.`;
  }

  // Default or user-provided topic
  return `# ${cleanTopic.slice(0, 50)}
**Формат:** Кинематографичный клиповый сюжет
**Хронометраж:** ${lengthLabel} (~6 ключевых планов)
**Тон:** Высокое визуальное качество, саспенс

${cleanTopic}.
С первого взгляда всё кажется привычным и обыденным, но детали скрывают неожиданную правду.
Никакой случайности: за каждым элементом стоит точный расчет и строгая последовательность.
За долю секунды ситуация переворачивается на сто восемьдесят градусов.
Скрытые механизмы приходят в движение без единого лишнего звука.
Финал раскрывает то, что оставалось невидимым для всех окружающих.`;
}

/**
 * Parses script lines into individual visual prompts with camera angles and lighting.
 */
export function parseScriptToPromptLines(scriptText: string): string[] {
  // Extract sentences or meaningful paragraphs
  const rawLines = scriptText
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (line.startsWith('#')) return false;
      if (line.startsWith('**')) return false;
      if (/^(канал|формат|хронометраж|аудитория|тон|статус):/i.test(line)) return false;
      return true;
    });

  if (rawLines.length === 0) {
    return [
      '1. Общий кинематографичный план города на закате, мягкий теплый свет, 35mm lens, atmospheric depth',
      '2. Средний план главного героя за деревянным столом, луч лампы, контрастные тени',
      '3. Крупный план рук с чертежами и хронометром, малая глубина резкости, макродетали',
      '4. Динамичный план в движении, низкий угол камеры, напряженная атмосфера',
      '5. Атмосферный кадр отхода через вечернюю набережную, отражения огней на мокром асфальте',
      '6. Эпичный финальный панорамный план, золотые блики заката, кинематографичный финал',
    ];
  }

  const cameraSetups = [
    { prefix: 'Общий кинематографичный план', style: '35mm anamorphic lens, golden hour sunlight, deep cinematic atmosphere' },
    { prefix: 'Средний план', style: '50mm f/1.4 lens, natural dramatic shadows, warm directional lamp light' },
    { prefix: 'Крупный макро-план деталей', style: '85mm macro lens, shallow depth of field, sharp textures' },
    { prefix: 'Низкий ракурс камеры', style: '28mm wide angle lens, high contrast lighting, moody ambience' },
    { prefix: 'Атмосферный план со спины', style: '40mm lens, subtle mist, backlit silhouette, cinematic grading' },
    { prefix: 'Широкая панорама финала', style: 'epic wide shot, volumetric sunset rays, photorealistic 8k detail' },
  ];

  return rawLines.map((line, idx) => {
    const cleanLine = line.replace(/^\d+[\.\)]\s*/, '').trim();
    const setup = cameraSetups[idx % cameraSetups.length];
    return `${idx + 1}. ${setup.prefix}: ${cleanLine}. ${setup.style}`;
  });
}
