import React, { useState } from 'react';
import { ArrowLeft, Bot, Send, Sparkles, Copy, Check, ArrowRight } from 'lucide-react';

interface AssistantStudioProps {
  onBack: () => void;
  onSendToFactory: (script: string) => void;
}

export const AssistantStudio: React.FC<AssistantStudioProps> = ({ onBack, onSendToFactory }) => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: 'Привет! Я ассистент студии GoldFlow. Помогу придумать идею для ролика, составить цепляющий хук, разбить тему на главы и сгенерировать пачку промптов для Контент-завода. О чём планируешь сделать видео?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText;
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputText('');
    setIsThinking(true);

    setTimeout(() => {
      const response = `Отличная тема! Вот готовая структура для Контент-завода:

# ${userMsg}
**Формат:** Документальный клиповый экскурс
**Целевая длина:** 3-5 минут (45-60 сцен)
**Хук (первые 5 секунд):** «В каждом городе есть бизнес, мимо которого ты проходишь сотни раз, даже не подозревая, что он генерирует миллионы.»

Рекомендую выбрать стиль «11 (Кинематограф)» и соотношение 16:9 для горизонтального выпуска. Я подготовил пакет промптов — нажмите кнопку ниже, чтобы сразу открыть его в Контент-заводе!`;

      setMessages(prev => [...prev, { sender: 'assistant', text: response }]);
      setIsThinking(false);
    }, 1000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#251c14] shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к выбору</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
          <Bot className="w-4 h-4" />
          <span>AI Creative Assistant</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-2xl text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${
                m.sender === 'user'
                  ? 'bg-amber-500 text-black font-medium'
                  : 'bg-[#17120e] border border-[#2b2015] text-stone-200'
              }`}
            >
              {m.text}
              {m.sender === 'assistant' && idx > 0 && (
                <div className="mt-4 pt-3 border-t border-[#2d2217] flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">Готово для генерации</span>
                  <button
                    onClick={() => onSendToFactory(m.text)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Перенести в Контент-завод</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="p-3 rounded-2xl bg-[#17120e] border border-[#2b2015] text-xs text-amber-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Генерирую сценарий и визуальные промпты...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input row */}
      <form onSubmit={handleSend} className="pt-3 border-t border-[#251c14] shrink-0 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Напиши тему (например: Топ-5 закрытых клубов для миллиардеров)..."
          className="flex-1 bg-[#17120e] border border-[#2e2115] rounded-xl px-4 py-3 text-xs md:text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all shadow-md flex items-center gap-2"
        >
          <Send className="w-4 h-4 fill-black" />
          <span>Отправить</span>
        </button>
      </form>
    </div>
  );
};
