import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Download,
  Plus,
  X,
  Film,
} from 'lucide-react';
import { StoryScene } from '../types';
import { GENERATION_VIDEO_MODELS } from '../config/models';
import { ASPECT_RATIO_OPTIONS, AspectRatioKey } from '../config/aspectRatios';
import {
  generateVideoReal,
  pollVideoStatusReal,
  getVideoStreamUrl,
  getVideoDownloadUrl,
} from '../services/geminiPipelineClient';

interface VideoStudioProps {
  onBack: () => void;
  credits: number;
  onDeductCredits: (amount: number) => boolean;
  onOpenRecharge?: () => void;
  onAddVideoToTimeline?: (videoData: {
    title: string;
    videoUrl: string;
    duration: number;
    aspectRatio: '16:9' | '9:16';
    prompt: string;
  }) => void;
  projectScenes?: StoryScene[];
}

type SourceMode = 'text' | 'frames' | 'references';
type PickedImage = { base64: string; mimeType: string; label: string };

interface HistoryEntry {
  id: string;
  prompt: string;
  modelName: string;
  aspectRatio: AspectRatioKey;
  operationName: string;
  count: number;
  createdAt: number;
}

// Only 16:9 and 9:16 actually reach the Veo API — the SDK's own config type
// documents these as the only supported ratios. The other three format
// buttons stay visible (goldflow.ru shows all five) but are disabled rather
// than silently rendering a different ratio than what was clicked.
const REAL_RATIOS: AspectRatioKey[] = ['16:9', '9:16'];

const MAX_PROMPT_CHARS = 40000;

