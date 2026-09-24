import React, { useRef, useState } from 'react';
import { ArrowLeft, Sparkles, RefreshCw, Download, Plus, Film, Copy } from 'lucide-react';
import { ProjectData, StoryScene } from '../types';
import { GENERATION_IMAGE_MODELS } from '../config/models';
import { ASPECT_RATIO_OPTIONS, AspectRatioKey } from '../config/aspectRatios';
import { generateImageReal } from '../services/geminiPipelineClient';
import { buildSynchronizedTimeline, estimateSpeechDuration } from '../utils/autoAssembly';

interface ImageStudioProps {
  onBack: () => void;
  credits: number;
  onDeductCredits: (amount: number) => boolean;
  onOpenRecharge?: () => void;
  project: ProjectData;
  onUpdateProject: (updated: Partial<ProjectData>) => void;
  onGoToMontage?: () => void;
}

type PickedImage = { base64: string; mimeType: string; label: string };

interface GeneratedImage {
  base64: string;
  mimeType: string;
  addedToMontage: boolean;
}

interface HistoryEntry {
  id: string;
  prompt: string;
  modelName: string;
  creditCost: number;
  images: GeneratedImage[];
  createdAt: number;
}

const MAX_REFERENCE_IMAGES = 5;
const MAX_PROMPT_CHARS = 40000;
const FORMAT_ORDER: AspectRatioKey[] = ['1:1', '9:16', '16:9', '4:3', '3:4'];

