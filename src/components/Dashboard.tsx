import React from 'react';
import { ViewMode } from '../types';
import { Mic, Image as ImageIcon, Video, Bot, Factory, Film, Layers, ArrowUpRight, Sparkles, Wand2 } from 'lucide-react';

interface DashboardProps {
  onSelectTool: (view: ViewMode) => void;
  recentProjectName?: string;
  onOpenRecentProject: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectTool,
  recentProjectName = 'Новый - 142',
  onOpenRecentProject,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
      {/* Hero Section */}
      <div className="mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-3">
          Что создаём?
        </h1>
        <p className="text-base md:text-lg text-stone-400">
          Выбери, с чего начать. Цена всегда видна до запуска.
        </p>

        {/* Quick Resume Recent Project Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-[#1c1610] via-[#16120e] to-[#120e0b] border border-[#382b1c] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-400/80 font-mono">
                Текущий проект в работе
              </div>
              <div className="text-sm font-semibold text-white">
                {recentProjectName} · 142 фото, 8 сцен (YouTube 16:9)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectTool('factory')}
              className="px-4 py-2 rounded-xl bg-[#261d14] hover:bg-[#34271a] border border-[#423120] text-xs font-medium text-stone-200 transition-colors"
            >
              В Контент-завод
            </button>
            <button
              onClick={() => onSelectTool('montage')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-xs font-semibold text-black transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>Открыть монтаж</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category 1: СОЗДАТЬ */}
      <div className="mb-12">
        <div className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-5 font-mono">
          СОЗДАТЬ
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: Озвучка */}
          <div
            onClick={() => onSelectTool('voice')}
            className="group relative p-6 rounded-2xl bg-[#17130f] hover:bg-[#201a14] border border-[#2b2218] hover:border-amber-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Озвучка
                </h3>
                <Mic className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Текст голосом: десятки голосов, скорость и эмоция.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-stone-500 font-mono">
              <span>Web Speech & Neural TTS</span>
              <span className="text-amber-400/80 group-hover:translate-x-0.5 transition-transform">Перейти →</span>
            </div>
          </div>

          {/* Card: Картинки */}
          <div
            onClick={() => onSelectTool('images')}
            className="group relative p-6 rounded-2xl bg-[#17130f] hover:bg-[#201a14] border border-[#2b2218] hover:border-amber-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Картинки
                </h3>
                <ImageIcon className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Nano Banana: от черновика до обложки.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-stone-500 font-mono">
              <span>16:9 · 9:16 · 1:1</span>
              <span className="text-amber-400/80 group-hover:translate-x-0.5 transition-transform">Перейти →</span>
            </div>
          </div>

          {/* Card: Видео Veo 3 */}
          <div
            onClick={() => onSelectTool('video')}
            className="group relative p-6 rounded-2xl bg-[#17130f] hover:bg-[#201a14] border border-amber-500/30 hover:border-amber-500/60 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                    Veo 3 Видео
                  </h3>
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">
                    Fast
                  </span>
                </div>
                <Video className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Генерация видео из текста через <span className="text-amber-300/90 font-mono">veo-3.1-fast-generate-preview</span>.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-stone-500 font-mono">
              <span className="text-amber-400/90 font-semibold">16:9 · 9:16 HD</span>
              <span className="text-amber-400/80 group-hover:translate-x-0.5 transition-transform">Сгенерировать →</span>
            </div>
          </div>

          {/* Card: Ассистент */}
          <div
            onClick={() => onSelectTool('assistant')}
            className="group relative p-6 rounded-2xl bg-[#17130f] hover:bg-[#201a14] border border-[#2b2218] hover:border-amber-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Ассистент
                </h3>
                <Bot className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Обсудить задачу и собрать промпт.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-stone-500 font-mono">
              <span>Сценарии и идеи</span>
              <span className="text-amber-400/80 group-hover:translate-x-0.5 transition-transform">Перейти →</span>
            </div>
          </div>

          {/* Card: Контент-завод (Highlight featured card) */}
          <div
            onClick={() => onSelectTool('factory')}
            className="group relative p-6 rounded-2xl bg-gradient-to-b from-[#221a12] to-[#17130f] hover:from-[#2a2016] hover:to-[#1e1711] border border-amber-500/40 hover:border-amber-400 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-lg sm:col-span-2 lg:col-span-2"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-amber-200 group-hover:text-amber-300 transition-colors">
                    Контент-завод
                  </h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                    Основной инструмент
                  </span>
                </div>
                <Factory className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-xs text-stone-300 leading-relaxed max-w-xl">
                Пачка промптов за раз: строка — задание. Автоматическая раскадровка сценария, подбор персонажей и локаций, расчет стоимости.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-amber-400/90 font-mono">
              <span>Пакетная генерация до 150+ кадров за клик</span>
              <span className="font-semibold group-hover:translate-x-1 transition-transform">Запустить фабрику →</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category 2: ОБРАБОТАТЬ */}
      <div>
        <div className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-5 font-mono">
          ОБРАБОТАТЬ
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card: Превью */}
          <div
            onClick={() => onSelectTool('preview')}
            className="group relative p-6 rounded-2xl bg-[#17130f] hover:bg-[#201a14] border border-[#2b2218] hover:border-amber-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Превью
                </h3>
                <ImageIcon className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Обложка под YouTube и Shorts. Кликабельный текст, подсветка и адаптивные форматы.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-stone-500 font-mono">
              <span>CTR оптимизация</span>
              <span className="text-amber-400/80 group-hover:translate-x-0.5 transition-transform">Открыть редактор →</span>
            </div>
          </div>

          {/* Card: Монтаж */}
          <div
            onClick={() => onSelectTool('montage')}
            className="group relative p-6 rounded-2xl bg-[#17130f] hover:bg-[#201a14] border border-[#2b2218] hover:border-amber-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Монтаж
                </h3>
                <Film className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Таймлайн, переходы, зум. Рендер у тебя на компьютере без очередей.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-stone-500 font-mono">
              <span>Многодорожечный нелинейный монтаж</span>
              <span className="text-amber-400/80 group-hover:translate-x-0.5 transition-transform">Открыть студию →</span>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Production Pipeline Banner */}
      <div className="pt-6">
        <div
          onClick={() => onSelectTool('factory')}
          className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#1b130a] via-[#24170d] to-[#1a1208] border border-amber-500/40 hover:border-amber-400 cursor-pointer transition-all shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 group"
        >
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/40">
              <Sparkles className="w-3.5 h-3.5" />
              <span>СКВОЗНОЙ КОНВЕЙЕР 01—06</span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">
              Сильный сценарий — с одной строки запроса
            </h3>
            <p className="text-xs md:text-sm text-stone-300 max-w-2xl leading-relaxed">
              Строки «ролик про ограбление банка в Нигерии» уже достаточно. Конвейер сам строит скелет, пишет закадровый текст по блокам, делает раскадровку по 9 полям, держит эталон героя и монтирует всё под голос.
            </p>
          </div>
          <button
            type="button"
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs md:text-sm shadow-lg shrink-0 flex items-center gap-2 transition-transform group-hover:scale-105"
          >
            <span>Запустить конвейер</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