export const VideoStudio: React.FC<VideoStudioProps> = ({
  onBack,
  credits,
  onDeductCredits,
  onOpenRecharge,
  onAddVideoToTimeline,
  projectScenes = [],
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('text');
  const [modelCode, setModelCode] = useState<string>('VEO_3_1_FAST');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>('9:16');
  const [count, setCount] = useState<number>(1);

  const [customUploads, setCustomUploads] = useState<PickedImage[]>([]);
  const [firstFrame, setFirstFrame] = useState<PickedImage | null>(null);
  const [lastFrame, setLastFrame] = useState<PickedImage | null>(null);
  const [referenceSel, setReferenceSel] = useState<PickedImage[]>([]);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const activeModel = GENERATION_VIDEO_MODELS.find((m) => m.code === modelCode) || GENERATION_VIDEO_MODELS[0];
  const maxReferenceImages = modelCode === 'GEMINI_OMNI_FLASH' ? 7 : 3;
  const supportsLastFrame = modelCode !== 'GEMINI_OMNI_FLASH';

  const totalCost = activeModel.creditCost * count;
  const remaining = credits - totalCost;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 4000);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Omni Flash has no last-frame support — drop any selection if the user
  // switches to it with one already picked.
  useEffect(() => {
    if (!supportsLastFrame) setLastFrame(null);
  }, [supportsLastFrame]);

  // Trim reference selection down when switching to a model with a smaller cap.
  useEffect(() => {
    setReferenceSel((prev) => prev.slice(0, maxReferenceImages));
  }, [maxReferenceImages]);

  const pickerItems: PickedImage[] = [
    ...customUploads,
    ...projectScenes
      .filter((s) => s.generatedImageUrl)
      .map((s) => ({
        base64: s.generatedImageUrl!,
        mimeType: 'image/png',
        label: s.prompt || s.title,
      })),
  ];

  const readFileAsPickedImage = (file: File): Promise<PickedImage> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: reader.result as string, mimeType: file.type || 'image/png', label: file.name });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUploadFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const img = await readFileAsPickedImage(file);
      setCustomUploads((prev) => [img, ...prev]);
      applyPick(img);
    } catch {
      showToast('Не удалось прочитать файл');
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (file) await handleUploadFile(file);
  };

  // Applying a pick behaves differently per tab: single-select for frames,
  // multi-select (up to the model's cap) for references.
  const applyPick = (img: PickedImage) => {
    if (sourceMode === 'frames') {
      setFirstFrame(img);
    } else if (sourceMode === 'references') {
      setReferenceSel((prev) => {
        const exists = prev.some((p) => p.base64 === img.base64);
        if (exists) return prev.filter((p) => p.base64 !== img.base64);
        if (prev.length >= maxReferenceImages) {
          showToast(`Максимум ${maxReferenceImages} референсов для ${activeModel.name}`);
          return prev;
        }
        return [...prev, img];
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Опиши сцену и движение камеры — поле пустое');
      return;
    }
    if (sourceMode === 'frames' && !firstFrame) {
      showToast('Выбери первый кадр или очисти вкладку «Кадры»');
      return;
    }
    if (credits < totalCost) {
      showToast(`Недостаточно кредитов (нужно ${totalCost})`);
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Запускаем генерацию...');

    try {
      const res = await generateVideoReal({
        prompt: prompt.trim(),
        aspectRatio: (REAL_RATIOS.includes(aspectRatio) ? aspectRatio : '16:9') as '16:9' | '9:16',
        modelCode,
        count,
        firstFrame: sourceMode === 'frames' && firstFrame ? { base64: firstFrame.base64, mimeType: firstFrame.mimeType } : undefined,
        lastFrame: sourceMode === 'frames' && lastFrame ? { base64: lastFrame.base64, mimeType: lastFrame.mimeType } : undefined,
        referenceImages: sourceMode === 'references' ? referenceSel.map((r) => ({ base64: r.base64, mimeType: r.mimeType })) : undefined,
      });

      if (!res.operationName) {
        showToast(`❌ Не удалось запустить генерацию: ${res.error || 'неизвестная ошибка'}`);
        setIsGenerating(false);
        return;
      }

      onDeductCredits(totalCost);
      const opName = res.operationName;
      setStatusMessage(`${activeModel.name} рендерит видео (обычно 1-3 минуты)...`);

      pollIntervalRef.current = setInterval(async () => {
        const status = await pollVideoStatusReal(opName);
        if (status.error) {
          clearInterval(pollIntervalRef.current);
          setIsGenerating(false);
          showToast(`❌ Ошибка генерации: ${typeof status.error === 'string' ? status.error : status.error?.message || 'неизвестная'}`);
          return;
        }
        if (status.done) {
          clearInterval(pollIntervalRef.current);
          setIsGenerating(false);
          setStatusMessage('');
          const entry: HistoryEntry = {
            id: `hist-${Date.now()}`,
            prompt: prompt.trim(),
            modelName: activeModel.name,
            aspectRatio,
            operationName: opName,
            count: status.count || count,
            createdAt: Date.now(),
          };
          setHistory((prev) => [entry, ...prev]);
          showToast(`🎉 Готово — ${status.count || count} ролик(ов) через ${activeModel.name}`);
        }
      }, 4000);
    } catch (err: any) {
      setIsGenerating(false);
      showToast(`❌ Ошибка: ${err?.message || 'неизвестная'}`);
    }
  };

  const handleAddHistoryClipToMontage = (entry: HistoryEntry, index: number) => {
    if (!onAddVideoToTimeline) return;
    onAddVideoToTimeline({
      title: `${entry.modelName}: ${entry.prompt.slice(0, 24)}...`,
      videoUrl: getVideoStreamUrl(entry.operationName, index),
      duration: 8,
      aspectRatio: entry.aspectRatio === '9:16' ? '9:16' : '16:9',
      prompt: entry.prompt,
    });
    showToast('🎬 Ролик добавлен на таймлайн монтажа!');
  };

  const renderPickerRow = (
    selected: PickedImage | null,
    onSelect: (img: PickedImage) => void,
    isSelected: (img: PickedImage) => boolean
  ) => (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => uploadInputRef.current?.click()}
        className="shrink-0 w-14 h-14 rounded-lg bg-[#1b140e] border border-dashed border-[#3b2b1d] hover:border-amber-500/60 text-stone-400 hover:text-amber-300 flex items-center justify-center transition-colors"
        title="Загрузить своё изображение"
      >
        <Plus className="w-4 h-4" />
      </button>
      {pickerItems.map((img, i) => (
        <button
          key={`${img.base64.slice(0, 24)}-${i}`}
          type="button"
          onClick={() => onSelect(img)}
          className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
            isSelected(img) ? 'border-amber-400' : 'border-transparent hover:border-amber-500/40'
          }`}
          title={img.label}
        >
          <img src={img.base64} alt={img.label} className="w-full h-full object-cover" />
          {img.label && (
            <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[7px] leading-tight text-stone-200 px-0.5 py-0.5 line-clamp-2">
              {img.label.slice(0, 26)}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6" onPaste={handlePaste}>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleUploadFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e150f] text-amber-300 border border-amber-500/50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-mono animate-in fade-in duration-200 max-w-sm">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Назад</span>
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Видео</h1>
        <p className="text-xs text-stone-400 mt-1">
          Veo 3.1 через Gemini API. Ролик делается 1–3 минуты, списывается только за удавшуюся генерацию.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column */}
        <div className="lg:col-span-8 space-y-5">
          {/* Что происходит в кадре */}
          <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
              Что происходит в кадре
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
              rows={5}
              placeholder="Опиши сцену и движение камеры: что видно, как оно меняется..."
              className="w-full bg-[#1a130e] border border-[#302418] rounded-xl p-3 text-xs md:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70 font-mono leading-relaxed resize-y"
            />
            <div className="text-[10px] text-stone-500 font-mono">
              {prompt.length} / {MAX_PROMPT_CHARS.toLocaleString('ru-RU')}
            </div>
          </div>

          {/* Исходник */}
          <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
              Исходник
            </label>

            <div className="flex gap-2">
              {([
                { id: 'text', label: 'Только текст' },
                { id: 'frames', label: 'Кадры' },
                { id: 'references', label: 'Референсы' },
              ] as { id: SourceMode; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSourceMode(t.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    sourceMode === t.id
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/60'
                      : 'bg-[#1a130e] text-stone-400 hover:text-white border-[#2e2216]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {sourceMode === 'text' && (
              <p className="text-[11px] text-stone-500">Модель придумает кадр с нуля по описанию.</p>
            )}

            {sourceMode === 'frames' && (
              <div className="space-y-4">
                <p className="text-[11px] text-stone-500">
                  Ролик начнётся с выбранной картинки. {supportsLastFrame ? 'Можно задать и последний кадр — тогда движение пойдёт от одного к другому.' : ''}
                </p>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-stone-300">Первый кадр</span>
                    {firstFrame && (
                      <button type="button" onClick={() => setFirstFrame(null)} className="text-[10px] text-stone-500 hover:text-rose-300">
                        Убрать кадр
                      </button>
                    )}
                  </div>
                  {renderPickerRow(firstFrame, (img) => setFirstFrame(img), (img) => firstFrame?.base64 === img.base64)}
                </div>

                {supportsLastFrame ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-stone-300">Последний кадр</span>
                      {lastFrame && (
                        <button type="button" onClick={() => setLastFrame(null)} className="text-[10px] text-stone-500 hover:text-rose-300">
                          Сбросить
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-stone-500 mb-1.5">Необязательно. Ролик придёт к этому кадру.</p>
                    {renderPickerRow(lastFrame, (img) => setLastFrame(img), (img) => lastFrame?.base64 === img.base64)}
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-500 italic">У Omni Flash последнего кадра нет — он есть только у Veo.</p>
                )}
              </div>
            )}

            {sourceMode === 'references' && (
              <div className="space-y-2">
                <p className="text-[11px] text-stone-500">
                  Модель возьмёт отсюда стиль, персонажей и объекты, но начнёт кадр заново. {activeModel.name.includes('Omni') ? 'Omni Flash' : 'Veo'} принимает до {maxReferenceImages}.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-stone-300">
                    Референсы — {referenceSel.length} из {maxReferenceImages}
                  </span>
                </div>
                <p className="text-[10px] text-stone-500">Своё изображение — кнопкой «+» или прямо из буфера: Ctrl+V</p>
                {renderPickerRow(null, (img) => applyPick(img), (img) => referenceSel.some((r) => r.base64 === img.base64))}
              </div>
            )}
          </div>

          {/* История */}
          <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">История</label>
            {history.length === 0 ? (
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Здесь появятся все твои ролики вместе с промптами.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="p-3 rounded-xl bg-[#0f0b08] border border-[#2b2116] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-300 font-mono">
                        {entry.modelName} · {entry.aspectRatio} · {new Date(entry.createdAt).toLocaleTimeString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 leading-snug line-clamp-2">{entry.prompt}</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: entry.count }).map((_, i) => (
                        <div key={i} className="space-y-1">
                          <video
                            src={getVideoStreamUrl(entry.operationName, i)}
                            controls
                            loop
                            playsInline
                            className={`rounded-lg bg-black border border-[#2b2116] ${entry.aspectRatio === '9:16' ? 'w-24 aspect-[9/16]' : 'w-40 aspect-video'}`}
                          />
                          <div className="flex items-center gap-1.5">
                            <a
                              href={getVideoDownloadUrl(entry.operationName, i)}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1c150e] hover:bg-[#2c2117] border border-[#382a1d] text-[9px] text-stone-300"
                              title="Скачать MP4"
                            >
                              <Download className="w-2.5 h-2.5" />
                            </a>
                            {onAddVideoToTimeline && (
                              <button
                                type="button"
                                onClick={() => handleAddHistoryClipToMontage(entry, i)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1c150e] hover:bg-[#2c2117] border border-[#382a1d] text-[9px] text-amber-300"
                                title="В монтаж"
                              >
                                <Film className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 space-y-5">
          {/* Модель */}
          <div className="p-4 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">Модель</label>
            {GENERATION_VIDEO_MODELS.map((m) => (
              <button
                key={m.code}
                type="button"
                onClick={() => setModelCode(m.code)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  modelCode === m.code
                    ? 'bg-amber-500/10 border-amber-500/60'
                    : 'bg-[#1a130e] border-[#2e2216] hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{m.name}</span>
                  <span className="text-[11px] font-mono text-amber-300">{m.creditCost} кр</span>
                </div>
                <p className="text-[10px] text-stone-400 mt-0.5">{m.description}</p>
              </button>
            ))}
            <p className="text-[10px] text-stone-500">Цена указана за 8 секунд</p>
          </div>

          {/* Формат */}
          <div className="p-4 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">Формат</label>
            <div className="grid grid-cols-3 gap-1.5">
              {ASPECT_RATIO_OPTIONS.map((r) => {
                const supported = REAL_RATIOS.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={!supported}
                    onClick={() => setAspectRatio(r.id)}
                    title={supported ? r.label : 'Veo поддерживает только 16:9 и 9:16'}
                    className={`py-2 rounded-lg text-xs font-mono border transition-colors ${
                      aspectRatio === r.id
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/60'
                        : supported
                        ? 'bg-[#1a130e] text-stone-300 hover:text-white border-[#2e2216]'
                        : 'bg-[#140f0b] text-stone-700 border-[#221a12] cursor-not-allowed'
                    }`}
                  >
                    {r.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Сколько роликов */}
          <div className="p-4 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">Сколько роликов</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`py-2 rounded-lg text-xs font-mono border transition-colors ${
                    count === n
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/60'
                      : 'bg-[#1a130e] text-stone-300 hover:text-white border-[#2e2216]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-500">Длительность ролика — 8 секунд. Эта модель снимает только так.</p>
          </div>

          {/* Cost summary */}
          <div className="p-4 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400">Спишется</span>
              <div className="text-right">
                <div className="text-lg font-bold text-white">{totalCost}</div>
                <div className="text-[10px] text-stone-500">кредитов</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400">Останется</span>
              <span className={`text-sm font-mono font-bold ${remaining < 0 ? 'text-rose-400' : 'text-stone-300'}`}>
                {remaining}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenRecharge}
              className="w-full py-2.5 rounded-xl bg-[#1c150e] hover:bg-[#2c2117] border border-[#382a1d] text-stone-200 text-xs font-semibold transition-colors"
            >
              Пополнить баланс
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || remaining < 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{statusMessage || 'Генерация...'}</span>
                </>
              ) : (
                <span>Сгенерировать</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
