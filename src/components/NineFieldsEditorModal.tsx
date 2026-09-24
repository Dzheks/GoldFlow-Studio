import React, { useState } from 'react';
import { DirectorNineFields, compileNineFieldsPrompt, DEFAULT_NINE_FIELDS } from '../types/goldflow';
import { Camera, Sparkles, X, Check, Wand2, ShieldCheck, Film, Layers } from 'lucide-react';

interface NineFieldsEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFields?: Partial<DirectorNineFields>;
  sceneIndex?: number;
  heroName?: string;
  onSave: (fields: DirectorNineFields, compiledPrompt: string) => void;
}

const NINE_FIELDS_PRESETS: { name: string; fields: DirectorNineFields }[] = [
  {
    name: 'Ограбление банка в Ницце (Эталон)',
    fields: {
      lens: 'Широкий 28 мм, низкая точка',
      action: 'Пробивает бетон домкратом',
      moment: 'За секунду до того, как стена подалась',
      foreground: 'Осколки и пыль в луче фонаря',
      location: 'Тоннель под хранилищем банка',
      background: 'Темнота, уходящая вглубь коллектора',
      texture: 'Мокрый бетон, ржавое железо',
      light: 'Один фонарь сбоку, резкие тени',
      mood: 'Напряжение, работа на пределе',
    },
  },
  {
    name: 'Старый маячник в шторм',
    fields: {
      lens: 'Портретный 50 мм f/1.4, средний план',
      action: 'Держится за обледеневшие перила на ветру',
      moment: 'Вспышка молнии освещает седую бороду и брызги',
      foreground: 'Стекающие капли ледяной морской воды',
      location: 'Внешний балкон маяка над бушующим океаном',
      background: 'Гигантские штормовые волны и луч маяка',
      texture: 'Грубый шерстяной свитер, мокрый металл, пена',
      light: 'Резкий холодный контровой свет прожектора',
      mood: 'Суровая стойкость, одиночество перед стихией',
    },
  },
  {
    name: 'Утро на кухне у моря',
    fields: {
      lens: '35 мм, естественная перспектива',
      action: 'Наливает кипящий чай из медного чайника в кружку',
      moment: 'Струя пара поднимается в луч солнца из окна',
      foreground: 'Деревянный потёртый стол, старая газета',
      location: 'Светлая деревенская кухня с видом на залив',
      background: 'Окно с белой рамой, спокойная гладь моря',
      texture: 'Тёплая древесина, блеск старой меди',
      light: 'Мягкий рассеянный утренний солнечный свет',
      mood: 'Умиротворение, тишина после бури',
    },
  },
];

