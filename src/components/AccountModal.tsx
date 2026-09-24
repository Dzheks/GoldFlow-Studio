import React, { useState } from 'react';
import { X, Check, Zap, Sparkles, Shield, Gift, CreditCard, Film, Image as ImageIcon, HelpCircle } from 'lucide-react';
import { GENERATION_IMAGE_MODELS, GENERATION_VIDEO_MODELS } from '../config/models';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  credits: number;
  onAddCredits: (amount: number) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  credits,
  onAddCredits,
}) => {
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [activeTab, setActiveTab] = useState<'prices' | 'comparison' | 'recharge'>('prices');

  if (!isOpen) return null;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');
    if (promoCode.trim().toUpperCase() === 'GOLDFLOW' || promoCode.trim().toUpperCase() === 'STUDIO') {
      onAddCredits(300);
      setPromoApplied(true);
      setPromoCode('');
    } else {
      setPromoError('Промокод не найден. Введите GOLDFLOW для получения 300 бонусов!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-3xl bg-[#140f0b] border border-[#33281c] rounded-2xl shadow-2xl p-5 md:p-6 text-stone-200 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#282016]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-[1px] shrink-0">
              <div className="w-full h-full bg-[#17120d] rounded-[11px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-white">Тарифы и возможности GoldFlow</h2>
              <p className="text-xs text-stone-400">Никаких «токенов» и пересчётов в уме. У каждой модели своя понятная цена.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#241c14] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 mt-4 p-1 bg-[#1a140f] rounded-lg border border-[#2b2116] text-xs font-medium shrink-0">
          <button
            onClick={() => setActiveTab('prices')}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              activeTab === 'prices'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Цена известна заранее
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              activeTab === 'comparison'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Это сайт, а не программа
          </button>
          <button
            onClick={() => setActiveTab('recharge')}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              activeTab === 'recharge'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Пополнение баланса ({credits} ₽)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-5 pr-1">
          {/* TAB 1: Цена известна заранее (Screenshot 5) */}
          {activeTab === 'prices' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Цена известна заранее</h3>
                <p className="text-xs text-stone-400 mt-1">
                  Никаких «токенов» и пересчётов в уме. У каждой модели своя понятная цена, а перед запуском ты видишь итог и остаток баланса.
                </p>
              </div>

              {/* КАРТИНКИ */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono tracking-widest text-amber-400 font-bold uppercase block">
                  КАРТИНКИ
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {GENERATION_IMAGE_MODELS.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl bg-[#19130d] border border-[#2e2216] flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-white">{m.name}</h4>
                        <p className="text-xs text-stone-400 leading-relaxed min-h-[36px]">
                          {m.description}
                        </p>
                      </div>
                      <div className="pt-4 mt-3 border-t border-[#261c12]">
                        <div className="font-semibold text-xs text-stone-200">
                          {m.creditCost} кредитов {m.unitLabel}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                          = {m.priceRub} ₽
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ВИДЕО */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono tracking-widest text-amber-400 font-bold uppercase block">
                  ВИДЕО
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {GENERATION_VIDEO_MODELS.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl bg-[#19130d] border border-[#2e2216] flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-white flex items-center justify-between">
                          <span>{m.name}</span>
                          {m.badge && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                              {m.badge}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-stone-400 leading-relaxed min-h-[36px]">
                          {m.description}
                        </p>
                      </div>
                      <div className="pt-4 mt-3 border-t border-[#261c12]">
                        <div className="font-semibold text-xs text-stone-200">
                          {m.creditCost} кредитов {m.unitLabel}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                          = {m.priceRub} ₽
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Это сайт, а не программа (Screenshot 4) */}
          {activeTab === 'comparison' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Это сайт, а не программа</h3>
                <p className="text-xs text-stone-400 mt-1">
                  Сравнение классического софта для монтажа/генераций и облачного конвейера GoldFlow.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#2e2216] bg-[#16100b]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2b2015] bg-[#1d1610]">
                      <th className="py-3 px-4 text-stone-400 font-medium w-1/4">ПАРАМЕТР</th>
                      <th className="py-3 px-4 text-stone-400 font-mono uppercase text-[11px] w-3/8">
                        ПРОГРАММА С УСТАНОВКОЙ
                      </th>
                      <th className="py-3 px-4 text-amber-400 font-mono uppercase text-[11px] w-3/8 font-bold">
                        GOLDFLOW
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#261c12]">
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-white">Начало работы</td>
                      <td className="py-3.5 px-4 text-stone-400">
                        Скачать установщик, поставить, ввести лицензионный ключ
                      </td>
                      <td className="py-3.5 px-4 text-amber-200 font-medium">Открыть сайт</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-white">Что платите</td>
                      <td className="py-3.5 px-4 text-stone-400">Лицензия целиком и вперёд</td>
                      <td className="py-3.5 px-4 text-amber-200 font-medium">Кредиты за то, что сняли</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-white">Где считается</td>
                      <td className="py-3.5 px-4 text-stone-400">
                        На вашем компьютере — он занят и греется
                      </td>
                      <td className="py-3.5 px-4 text-amber-200 font-medium">На наших серверах</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-white">Требования к машине</td>
                      <td className="py-3.5 px-4 text-stone-400">
                        Видеокарта, память, подходящая система
                      </td>
                      <td className="py-3.5 px-4 text-amber-200 font-medium">
                        Любая, где открывается браузер
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-white">Из России</td>
                      <td className="py-3.5 px-4 text-stone-400">Как повезёт: VPN, чужие карты</td>
                      <td className="py-3.5 px-4 text-amber-200 font-medium">
                        Карты РФ и СБП, без обходных путей
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-white">Обновления</td>
                      <td className="py-3.5 px-4 text-stone-400">Скачать новую версию</td>
                      <td className="py-3.5 px-4 text-amber-200 font-medium">Уже здесь</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Пополнение баланса */}
          {activeTab === 'recharge' && (
            <div className="space-y-5">
              {/* Promo code box */}
              <div className="p-4 rounded-xl bg-[#1b140e] border border-amber-500/30">
                <form onSubmit={handleApplyPromo} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ввести промокод</span>
                    </label>
                    <span className="text-[11px] text-amber-400/90 font-mono">Бонус 300 ₽ по коду GOLDFLOW</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="GOLDFLOW"
                      className="flex-1 bg-[#100c08] border border-[#302216] rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all"
                    >
                      Активировать
                    </button>
                  </div>
                  {promoApplied && (
                    <p className="text-xs text-emerald-400 font-medium">
                      ✓ Промокод активирован! Вам начислено 300 кредитов (300 ₽).
                    </p>
                  )}
                  {promoError && (
                    <p className="text-xs text-rose-400 font-medium">{promoError}</p>
                  )}
                </form>
              </div>

              {/* Payment packages */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-stone-300 block">
                  Быстрое пополнение (Карты РФ, СБП, Mir):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { amount: 500, credits: 500, label: 'Старт', badge: '500 ₽' },
                    { amount: 1500, credits: 1650, label: 'Продвинутый', bonus: '+150 бонус', badge: '1 500 ₽' },
                    { amount: 3000, credits: 3600, label: 'Студия', bonus: '+600 бонус', badge: '3 000 ₽' },
                  ].map((pkg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onAddCredits(pkg.credits);
                        onClose();
                      }}
                      className="p-4 rounded-xl bg-[#19130d] hover:bg-[#251c14] border border-[#2e2216] hover:border-amber-500/50 text-left transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{pkg.label}</span>
                          {pkg.bonus && (
                            <span className="text-[10px] text-emerald-400 font-mono">{pkg.bonus}</span>
                          )}
                        </div>
                        <div className="text-xl font-bold text-amber-400 mt-2">
                          {pkg.credits} <span className="text-xs font-normal text-stone-400">кредитов</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#261c12] text-xs font-semibold text-stone-300 group-hover:text-white flex items-center justify-between">
                        <span>Оплатить {pkg.badge}</span>
                        <span>→</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#261d15] flex items-center justify-between text-xs text-stone-400 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-stone-500">Текущий баланс:</span>
            <span className="font-bold text-amber-400 font-mono text-sm">{credits} кредитов ({credits} ₽)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#241a12] hover:bg-[#342419] text-stone-300 text-xs transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
