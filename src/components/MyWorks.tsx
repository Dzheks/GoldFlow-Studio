import React from 'react';
import { ViewMode, ProjectData } from '../types';
import { Film, Image as ImageIcon, Download, Trash2, ArrowUpRight, Play, Clock, ArrowLeft } from 'lucide-react';

interface MyWorksProps {
  onBack: () => void;
  onOpenProject: (projectId: string) => void;
  onNavigate: (view: ViewMode) => void;
}

export const MyWorks: React.FC<MyWorksProps> = ({ onBack, onOpenProject, onNavigate }) => {
  const savedProjects = [
    {
      id: 'cmt1avcsm000001pasz8de91n',
      name: 'Новый - 142 (10 Скрытых Бизнесов)',
      date: 'Сегодня, 14:10',
      duration: '8:40',
      scenes: 8,
      images: 142,
      aspectRatio: '16:9',
      status: 'Готов к экспорту'
    },
    {
      id: 'proj-2',
      name: 'Автоматические автомойки: анатомия прибыли',
      date: 'Вчера, 19:45',
      duration: '5:15',
      scenes: 6,
      images: 64,
      aspectRatio: '16:9',
      status: 'Отрендерен (MP4)'
    },
    {
      id: 'proj-3',
      name: 'Shorts: Как делают винтажные часы',
      date: '21 сентября',
      duration: '0:58',
      scenes: 4,
      images: 24,
      aspectRatio: '9:16',
      status: 'Опубликован'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#251c14]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>
          <span className="text-stone-600">/</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Мои работы</h1>
        </div>
        <button
          onClick={() => onNavigate('factory')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black text-xs font-bold transition-all shadow-sm"
        >
          + Создать ролик
        </button>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {savedProjects.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl bg-[#15100c] border border-[#2b2116] hover:border-amber-500/40 transition-all flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#251a10] to-[#362718] border border-[#4a3622] flex items-center justify-center text-amber-400">
                <Film className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{p.name}</h3>
                <div className="flex items-center gap-3 text-xs text-stone-400 mt-1 font-mono">
                  <span>{p.date}</span>
                  <span>·</span>
                  <span>{p.duration} мин</span>
                  <span>·</span>
                  <span>{p.images} кадров</span>
                  <span>·</span>
                  <span className="text-amber-400/90">{p.aspectRatio}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => onOpenProject(p.id)}
                className="px-4 py-2 rounded-xl bg-[#241a10] hover:bg-[#342517] border border-[#3d2a1a] text-stone-200 transition-colors flex items-center gap-1.5"
              >
                <span>В монтаж</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => alert(`Загрузка архива проекта «${p.name}» (видеодорожки + раскадровка + аудио)`)}
                className="p-2 rounded-xl bg-[#241a10] hover:bg-[#342517] border border-[#3d2a1a] text-stone-300"
                title="Скачать исходники"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
