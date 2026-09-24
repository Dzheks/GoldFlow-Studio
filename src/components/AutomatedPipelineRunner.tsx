import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  CheckCircle2,
  RefreshCw,
  Film,
  Camera,
  Layers,
  ShieldCheck,
  Volume2,
  Sliders,
  ChevronRight,
  ArrowRight,
  Video,
  FileText,
  Clock,
  Wand2,
  Edit3,
  Eye,
  Check,
} from 'lucide-react';
import {
  generateGoldflowPipeline,
  generateGoldflowPipelineAsync,
  GeneratedGoldFlowPipeline,
  ArchitectBlock,
  HeroReference,
} from '../utils/goldflowPipeline';
import { StoryScene, TimelineClip, ProjectData } from '../types';
import { soundEngine } from '../utils/audioSynthesizer';

interface AutomatedPipelineRunnerProps {
  project: ProjectData;
  onUpdateProject: (updated: Partial<ProjectData>) => void;
  onGoToMontage: () => void;
  onGoToVideo?: () => void;
  onToast: (msg: string) => void;
}

export const AutomatedPipelineRunner: React.FC<AutomatedPipelineRunnerProps> = ({
  project,
  onUpdateProject,
  onGoToMontage,
  onGoToVideo,
  onToast,
}) => {
  // Input states
  const [inputMode, setInputMode] = useState<'prompt' | 'custom_text'>('prompt');
  const [topicPrompt, setTopicPrompt] = useState<string>('');
  const [customFullScript, setCustomFullScript] = useState<string>('');
  const [heroOverride, setHeroOverride] = useState<string>('');

  // Execution states
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [executionLog, setExecutionLog] = useState<string>('');
  const [lastPipelineData, setLastPipelineData] = useState<GeneratedGoldFlowPipeline | null>(null);
  const [isSimulatedResult, setIsSimulatedResult] = useState<boolean>(false);

  // Real Google Flow bridge status (Playwright-controlled Chrome, not a pasted token)
  const [flowStatus, setFlowStatus] = useState<{
    loggedIn: boolean;
    hasProject: boolean;
    projectId: string | null;
  } | null>(null);
  const [isFlowLoginPending, setIsFlowLoginPending] = useState<boolean>(false);

  const refreshFlowStatus = async () => {
    try {
      const res = await fetch('/api/flow/status');
      const data = await res.json();
      setFlowStatus(data);
    } catch {
      setFlowStatus(null);
    }
  };

  useEffect(() => {
    refreshFlowStatus();
    const interval = setInterval(refreshFlowStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleFlowLogin = async () => {
    setIsFlowLoginPending(true);
    try {
      const res = await fetch('/api/flow/login', { method: 'POST' });
      const data = await res.json();
      onToast(data.message || '🔑 Окно входа в Google Flow открыто на этом компьютере');
    } catch {
      onToast('❌ Не удалось открыть окно входа Flow — проверьте, что сервер запущен');
    } finally {
      setIsFlowLoginPending(false);
      setTimeout(refreshFlowStatus, 3000);
    }
  };

  // View & Inspection states
  const [activeStageTab, setActiveStageTab] = useState<'01' | '02' | '03' | '04' | '05' | '06'>('01');
  const [previewingSceneIndex, setPreviewingSceneIndex] = useState<number | null>(null);

  const QUICK_PROMPTS = [
    'ролик про ограбление банка в Нигерии',
    'почему самолёты не летают через Тихий океан',
    'история кофе: от эфиопских монахов до эспрессо',
    'рождение суперкара: тайная разработка в Маранелло',
  ];

  const STAGES = [
    {
      id: '01',
      num: '01',
      name: 'Архитектор',
      shortDesc: 'Строит скелет',
      fullDesc: 'Композиция фильма: сколько блоков, о чём каждый и чем обязан кончиться.',
      icon: Layers,
    },
    {
      id: '02',
      num: '02',
      name: 'Сценарист',
      shortDesc: 'Пишет по блокам',
      fullDesc: 'Текст пишется блок за блоком, развязка не выскакивает раньше времени.',
      icon: FileText,
    },
    {
      id: '03',
      num: '03',
      name: 'Раскадровщик',
      shortDesc: 'Кадр на строку (9 полей)',
      fullDesc: 'Каждой строке — кадр по 9 полям: план, действие, момент, свет, фактура...',
      icon: Camera,
    },
    {
      id: '04',
      num: '04',
      name: 'Эталоны',
      shortDesc: 'Держат героев',
      fullDesc: 'Герой и место фиксируются один раз и идут образцом в каждый кадр.',
      icon: ShieldCheck,
    },
    {
      id: '05',
      num: '05',
      name: 'Камеры',
      shortDesc: 'Кадры оживают',
      fullDesc: 'Каждый кадр превращается в план с выверенным движением камеры.',
      icon: Video,
    },
    {
      id: '06',
      num: '06',
      name: 'Монтаж',
      shortDesc: 'Синхронизация с речью',
      fullDesc: 'По разметке синтезатора каждый кадр встаёт ровно под своей фразой.',
      icon: Film,
    },
  ];

  // Initialize with Nigeria heist if project has default scenes
  useEffect(() => {
    if (!lastPipelineData) {
      const init = generateGoldflowPipeline(topicPrompt, heroOverride, 'ru');
      setLastPipelineData(init);
      setIsSimulatedResult(true);
    }
  }, []);

  // Run the complete automated 6-stage pipeline — calls the real Gemini backend
  // (script + Nano Banana images); falls back to the offline demo template if
  // no GEMINI_API_KEY is configured on the server.
  const handleExecutePipeline = async () => {
    const promptToUse = inputMode === 'prompt' ? topicPrompt.trim() : 'Пользовательский сценарий';
    if (!promptToUse && inputMode === 'prompt') {
      onToast('Пожалуйста, введите тему для сценария');
      return;
    }

    setIsExecuting(true);
    setCurrentStageIndex(0);
    setExecutionLog('01–03 — Архитектор и сценарист пишут сюжет и раскадровку (Gemini)...');

    try {
      const { pipeline: result, isSimulated, error } = await generateGoldflowPipelineAsync(
        topicPrompt,
        heroOverride || undefined,
        'ru',
        inputMode === 'custom_text' ? customFullScript : undefined,
        (project.aspectRatio as any) || '16:9',
        project.model || 'NARWHAL',
        (stageIndex, message) => {
          setCurrentStageIndex(stageIndex);
          setExecutionLog(message);
        }
      );

      setLastPipelineData(result);
      setIsSimulatedResult(isSimulated);
      onUpdateProject({
        scenes: result.scenes,
        scriptText: result.scriptText,
        timelineClips: result.timelineClips,
        duration: result.totalDuration,
      });

      setCurrentStageIndex(5);
      setIsExecuting(false);
      setActiveStageTab('01');

      if (isSimulated) {
        onToast(
          error
            ? `⚠️ Реальная генерация недоступна (${error}). Показан демо-шаблон — настройте GEMINI_API_KEY на сервере.`
            : '⚠️ Часть кадров не удалось сгенерировать реально — использованы заглушки для недостающих.'
        );
      } else {
        onToast(`🎉 Конвейер выполнил все 6 этапов через реальный Gemini API! Создано ${result.scenes.length} планов.`);
      }
    } catch (err: any) {
      setIsExecuting(false);
      onToast(`❌ Ошибка конвейера: ${err?.message || 'неизвестная ошибка'}`);
    }
  };

  const currentPipeline = lastPipelineData || generateGoldflowPipeline(topicPrompt, heroOverride, 'ru');

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#140f0b] border border-[#2e2115] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-3 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/40">
              <Sparkles className="w-3.5 h-3.5" />
              <span>КОНВЕЙЕР ПРОИЗВОДСТВА · 01—06</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputMode('prompt')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  inputMode === 'prompt'
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-[#1b140d] text-stone-400 hover:text-white border border-[#302216]'
                }`}
              >
                Одна строка запроса
              </button>
              <button
                type="button"
                onClick={() => setInputMode('custom_text')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  inputMode === 'custom_text'
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-[#1b140d] text-stone-400 hover:text-white border border-[#302216]'
                }`}
              >
                Подробный текст дословно
              </button>
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Сильный сценарий — с одной строки запроса
          </h2>
          <p className="text-xs md:text-sm text-stone-400 max-w-3xl leading-relaxed">
            Строки «ролик про ограбление банка в Нигерии» уже достаточно. Хотите держать вожжи — вставьте готовый текст: он пойдёт в ролик дословно. Дальше софт выполняет всю цепочку — композиция, закадровый текст, кадр под каждую строку по 9 полям, эталоны героев и монтаж под голос.
          </p>

          {/* INPUT FORM */}
          <div className="pt-2 space-y-3">
            {inputMode === 'prompt' ? (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={topicPrompt}
                    onChange={(e) => setTopicPrompt(e.target.value)}
                    placeholder="Например: ролик про ограбление банка в Нигерии..."
                    className="flex-1 bg-[#100c08] border border-[#302316] rounded-xl px-4 py-3 text-xs md:text-sm text-white focus:outline-none focus:border-amber-500 font-mono shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleExecutePipeline}
                    disabled={isExecuting}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs md:text-sm transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Конвейер работает...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 fill-black" />
                        <span>⚡ Запустить конвейер по 6 этапам</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="text-stone-500 font-mono text-[10px] uppercase">Быстрые запросы:</span>
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setTopicPrompt(qp);
                        onToast(`Выбрано: «${qp}»`);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#19120c] hover:bg-[#251910] border border-[#2e2015] hover:border-amber-500/40 text-stone-300 hover:text-amber-200 transition-colors"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={customFullScript}
                  onChange={(e) => setCustomFullScript(e.target.value)}
                  rows={5}
                  placeholder="Вставьте ваш готовый текст абзац за абзацем..."
                  className="w-full bg-[#100c08] border border-[#302316] rounded-xl p-3.5 text-xs md:text-sm text-stone-200 font-mono focus:outline-none focus:border-amber-500 leading-relaxed"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500 font-mono">
                    Текст будет разбит на блоки и пойдёт в фильм дословно.
                  </span>
                  <button
                    type="button"
                    onClick={handleExecutePipeline}
                    disabled={isExecuting}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs md:text-sm shadow-md flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Собрать фильм из текста</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LIVE PROGRESS STATUS WHEN EXECUTING */}
      {isExecuting && (
        <div className="p-4 rounded-xl bg-[#1b130a] border border-amber-500/40 shadow-lg flex items-center gap-3 animate-in fade-in duration-200">
          <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-xs font-mono font-bold text-amber-300">
              <span>{executionLog}</span>
              <span>Этап {currentStageIndex + 1} из 6</span>
            </div>
            <div className="w-full h-1.5 bg-[#2d1e13] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                style={{ width: `${((currentStageIndex + 1) / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* REAL GOOGLE FLOW SESSION STATUS — Playwright-controlled Chrome, not a pasted token */}
      <div
        className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
          flowStatus?.loggedIn && flowStatus?.hasProject
            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
            : 'bg-[#1b140d] border-amber-600/30 text-stone-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${flowStatus?.loggedIn && flowStatus?.hasProject ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
          {flowStatus?.loggedIn && flowStatus?.hasProject ? (
            <span>
              Google Flow подключён (проект <span className="font-mono text-emerald-300">{flowStatus.projectId}</span>) — картинки будут генерироваться через вашу подписку Flow.
            </span>
          ) : flowStatus?.loggedIn ? (
            <span>Google Flow: вы залогинены, но нет открытого проекта — откройте любой проект во вкладке Flow.</span>
          ) : (
            <span>Google Flow не подключён — картинки пойдут через Gemini API (платно за кадр) или демо-заглушку.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshFlowStatus}
            className="px-2.5 py-1 rounded-lg bg-[#241a11] hover:bg-[#34261a] border border-[#3b2b1d] text-stone-300 transition-colors"
          >
            Обновить
          </button>
          <button
            type="button"
            onClick={handleFlowLogin}
            disabled={isFlowLoginPending}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors disabled:opacity-50"
          >
            {isFlowLoginPending ? 'Открываю окно...' : flowStatus?.loggedIn ? 'Войти снова' : 'Войти в Google Flow'}
          </button>
        </div>
      </div>

      {/* SIMULATED/DEMO MODE WARNING — shown whenever real generation was unavailable */}
      {!isExecuting && isSimulatedResult && (
        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <span className="text-base leading-none">⚠️</span>
          <span>
            Это демо-заглушка, не реальная генерация. Настройте <code className="font-mono bg-black/30 px-1 rounded">GEMINI_API_KEY</code> в{' '}
            <code className="font-mono bg-black/30 px-1 rounded">.env</code> на сервере, чтобы сценарий и кадры генерировались по-настоящему.
          </span>
        </div>
      )}

      {/* 6 STAGE STEPPER BUTTONS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STAGES.map((st, idx) => {
          const Icon = st.icon;
          const isActive = activeStageTab === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setActiveStageTab(st.id as any)}
              className={`p-3 rounded-xl border text-left transition-all relative ${
                isActive
                  ? 'bg-[#22180f] border-amber-500/80 shadow-md shadow-amber-500/5'
                  : 'bg-[#140e0a] border-[#291d13] hover:border-[#3d2a1b]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-amber-400">
                  {st.num}
                </span>
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? 'text-amber-400' : 'text-stone-500'
                  }`}
                />
              </div>
              <div className="text-xs font-bold text-white truncate">{st.name}</div>
              <div className="text-[10px] text-stone-400 truncate mt-0.5">
                {st.shortDesc}
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-amber-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* STAGE RESULTS CONTENT PANELS */}
      <div className="rounded-2xl bg-[#130e0a] border border-[#2a1e13] p-5 md:p-6 space-y-5">
        {/* TAB 01: АРХИТЕКТОР СТРОИТ СКЕЛЕТ */}
        {activeStageTab === '01' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#24180e]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>01 — Архитектор строит скелет композиции</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Сначала — композиция всего фильма: сколько блоков, о чём каждый и чем он обязан кончиться. Без скелета сценарист к середине забывает начало.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#1c140d] text-amber-300 border border-[#362516]">
                {currentPipeline.architectBlocks.length} драматических блоков
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {currentPipeline.architectBlocks.map((blk) => (
                <div
                  key={blk.blockNum}
                  className="p-4 rounded-xl bg-[#18110b] border border-[#2c1d12] hover:border-amber-500/30 transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 font-mono">
                      {blk.title}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">
                      {blk.pacing}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-stone-500 block">
                        О чём блок:
                      </span>
                      <p className="text-stone-300 leading-snug">{blk.objective}</p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-mono text-stone-500 block">
                        Чем обязан кончиться:
                      </span>
                      <p className="text-amber-200/90 font-medium leading-snug">
                        {blk.mandatoryEnd}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 02: СЦЕНАРИСТ ПИШЕТ ПО БЛОКАМ */}
        {activeStageTab === '02' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#24180e]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>02 — Сценарист пишет по блокам</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Текст пишется не одной простынёй, а блок за блоком, и каждый знает своё место в фильме. Развязка не выскакивает на пятой минуте.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#1c140d] text-amber-300 border border-[#362516]">
                Всего слов: {currentPipeline.scriptText.split(/\s+/).length}
              </span>
            </div>

            <div className="space-y-3">
              {currentPipeline.scenes.map((sc, idx) => (
                <div
                  key={sc.id}
                  className="p-3.5 rounded-xl bg-[#18110b] border border-[#2c1d12] flex items-start gap-4"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/20">
                    0{idx + 1}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-300 font-mono">
                        {sc.title}
                      </span>
                      <span className="text-[11px] font-mono text-amber-400">
                        ~{sc.duration} сек
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-stone-200 leading-relaxed font-sans">
                      {sc.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 03: РАСКАДРОВЩИК ПРИДУМЫВАЕТ КАДР НА СТРОКУ (ПО 9 ПОЛЯМ) */}
        {activeStageTab === '03' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#24180e]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>03 — Раскадровщик придумывает кадр на строку (9 полей)</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Каждой строке закадрового текста — свой кадр по девяти полям: план, действие, момент, свет, фактура. Не «иллюстрация к теме», а то, что видно в эту секунду.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#1c140d] text-amber-300 border border-[#362516]">
                {currentPipeline.scenes.length} скомпилированных планов
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentPipeline.scenes.map((sc, idx) => (
                <div
                  key={sc.id}
                  className="p-4 rounded-xl bg-[#18110b] border border-[#2c1d12] space-y-3"
                >
                  <div className="flex items-center gap-3">
                    {sc.generatedImageUrl && (
                      <img
                        src={sc.generatedImageUrl}
                        alt={sc.title}
                        className="w-24 h-14 rounded-lg object-cover border border-[#382618] shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-amber-300 font-mono truncate">
                        Кадр {idx + 1} · {sc.title}
                      </div>
                      <div className="text-[11px] text-stone-400 line-clamp-2 mt-0.5">
                        "{sc.description}"
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#110c08] border border-[#23170e] text-[11px] font-mono text-stone-300 space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase font-bold block">
                      Кинематографический промпт по 9 полям:
                    </span>
                    <p className="leading-relaxed line-clamp-3 text-stone-400">
                      {sc.prompt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 04: ЭТАЛОНЫ ДЕРЖАТ ГЕРОЕВ */}
        {activeStageTab === '04' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#24180e]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>04 — Эталоны держат героев и локацию</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Герой и место снимаются один раз и дальше идут образцом в каждый кадр, где участвуют. Описанный словами человек выходит в каждой сцене другим — показанный картинкой остаётся собой.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#1c140d] text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Консистентность активна</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Hero Master Card */}
              <div className="p-5 rounded-xl bg-[#18110b] border border-[#302216] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                      Эталон Персонажа #1
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-500">
                    Образец закреплён
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <img
                    src={currentPipeline.heroMaster.thumbnailUrl}
                    alt={currentPipeline.heroMaster.name}
                    className="w-24 h-24 rounded-xl object-cover border border-amber-500/40 shadow-md"
                  />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">
                      {currentPipeline.heroMaster.name}
                    </h4>
                    <p className="text-xs text-amber-400 font-mono">
                      {currentPipeline.heroMaster.role}
                    </p>
                    <p className="text-[11px] text-stone-400 leading-snug">
                      {currentPipeline.heroMaster.appearance}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs border-t border-[#261a10] pt-3 text-stone-300">
                  <div>
                    <span className="text-[10px] font-mono text-stone-500 uppercase block">
                      Одежда:
                    </span>
                    <span>{currentPipeline.heroMaster.clothing}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-stone-500 uppercase block">
                      Ключевая примета:
                    </span>
                    <span className="text-amber-200">{currentPipeline.heroMaster.keyFeature}</span>
                  </div>
                </div>
              </div>

              {/* Location Master Card */}
              <div className="p-5 rounded-xl bg-[#18110b] border border-[#302216] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                    Эталон Локации #1
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">
                    Привязка к кадрам
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#110c08] border border-[#23170e] space-y-2">
                  <div className="text-xs font-bold text-white">
                    {currentPipeline.heroMaster.locationMaster}
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Все сцены внутри и вокруг хранилища используют единую цветовую гамму, фактуру материалов (бетон, бронесталь, желтые автобусы Лагоса) и направление света.
                  </p>
                </div>

                <div className="text-xs text-stone-400 flex items-center gap-2 pt-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>В промпты всех {currentPipeline.scenes.length} планов включён тег эталона.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 05: КАДРЫ ОЖИВАЮТ (ДВИЖЕНИЕ КАМЕРЫ & VEO 3) */}
        {activeStageTab === '05' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#24180e]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Video className="w-4 h-4 text-amber-400" />
                  <span>05 — Кадры оживают (Движение камеры & Veo 3)</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Каждый кадр превращается в план с движением камеры. Ролик занимает ровно то место, которое занимала бы фотография, — поэтому дальше монтаж и сходится с озвучкой.
                </p>
              </div>
              {onGoToVideo && (
                <button
                  type="button"
                  onClick={onGoToVideo}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Открыть Veo 3 Студию →</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {currentPipeline.scenes.map((sc) => (
                <div
                  key={sc.id}
                  className="rounded-xl bg-[#18110b] border border-[#2b1e13] overflow-hidden group hover:border-amber-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="relative aspect-video bg-black">
                    {sc.generatedImageUrl && (
                      <img
                        src={sc.generatedImageUrl}
                        alt={sc.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-amber-300">
                      {sc.motionType}
                    </div>
                  </div>

                  <div className="p-2.5 space-y-1">
                    <div className="text-[11px] font-bold text-white truncate">
                      {sc.title}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      Длительность: {sc.duration}с
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 06: МОНТАЖ КЛАДЁТСЯ ПО СЛОВАМ ОЗВУЧКИ */}
        {activeStageTab === '06' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#24180e]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-400" />
                  <span>06 — Монтаж кладётся по словам озвучки</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Не «примерно поровну», а по разметке синтезатора: каждый кадр стоит ровно под своей фразой. Поэтому картинка не уезжает от голоса к середине фильма.
                </p>
              </div>

              <button
                type="button"
                onClick={onGoToMontage}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg"
              >
                <span>🎬 Открыть фильм в Студии Монтажа</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Visual Timeline Synchronization Bars */}
            <div className="space-y-3 bg-[#110c08] p-4 rounded-xl border border-[#23170e]">
              <div className="flex items-center justify-between text-xs font-mono text-stone-400 pb-2 border-b border-[#1f150d]">
                <span>Хронометраж проекта: {currentPipeline.totalDuration} сек</span>
                <span className="text-amber-400 font-bold">Видеодорожка + Голос + Саундтрек</span>
              </div>

              {/* Video Track */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-stone-500 uppercase block">
                  1. Видеоряд (Кадры встык по длительности фраз):
                </span>
                <div className="flex w-full h-8 bg-[#18110a] rounded-lg overflow-hidden border border-[#291b10] gap-0.5 p-0.5">
                  {currentPipeline.scenes.map((sc, i) => {
                    const widthPercent = (sc.duration / currentPipeline.totalDuration) * 100;
                    return (
                      <div
                        key={sc.id}
                        style={{ width: `${widthPercent}%` }}
                        className="h-full bg-gradient-to-r from-amber-600/40 to-amber-500/40 hover:from-amber-500 hover:to-yellow-400 transition-colors rounded-sm flex items-center justify-center text-[10px] font-mono text-amber-100 px-1 truncate cursor-pointer"
                        title={`${sc.title} (${sc.duration}с)`}
                      >
                        План {i + 1} ({sc.duration}с)
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Voice Track */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-mono text-stone-500 uppercase block">
                  2. Озвучка (Разметка синтезатора речи):
                </span>
                <div className="flex w-full h-7 bg-[#10141a] rounded-lg overflow-hidden border border-[#1b2636] gap-0.5 p-0.5">
                  {currentPipeline.scenes.map((sc, i) => {
                    const widthPercent = (sc.duration / currentPipeline.totalDuration) * 100;
                    return (
                      <div
                        key={sc.id}
                        style={{ width: `${widthPercent}%` }}
                        className="h-full bg-blue-600/40 hover:bg-blue-500/60 rounded-sm flex items-center justify-center text-[10px] font-mono text-blue-200 px-1 truncate cursor-pointer"
                        title={`Озвучка: "${sc.description}"`}
                      >
                        Фраза {i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Music Track */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-mono text-stone-500 uppercase block">
                  3. Музыкальная подложка:
                </span>
                <div className="w-full h-5 bg-emerald-950/40 border border-emerald-900/30 rounded-lg flex items-center px-3 text-[10px] font-mono text-emerald-300">
                  Саундтрек: Кинематографичный саспенс (Громкость: 25%)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QUICK FOOTER ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#16100b] border border-[#2e2015]">
        <div className="flex items-center gap-2 text-xs text-stone-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>
            Проект готов к сборке: <strong className="text-white">{currentPipeline.scenes.length} планов</strong>, <strong className="text-white">{currentPipeline.totalDuration} сек</strong>, эталон героя зафиксирован.
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExecutePipeline}
            disabled={isExecuting}
            className="px-4 py-2 rounded-lg bg-[#22170f] hover:bg-[#302116] text-stone-200 text-xs font-semibold border border-[#3b2a1c] transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Пересобрать</span>
          </button>

          <button
            type="button"
            onClick={onGoToMontage}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-extrabold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Перейти в Монтаж и рендер →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