export const ImageStudio: React.FC<ImageStudioProps> = ({
  onBack,
  credits,
  onDeductCredits,
  onOpenRecharge,
  project,
  onUpdateProject,
  onGoToMontage,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [modelCode, setModelCode] = useState<string>('NARWHAL');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>('4:3');
  const [count, setCount] = useState<number>(1);

  const [customUploads, setCustomUploads] = useState<PickedImage[]>([]);
  const [referenceSel, setReferenceSel] = useState<PickedImage[]>([]);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genProgress, setGenProgress] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const activeModel = GENERATION_IMAGE_MODELS.find((m) => m.code === modelCode) || GENERATION_IMAGE_MODELS[1];
  const totalCost = activeModel.creditCost * count;
  const remaining = credits - totalCost;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 4000);
  };

  const pickerItems: PickedImage[] = [
    ...customUploads,
    ...project.scenes
      .filter((s) => s.generatedImageUrl)
      .map((s) => ({ base64: s.generatedImageUrl!, mimeType: 'image/png', label: s.prompt || s.title })),
  ];

  const readFileAsPickedImage = (file: File): Promise<PickedImage> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: reader.result as string, mimeType: file.type || 'image/png', label: file.name });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const toggleReference = (img: PickedImage) => {
    setReferenceSel((prev) => {
      const exists = prev.some((p) => p.base64 === img.base64);
      if (exists) return prev.filter((p) => p.base64 !== img.base64);
      if (prev.length >= MAX_REFERENCE_IMAGES) {
        showToast(`Максимум ${MAX_REFERENCE_IMAGES} референсов`);
        return prev;
      }
      return [...prev, img];
    });
  };

  const handleUploadFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const img = await readFileAsPickedImage(file);
      setCustomUploads((prev) => [img, ...prev]);
      toggleReference(img);
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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Опиши кадр — поле пустое');
      return;
    }
    if (credits < totalCost) {
      showToast(`Недостаточно кредитов (нужно ${totalCost})`);
      return;
    }

    setIsGenerating(true);
    const images: GeneratedImage[] = [];
    try {
      for (let i = 0; i < count; i++) {
        setGenProgress(`${i + 1} из ${count}...`);
        const res = await generateImageReal({
          prompt: prompt.trim(),
          modelCode,
          aspectRatio,
          referenceImages: referenceSel.length ? referenceSel.map((r) => ({ base64: r.base64, mimeType: r.mimeType })) : undefined,
        });
        if (res.imageBase64) {
          images.push({ base64: res.imageBase64, mimeType: res.mimeType || 'image/png', addedToMontage: false });
        } else {
          showToast(`❌ Кадр ${i + 1} не сгенерирован: ${res.error || 'неизвестная ошибка'}`);
        }
      }

      if (images.length === 0) {
        showToast('❌ Ни одной картинки не удалось сгенерировать');
        return;
      }

      onDeductCredits(activeModel.creditCost * images.length);
      const entry: HistoryEntry = {
        id: `hist-${Date.now()}`,
        prompt: prompt.trim(),
        modelName: activeModel.name,
        creditCost: activeModel.creditCost,
        images,
        createdAt: Date.now(),
      };
      setHistory((prev) => [entry, ...prev]);
      showToast(`🎉 Сгенерировано ${images.length} из ${count} через ${activeModel.name}`);
    } finally {
      setIsGenerating(false);
      setGenProgress('');
    }
  };

  const handleAddToMontage = (entry: HistoryEntry, imgIndex: number) => {
    const img = entry.images[imgIndex];
    if (!img) return;
    const nextId = (project.scenes.reduce((max, s) => Math.max(max, s.id), 0) || 0) + 1;
    const newScene: StoryScene = {
      id: nextId,
      title: `План ${nextId}: ${entry.prompt.slice(0, 28)}...`,
      duration: estimateSpeechDuration(entry.prompt),
      description: entry.prompt,
      prompt: entry.prompt,
      generatedImageUrl: `data:${img.mimeType};base64,${img.base64}`,
      motionType: 'zoom-in',
      transition: 'crossfade',
    };
    const updatedScenes = [...project.scenes, newScene];
    const { timelineClips, totalDuration } = buildSynchronizedTimeline(
      updatedScenes,
      (project.aspectRatio as AspectRatioKey) || '16:9',
      project.styleId,
      project.clipHoldDuration || 4.0
    );
    onUpdateProject({
      scenes: updatedScenes,
      scenesCount: updatedScenes.length,
      imagesCount: (project.imagesCount || 0) + 1,
      timelineClips,
      duration: totalDuration,
    });
    setHistory((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? { ...e, images: e.images.map((im, i) => (i === imgIndex ? { ...im, addedToMontage: true } : im)) }
          : e
      )
    );
    showToast('🎬 Кадр добавлен в монтаж — таймлайн пересчитан автоматически');
    if (onGoToMontage) onGoToMontage();
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast('📋 Промпт скопирован'),
      () => showToast('Не удалось скопировать')
    );
  };

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
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Назад</span>
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Картинки</h1>
        <p className="text-xs text-stone-400 mt-1">
          Nano Banana через Gemini API. Цена видна до запуска, списывается только за удавшуюся генерацию.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column */}
        <div className="lg:col-span-8 space-y-5">
          <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">Что нарисовать</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
              rows={5}
              placeholder="Опиши кадр: что в нём, какой свет, какой стиль..."
              className="w-full bg-[#1a130e] border border-[#302418] rounded-xl p-3 text-xs md:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70 font-mono leading-relaxed resize-y"
            />
            <div className="text-[10px] text-stone-500 font-mono">
              {prompt.length} / {MAX_PROMPT_CHARS.toLocaleString('ru-RU')}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
                Референсы · {referenceSel.length} из {MAX_REFERENCE_IMAGES}
              </span>
              {referenceSel.length > 0 && (
                <button type="button" onClick={() => setReferenceSel([])} className="text-[11px] text-amber-400 hover:text-amber-300">
                  Очистить
                </button>
              )}
            </div>
            <p className="text-[11px] text-stone-500">
              Необязательно. Модель возьмёт из выбранных картинок стиль, персонажей и объекты. Порядок имеет значение — номер показан на превью.
            </p>
            <p className="text-[10px] text-stone-500">Своё изображение — кнопкой «+» или прямо из буфера: Ctrl+V</p>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="shrink-0 w-14 h-14 rounded-lg bg-[#1b140e] border border-dashed border-[#3b2b1d] hover:border-amber-500/60 text-stone-400 hover:text-amber-300 flex items-center justify-center transition-colors"
                title="Загрузить своё изображение"
              >
                <Plus className="w-4 h-4" />
              </button>
              {pickerItems.map((img, i) => {
                const order = referenceSel.findIndex((r) => r.base64 === img.base64);
                const selected = order !== -1;
                return (
                  <button
                    key={`${img.base64.slice(0, 24)}-${i}`}
                    type="button"
                    onClick={() => toggleReference(img)}
                    className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                      selected ? 'border-amber-400' : 'border-transparent hover:border-amber-500/40'
                    }`}
                    title={img.label}
                  >
                    <img src={img.base64} alt={img.label} className="w-full h-full object-cover" />
                    {selected && (
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center">
                        {order + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">История</label>
            {history.length === 0 ? (
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Здесь появятся все твои картинки вместе с промптами.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => {
                  const expanded = expandedIds.has(entry.id);
                  return (
                    <div key={entry.id} className="p-3 rounded-xl bg-[#0f0b08] border border-[#2b2116] space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[11px] text-stone-300 leading-snug ${expanded ? '' : 'line-clamp-2'}`}>
                          {entry.prompt}
                        </p>
                        <span className="text-[10px] text-stone-500 font-mono shrink-0">
                          {new Date(entry.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <button type="button" onClick={() => toggleExpanded(entry.id)} className="text-stone-400 hover:text-white">
                          {expanded ? 'Свернуть' : 'Показать полностью'}
                        </button>
                        <button type="button" onClick={() => setPrompt(entry.prompt)} className="text-amber-400 hover:text-amber-300">
                          Взять промпт
                        </button>
                        <button type="button" onClick={() => handleCopyPrompt(entry.prompt)} className="text-stone-400 hover:text-white flex items-center gap-1">
                          <Copy className="w-2.5 h-2.5" />
                          <span>Копировать</span>
                        </button>
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono">
                        {entry.modelName} · {entry.creditCost} кр
                      </div>
                      <div className="space-y-1.5">
                        {entry.images.map((img, i) => (
                          <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-[#140f0b] border border-[#241a10]">
                            <img
                              src={`data:${img.mimeType};base64,${img.base64}`}
                              alt={entry.prompt}
                              className="w-8 h-8 rounded object-cover shrink-0"
                            />
                            <span className="text-[10px] text-stone-400 line-clamp-1 flex-1">{entry.prompt}</span>
                            <a
                              href={`data:${img.mimeType};base64,${img.base64}`}
                              download={`goldflow-${entry.id}-${i}.png`}
                              className="p-1.5 rounded-md bg-[#1c150e] hover:bg-[#2c2117] border border-[#382a1d] text-stone-300"
                              title="Скачать"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleAddToMontage(entry, i)}
                              disabled={img.addedToMontage}
                              className="p-1.5 rounded-md bg-[#1c150e] hover:bg-[#2c2117] border border-[#382a1d] text-amber-300 disabled:opacity-40 disabled:cursor-default"
                              title={img.addedToMontage ? 'Уже в монтаже' : 'В монтаж'}
                            >
                              <Film className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 space-y-5">
          <div className="p-4 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">Модель</label>
            {GENERATION_IMAGE_MODELS.map((m) => (
              <button
                key={m.code}
                type="button"
                onClick={() => setModelCode(m.code)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  modelCode === m.code ? 'bg-amber-500/10 border-amber-500/60' : 'bg-[#1a130e] border-[#2e2216] hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{m.name}</span>
                  <span className="text-[11px] font-mono text-amber-300">{m.creditCost} кр</span>
                </div>
                <p className="text-[10px] text-stone-400 mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">Формат</label>
            <div className="grid grid-cols-3 gap-1.5">
              {FORMAT_ORDER.map((id) => {
                const r = ASPECT_RATIO_OPTIONS.find((o) => o.id === id)!;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setAspectRatio(r.id)}
                    title={r.label}
                    className={`py-2 rounded-lg text-xs font-mono border transition-colors ${
                      aspectRatio === r.id
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/60'
                        : 'bg-[#1a130e] text-stone-300 hover:text-white border-[#2e2216]'
                    }`}
                  >
                    {r.id}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#140f0b] border border-[#2b2116] space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">Сколько картинок</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`py-2 rounded-lg text-xs font-mono border transition-colors ${
                    count === n ? 'bg-amber-500/15 text-amber-300 border-amber-500/60' : 'bg-[#1a130e] text-stone-300 hover:text-white border-[#2e2216]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

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
              <span className={`text-sm font-mono font-bold ${remaining < 0 ? 'text-rose-400' : 'text-stone-300'}`}>{remaining}</span>
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
                  <span>Генерация {genProgress}</span>
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
