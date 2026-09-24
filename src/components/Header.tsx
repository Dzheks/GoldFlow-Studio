import React from 'react';
import { ViewMode } from '../types';
import { Send, Coins, LogOut, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  credits: number;
  onOpenRecharge: () => void;
  projectName?: string;
  isMontageOrFactory?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  credits,
  onOpenRecharge,
  projectName = 'Новый',
  isMontageOrFactory = false,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#110e0b]/95 backdrop-blur-md border-b border-[#262018] px-4 md:px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Zone: Brand Logo & Context */}
        <div className="flex items-center gap-4">
          {isMontageOrFactory && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-amber-400 transition-colors px-2 py-1 rounded bg-[#1c1712] border border-[#33291d]"
              title="Вернуться на главную"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Главная</span>
            </button>
          )}

          <div
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            {/* GoldFlow Polygon Logo */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 p-[1px] shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center">
              <div className="w-full h-full bg-[#14100c] rounded-[7px] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-amber-400" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4l16 8-16 8 3.5-8L4 4z" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                GoldFlow
              </span>
              {isMontageOrFactory && (
                <span className="text-xs text-stone-500 font-mono hidden sm:inline">
                  / {projectName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Zone: Nav Links */}
        <nav className="flex items-center gap-1 md:gap-4 text-xs md:text-sm font-medium">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              currentView === 'dashboard'
                ? 'text-white font-semibold'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Создать
          </button>
          <button
            onClick={() => onNavigate('my-works')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              currentView === 'my-works'
                ? 'text-white font-semibold'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Мои работы
          </button>
          <button
            onClick={onOpenRecharge}
            className="px-3 py-1.5 rounded-md text-stone-400 hover:text-white transition-colors"
          >
            Аккаунт
          </button>
          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-stone-300 hover:text-amber-300 bg-[#1c1611] hover:bg-[#282017] border border-[#33291d] transition-all"
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span>TG Канал</span>
          </a>
        </nav>

        {/* Right Zone: Credit status badge & Logout */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenRecharge}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#19140f] hover:bg-[#251e16] border border-[#382c1e] text-xs font-mono text-amber-200/90 transition-all hover:border-amber-500/50"
            title="Пополнить баланс кредитов"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">{credits}</span>
            <span className="text-stone-500">кредитов · {credits} ₽</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Выйти из аккаунта GoldFlow?')) {
                onNavigate('dashboard');
              }
            }}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-2 py-1.5 rounded hover:bg-[#1f1913] transition-colors"
            title="Выйти"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>
    </header>
  );
};
