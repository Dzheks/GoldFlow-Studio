import React, { useState } from 'react';
import { ShieldCheck, Plus, Sparkles, RefreshCw, Check, Upload, Camera } from 'lucide-react';

interface HeroMasterShowcaseProps {
  onApplyHeroToScenes?: (heroName: string, heroPrompt: string) => void;
  onToast?: (msg: string) => void;
}

export const HeroMasterShowcase: React.FC<HeroMasterShowcaseProps> = ({
  onApplyHeroToScenes,
  onToast,
}) => {
  const [selectedHero, setSelectedHero] = useState<{
    id: string;
    name: string;
    description: string;
    avatarUrl: string;
    scenes: { id: string; title: string; prompt: string; imageUrl: string }[];
  }>({
    id: 'hero-sailor',
    name: 'Капитан / Седой маячник',
    description: 'Один удачный портрет. Дальше он прикладывается к каждой сцене.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    scenes: [
      {
        id: 's1',
        title: 'На маяке в шторм',
        prompt: 'Держится за обледеневшие поручни на маяке, гигантские волны, брызги в лицо, суровый взгляд',
        imageUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 's2',
        title: 'Утро на кухне',
        prompt: 'Наливает кипяток в кружку из медного чайника, лучи утреннего солнца через старое окно',
        imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 's3',
        title: 'В лодке на рассвете',
        prompt: 'Гребёт в деревянной лодке в густом утреннем тумане по спокойной глади залива',
        imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
      },
    ],
  });

  const handleAttachHero = () => {
    if (onApplyHeroToScenes) {
      onApplyHeroToScenes(selectedHero.name, selectedHero.description);
    }
    if (onToast) {
      onToast(`⚓ Эталон «${selectedHero.name}» закреплён за всеми сценами проекта!`);
    }
  };

  return (
    <div className="rounded-2xl bg-[#140f0b] border border-[#2e2115] p-5 md:p-6 space-y-5">
      {/* Header section */}
      <div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-bold block mb-1">
          ГЕРОЙ НЕ МЕНЯЕТСЯ
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Один кадр — и это один человек до конца фильма
        </h2>
        <p className="text-xs md:text-sm text-stone-400 mt-1.5 max-w-3xl leading-relaxed">
          Приметы, названные словами, генератор не воспроизводит: «седой мужчина со шрамом» в каждой сцене выйдет другим седым мужчиной. Держит героя его собственный удачный кадр — он уходит эталоном в следующие. Ниже настоящий прогон: портрет слева, три сцены сняты с ним.
        </p>
      </div>

      {/* Grid: Master Portrait + 3 Scenes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {/* Master Portrait Card (Left) */}
        <div className="p-3.5 rounded-xl bg-[#1a130d] border-2 border-amber-500/60 shadow-lg shadow-amber-500/10 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-black border border-[#3b2b1d]">
              <img
                src={selectedHero.avatarUrl}
                alt="Эталон героя"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-500 text-black font-bold text-[10px] uppercase tracking-wider shadow">
                Эталон
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Эталон героя</span>
              </h4>
              <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                {selectedHero.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttachHero}
            className="w-full mt-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Применить к проекту</span>
          </button>
        </div>

        {/* Scene 1 */}
        {selectedHero.scenes.map((sc, idx) => (
          <div
            key={sc.id}
            className="p-3 rounded-xl bg-[#18120c] border border-[#2b1f14] hover:border-amber-500/40 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-black border border-[#302216]">
                <img
                  src={sc.imageUrl}
                  alt={sc.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 text-white font-medium text-[10px] backdrop-blur-sm">
                  {sc.title}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 line-clamp-3 leading-relaxed">
                {sc.prompt}
              </p>
            </div>
            <div className="pt-2 border-t border-[#261d15] flex items-center justify-between text-[10px] text-amber-400/90 font-mono">
              <span>Лицо: 100% эталон</span>
              <span className="text-stone-500">Сцена #{idx + 1}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer disclaimer */}
      <div className="pt-2 border-t border-[#221a13] flex flex-wrap items-center justify-between text-xs text-stone-500 gap-2">
        <p className="italic">
          Ни одна примета не описана словами во второй раз: во всех трёх сценах написано только «сохрани лицо как на эталоне».
        </p>
        <span className="px-2 py-0.5 rounded bg-[#1e1610] text-stone-400 font-mono text-[11px]">
          LoRA / FaceRef ID: #hero-sailor-v3
        </span>
      </div>
    </div>
  );
};
