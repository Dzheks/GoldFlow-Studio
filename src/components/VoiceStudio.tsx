import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Mic, 
  Play, 
  Pause, 
  Volume2, 
  Sparkles, 
  Plus, 
  Check, 
  Languages, 
  Key, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Radio, 
  Sliders, 
  FileText, 
  Download,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { soundEngine } from '../utils/audioSynthesizer';
import { ELEVEN_LANGUAGES, ProjectLanguage } from '../types/languages';
import { 
  lumeanService, 
  LumeanVoice, 
  CURATED_STUDIO_VOICES, 
  ApiSubscriptionInfo 
} from '../services/lumeanApi';

interface VoiceStudioProps {
  onBack: () => void;
  onAddVoiceToTimeline?: (text: string, voiceName: string, audioUrl?: string) => void;
}

export const VoiceStudio: React.FC<VoiceStudioProps> = ({ onBack, onAddVoiceToTimeline }) => {
  // TTS Mode: 'browser' (Free Draft) vs 'pro_api' (Lumean / ElevenLabs API Key)
  const [studioMode, setStudioMode] = useState<'browser' | 'pro_api'>('pro_api');

  // API Key & Subscription State
  const [apiKey, setApiKey] = useState<string>('');
  const [isKeyChecking, setIsKeyChecking] = useState<boolean>(false);
  const [subInfo, setSubInfo] = useState<ApiSubscriptionInfo | null>(null);
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  // Language & Content
  const [selectedLang, setSelectedLang] = useState<ProjectLanguage>(ELEVEN_LANGUAGES[0]);
  const [text, setText] = useState<string>(
    'Бизнесы с максимальной отдачей на квадратный метр {{pause=1.2s}} часто выглядят так, будто не зарабатывают вовсе.'
  );

  // Voices
  const [voices, setVoices] = useState<LumeanVoice[]>(CURATED_STUDIO_VOICES);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(CURATED_STUDIO_VOICES[0].id);

  // Playback & Audio
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedSubtitles, setGeneratedSubtitles] = useState<string | null>(null);
  const [isPlayingFull, setIsPlayingFull] = useState<boolean>(false);

  // Voice Tweaks
  const [speed, setSpeed] = useState<number>(1.0);
  const [stability, setStability] = useState<number>(0.5);
  const [similarityBoost, setSimilarityBoost] = useState<number>(0.75);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Audio elements ref for preview playback
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fullAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load stored API key on mount
  useEffect(() => {
    const stored = lumeanService.getStoredApiKey();
    if (stored) {
      setApiKey(stored);
      lumeanService.checkApiKey(stored).then((res) => {
        if (res.success && res.sub) {
          setSubInfo(res.sub);
        }
      });
    } else {
      setShowKeyInput(true);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      lumeanService.setStoredApiKey('');
      setSubInfo(null);
      showToast('API-ключ очищен. Включен бесплатный режим браузера.');
      return;
    }

    setIsKeyChecking(true);
    try {
      const res = await lumeanService.checkApiKey(apiKey);
      if (res.success) {
        lumeanService.setStoredApiKey(apiKey);
        setSubInfo(res.sub || null);
        showToast(`✓ ${res.message}`);
        setShowKeyInput(false);
      } else {
        showToast(`✕ ${res.message}`);
      }
    } finally {
      setIsKeyChecking(false);
    }
  };

  const handleSelectLanguage = (lang: ProjectLanguage) => {
    setSelectedLang(lang);
    setText(lang.sampleScript);
    showToast(`🌐 Выбран язык: ${lang.name} (${lang.nativeName}). Текст адаптирован.`);
  };

  const handlePlayVoicePreview = (voice: LumeanVoice) => {
    if (activePreviewId === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setActivePreviewId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    if (voice.previewUrl) {
      const audio = new Audio(voice.previewUrl);
      previewAudioRef.current = audio;
      setActivePreviewId(voice.id);
      audio.play().catch(() => {
        // Fallback to browser speech if audio fails
        soundEngine.speakText(`Привет! Это голос ${voice.name}`, 1.0, () => setActivePreviewId(null));
      });
      audio.onended = () => setActivePreviewId(null);
      audio.onerror = () => setActivePreviewId(null);
    } else {
      soundEngine.speakText(`Привет! Это голос ${voice.name}`, 1.0, () => setActivePreviewId(null));
      setActivePreviewId(voice.id);
    }
  };

  const handleInsertPause = (seconds: number) => {
    const tag = `{{pause=${seconds}s}}`;
    setText((prev) => `${prev.trim()} ${tag} `);
    showToast(`Вставлена бесплатная пауза: ${seconds} сек`);
  };

  const handleInsertDirection = (cue: string) => {
    const tag = `[${cue}]`;
    setText((prev) => `${tag} ${prev.trim()} `);
    showToast(`Вставлено указание диктору: ${tag}`);
  };

  const handleSynthesize = async () => {
    if (studioMode === 'browser' || !apiKey) {
      // Browser Web Speech
      if (isPlayingFull) {
        window.speechSynthesis?.cancel();
        soundEngine.stopSpeech();
        setIsPlayingFull(false);
      } else {
        setIsPlayingFull(true);
        const clean = text.replace(/\{\{pause.*?\}\}/gi, '');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(clean);
          utterance.lang = selectedLang.id;
          utterance.rate = speed;
          utterance.onend = () => setIsPlayingFull(false);
          utterance.onerror = () => setIsPlayingFull(false);
          window.speechSynthesis.speak(utterance);
        } else {
          soundEngine.speakText(clean, speed, () => setIsPlayingFull(false));
        }
      }
      return;
    }

    // Professional API synthesis
    setIsSynthesizing(true);
    showToast('⏳ Отправка в Lumean API: нарезка по паузам и студийный рендеринг...');
    try {
      const result = await lumeanService.synthesizeVoice(
        text,
        selectedVoiceId,
        selectedLang.id,
        apiKey
      );

      if (result.audioUrl) {
        setGeneratedAudioUrl(result.audioUrl);
      }
      if (result.subtitlesSrt) {
        setGeneratedSubtitles(result.subtitlesSrt);
      }

      showToast('✓ Студийная озвучка готова! Получены тайминги и субтитры .srt.');

      // Play synthesized audio
      if (result.audioUrl) {
        if (fullAudioRef.current) {
          fullAudioRef.current.pause();
        }
        const audio = new Audio(result.audioUrl);
        fullAudioRef.current = audio;
        setIsPlayingFull(true);
        audio.play().catch(() => {});
        audio.onended = () => setIsPlayingFull(false);
      }
    } catch (err: any) {
      showToast('Ошибка синтеза. Проверьте валидность API-ключа.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleAddToTimeline = () => {
    const currentVoice = voices.find((v) => v.id === selectedVoiceId)?.name || 'Студийный диктор';
    if (onAddVoiceToTimeline) {
      onAddVoiceToTimeline(text, currentVoice, generatedAudioUrl || undefined);
    }
    showToast('✓ Аудиодорожка и субтитры успешно добавлены на таймлайн в монтаж!');
  };

  const currentSelectedVoiceObj = voices.find((v) => v.id === selectedVoiceId) || voices[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-black px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 fill-black" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#251c14]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к проекту</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-[#140f0b] border border-[#2b2015] text-xs">
            <button
              type="button"
              onClick={() => setStudioMode('browser')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                studioMode === 'browser'
                  ? 'bg-[#291e14] text-white font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Черновик (Бесплатно)
            </button>
            <button
              type="button"
              onClick={() => setStudioMode('pro_api')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                studioMode === 'pro_api'
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>PRO Студия (API-ключ)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              apiKey
                ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
                : 'bg-[#18120c] border-[#2e2116] text-stone-400 hover:text-white'
            }`}
            title="Настройки API-ключа"
          >
            <Key className="w-4 h-4" />
            <span className="hidden md:inline font-mono">
              {apiKey ? 'Ключ подключен' : 'Вбить API-ключ'}
            </span>
          </button>
        </div>
      </div>

      {/* API Key Modal / Drawer Box */}
      {showKeyInput && (
        <div className="p-6 rounded-2xl bg-[#16100c] border border-amber-500/30 space-y-4 shadow-xl animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Подключение API-ключа (Lumean / ElevenLabs)
              </h3>
            </div>
            <button
              onClick={() => setShowKeyInput(false)}
              className="text-stone-400 hover:text-white text-xs"
            >
              Свернуть
            </button>
          </div>

          <p className="text-xs text-stone-300 leading-relaxed max-w-3xl">
            Вбейте ваш ключ <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">X-API-KEY</code> из личного кабинета Lumean (или ключ ElevenLabs). 
            Ключ хранится <strong>строго локально в вашем браузере</strong> и используется для студийного синтеза, пауз без переплаты и экспорта синхронизированных субтитров.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Вставьте ваш X-API-KEY (например: lum_live_... или sk_...)"
              className="flex-1 bg-[#0f0c08] border border-[#332417] rounded-xl px-4 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono"
            />
            <button
              type="button"
              onClick={handleSaveApiKey}
              disabled={isKeyChecking}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isKeyChecking ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Проверка...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Сохранить и проверить</span>
                </>
              )}
            </button>
          </div>

          {subInfo && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-[#110d09] border border-[#2b1f14] text-xs font-mono">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {subInfo.planName}
              </span>
              <span className="text-stone-400">
                Остаток токенов: <strong className="text-white">{subInfo.tokensRemaining.toLocaleString()}</strong> / {subInfo.tokenAllowance.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 11 Languages Selector Bar */}
      <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2015] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-500 font-bold uppercase block">
              ЯЗЫКИ
            </span>
            <h3 className="text-base md:text-lg font-bold text-white tracking-tight">
              Одиннадцать языков, и голос не привязан ни к одному
            </h3>
          </div>
          <span className="text-[11px] text-stone-400 max-w-sm">
            Язык задаёт текст, а не голос. Выбирайте тот, что нравится по звучанию, и пишите на чём угодно — прочитает правильно.
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {ELEVEN_LANGUAGES.map((lang) => {
            const isSelected = selectedLang.id === lang.id;
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => handleSelectLanguage(lang)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                    : 'bg-[#1b140d] hover:bg-[#281d13] text-stone-300 hover:text-white border border-[#2d2116]'
                }`}
              >
                <span>{lang.nativeName}</span>
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Voice Roster & Previews (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>Каталог студийных голосов</span>
            </h3>
            <span className="text-[10px] font-mono text-stone-500">
              {voices.length} актёров
            </span>
          </div>

          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            {voices.map((v) => {
              const isSelected = selectedVoiceId === v.id;
              const isPlayingThis = activePreviewId === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVoiceId(v.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#22170f] border-amber-500 shadow-md shadow-amber-500/10'
                      : 'bg-[#140f0b] border-[#291e14] hover:border-stone-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{v.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-amber-400 stroke-[3]" />}
                      </div>
                      <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">
                        {v.category} · {v.accent}
                      </div>
                    </div>

                    {/* Listen preview button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayVoicePreview(v);
                      }}
                      className={`p-2 rounded-lg border text-xs transition-colors flex items-center justify-center ${
                        isPlayingThis
                          ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                          : 'bg-[#1b140e] text-stone-300 border-[#302316] hover:text-white hover:bg-[#281b12]'
                      }`}
                      title="Прослушать превью тембра"
                    >
                      {isPlayingThis ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {v.description && (
                    <p className="text-[11px] text-stone-400 mt-2 leading-relaxed line-clamp-2">
                      {v.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Voice Fine-Tuning Sliders */}
          <div className="p-4 rounded-xl bg-[#140f0b] border border-[#2b2015] space-y-3.5 text-xs">
            <span className="font-bold text-white flex items-center gap-1.5 font-mono">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Тонкие настройки (Voice Settings)</span>
            </span>

            <div>
              <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                <span>Скорость темпа</span>
                <span className="font-mono text-white">{speed}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.3"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                <span>Стабильность (Stability)</span>
                <span className="font-mono text-white">{(stability * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={stability}
                onChange={(e) => setStability(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Script Editor & Controls (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2015] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  Текст озвучки ({selectedLang.nativeName})
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  Актёр: {currentSelectedVoiceObj.name}
                </span>
              </div>
              <span className="text-[11px] text-stone-500 font-mono">
                {text.length} симв · ~{(text.length / 15).toFixed(0)} сек
              </span>
            </div>

            {/* Quick Director Insertion Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-[#0f0c08] border border-[#22180f] text-[11px]">
              <span className="text-stone-500 font-mono text-[10px] uppercase tracking-wider pl-1">
                Вставка:
              </span>
              <button
                type="button"
                onClick={() => handleInsertPause(1.0)}
                className="px-2 py-1 rounded bg-[#1c140d] hover:bg-[#2b1e13] text-stone-300 hover:text-white border border-[#2f2115] transition-colors"
              >
                + Пауза 1с
              </button>
              <button
                type="button"
                onClick={() => handleInsertPause(2.5)}
                className="px-2 py-1 rounded bg-[#1c140d] hover:bg-[#2b1e13] text-stone-300 hover:text-white border border-[#2f2115] transition-colors"
              >
                + Пауза 2.5с
              </button>
              <button
                type="button"
                onClick={() => handleInsertDirection('интригующе')}
                className="px-2 py-1 rounded bg-[#1c140d] hover:bg-[#2b1e13] text-stone-300 hover:text-white border border-[#2f2115] transition-colors"
              >
                + [интригующе]
              </button>
              <button
                type="button"
                onClick={() => handleInsertDirection('шёпот')}
                className="px-2 py-1 rounded bg-[#1c140d] hover:bg-[#2b1e13] text-stone-300 hover:text-white border border-[#2f2115] transition-colors"
              >
                + [шёпот]
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              dir={selectedLang.direction || 'ltr'}
              className="w-full bg-[#18120c] border border-[#2d2015] rounded-xl p-3.5 text-xs md:text-sm text-stone-200 focus:outline-none focus:border-amber-500 leading-relaxed font-mono resize-y"
              placeholder="Введите текст для озвучки..."
            />

            {/* In-Frame Caption Banner */}
            <div className="p-3.5 rounded-xl bg-[#0f0c08] border border-[#22180f] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-stone-400">
                Надпись в кадре (на языке ролика):
              </span>
              <span className="font-bold text-amber-300 font-mono bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                {selectedLang.sampleCaption}
              </span>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSynthesize}
                  disabled={isSynthesizing}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    studioMode === 'pro_api' && apiKey
                      ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-[#221810] hover:bg-[#2e2015] text-stone-200 border-[#382718]'
                  }`}
                >
                  {isSynthesizing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Рендеринг Lumean API...</span>
                    </>
                  ) : isPlayingFull ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Остановить</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {studioMode === 'pro_api' && apiKey
                          ? 'Синтез в студийном качестве'
                          : 'Прослушать черновик'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToTimeline}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Plus className="w-4 h-4 fill-black" />
                <span>Добавить дорожку на таймлайн</span>
              </button>
            </div>
          </div>

          {/* Subtitles & Timings Inspector if generated */}
          {generatedSubtitles && (
            <div className="p-4 rounded-xl bg-[#140f0b] border border-[#2b2015] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Синхронизированные субтитры (.SRT)</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  ✓ Синхронизировано по словам
                </span>
              </div>
              <pre className="p-3 rounded-lg bg-[#0e0a07] border border-[#20170f] font-mono text-[11px] text-stone-300 overflow-x-auto whitespace-pre-wrap">
                {generatedSubtitles}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