export const NineFieldsEditorModal: React.FC<NineFieldsEditorModalProps> = ({
  isOpen,
  onClose,
  initialFields,
  sceneIndex = 1,
  heroName,
  onSave,
}) => {
  const [fields, setFields] = useState<DirectorNineFields>({
    ...DEFAULT_NINE_FIELDS,
    ...(initialFields || {}),
  });
  const [lockHero, setLockHero] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleChange = (key: keyof DirectorNineFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const compiled = compileNineFieldsPrompt(fields, lockHero ? heroName || 'Главный герой' : undefined);

  const handleApplyPreset = (presetFields: DirectorNineFields) => {
    setFields(presetFields);
  };

  const handleConfirm = () => {
    onSave(fields, compiled);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div 
        className="bg-[#120e0a] border border-[#3b2b1d] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#261d15] flex items-center justify-between bg-[#18120c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-bold">
                  ПОЧЕМУ КАДРЫ ПОЛУЧАЮТСЯ
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                  Кадр #{sceneIndex}
                </span>
              </div>
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
                Один кадр — девять заполненных полей, а не строка промпта
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#241a12] hover:bg-[#342419] text-stone-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Subheader info */}
        <div className="px-6 py-3 bg-[#16100b] border-b border-[#241a12] text-xs text-stone-400 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl">
            Всё, что не сказано, генератор добирает сам — и в каждой сцене по-своему. Поэтому кадр описывается целиком: где камера, что происходит, откуда свет.
          </p>
          {/* Quick presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-500">Пресет:</span>
            {NINE_FIELDS_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p.fields)}
                className="px-2 py-1 rounded bg-[#201811] hover:bg-amber-500/20 hover:text-amber-300 border border-[#38281a] text-[11px] text-stone-300 transition-colors"
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Modal 9 Fields Grid */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Field 1: ОБЪЕКТИВ */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                ОБЪЕКТИВ
              </label>
              <input
                type="text"
                value={fields.lens}
                onChange={(e) => handleChange('lens', e.target.value)}
                placeholder="Широкий 28 мм, низкая точка"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Фокусное расстояние, ракурс и угол камеры</span>
            </div>

            {/* Field 2: ДЕЙСТВИЕ */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                ДЕЙСТВИЕ
              </label>
              <input
                type="text"
                value={fields.action}
                onChange={(e) => handleChange('action', e.target.value)}
                placeholder="Пробивает бетон домкратом"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Что конкретно делает субъект в кадре</span>
            </div>

            {/* Field 3: МОМЕНТ */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                МОМЕНТ
              </label>
              <input
                type="text"
                value={fields.moment}
                onChange={(e) => handleChange('moment', e.target.value)}
                placeholder="За секунду до того, как стена подалась"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Точная микросекунда застывшего времени</span>
            </div>

            {/* Field 4: ПЕРЕДНИЙ ПЛАН */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                ПЕРЕДНИЙ ПЛАН
              </label>
              <input
                type="text"
                value={fields.foreground}
                onChange={(e) => handleChange('foreground', e.target.value)}
                placeholder="Осколки и пыль в луче фонаря"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Детали прямо перед объективом для глубины</span>
            </div>

            {/* Field 5: МЕСТО */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                МЕСТО
              </label>
              <input
                type="text"
                value={fields.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="Тоннель под хранилищем банка"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Локация действия в фильме</span>
            </div>

            {/* Field 6: ФОН */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                ФОН
              </label>
              <input
                type="text"
                value={fields.background}
                onChange={(e) => handleChange('background', e.target.value)}
                placeholder="Темнота, уходящая вглубь коллектора"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Глубина заднего плана и окружение</span>
            </div>

            {/* Field 7: ФАКТУРА */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                ФАКТУРА
              </label>
              <input
                type="text"
                value={fields.texture}
                onChange={(e) => handleChange('texture', e.target.value)}
                placeholder="Мокрый бетон, ржавое железо"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Материалы, потёртости, осязаемость</span>
            </div>

            {/* Field 8: СВЕТ */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                СВЕТ
              </label>
              <input
                type="text"
                value={fields.light}
                onChange={(e) => handleChange('light', e.target.value)}
                placeholder="Один фонарь сбоку, резкие тени"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Источник, температура и характер теней</span>
            </div>

            {/* Field 9: НАСТРОЕНИЕ */}
            <div className="bg-[#18120c] p-3.5 rounded-xl border border-[#2b1f14] space-y-1.5 focus-within:border-amber-500/60 transition-colors">
              <label className="text-[10px] font-bold tracking-wider uppercase text-amber-400/90 block">
                НАСТРОЕНИЕ
              </label>
              <input
                type="text"
                value={fields.mood}
                onChange={(e) => handleChange('mood', e.target.value)}
                placeholder="Напряжение, работа на пределе"
                className="w-full bg-[#110c08] border border-[#2e2115] rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-stone-500 block">Эмоциональный заряд и напряжение сцены</span>
            </div>
          </div>

          {/* Hero Consistency toggle (Screenshot 2 concept) */}
          <div className="p-3.5 rounded-xl bg-[#1c150e] border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Привязать эталон героя (Консистентность лица)
                </span>
                <span className="text-[11px] text-stone-400">
                  {heroName ? `Эталон: ${heroName}. ` : ''}Ни одна примета не описывается словами: во всех сценах написано «сохрани лицо как на эталоне».
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLockHero(!lockHero)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                lockHero
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-[#291d14] text-stone-400 hover:text-stone-200'
              }`}
            >
              {lockHero ? '✓ Эталон привязан' : 'Без эталона'}
            </button>
          </div>

          {/* Compiled prompt output */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Итоговый промпт для генератора:</span>
              </label>
              <span className="text-[10px] font-mono text-stone-500">9 полей скомпилировано</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0c0906] border border-[#2b1f14] font-mono text-xs text-amber-200/90 leading-relaxed">
              {compiled}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#18120c] border-t border-[#261d15] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#241a12] hover:bg-[#342419] text-xs text-stone-300 font-medium transition-colors"
          >
            Отмена
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить в кадр #{sceneIndex}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
