import React, { useEffect, useState } from 'react';
import { StylePreset } from '../types';
import { X, Upload, Sparkles, RefreshCw, Trash2 } from 'lucide-react';

interface CreateStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (style: StylePreset) => void;
  onDelete?: (styleId: string) => void;
  editingStyle?: StylePreset | null;
}

const MAX_REFERENCE_IMAGES = 6;

interface RefImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ base64, mimeType: file.type || 'image/png' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const CreateStyleModal: React.FC<CreateStyleModalProps> = ({ isOpen, onClose, onCreate, onDelete, editingStyle }) => {
  const [name, setName] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [images, setImages] = useState<RefImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingStyle) {
      setName(editingStyle.name);
      setNegativePrompt(editingStyle.negativePrompt || '');
      setImages(
        (editingStyle.referenceImages || []).map((i) => ({
          base64: i.base64,
          mimeType: i.mimeType,
          // Real, page-reload-safe data URL — a blob: URL here would stop
          // working the moment the page reloads, defeating the point of
          // persisting the style at all.
          previewUrl: `data:${i.mimeType};base64,${i.base64}`,
        }))
      );
    } else {
      setName('');
      setNegativePrompt('');
      setImages([]);
    }
  }, [isOpen, editingStyle]);

  if (!isOpen) return null;

  const isEditing = Boolean(editingStyle);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, MAX_REFERENCE_IMAGES - images.length);
    setIsProcessing(true);
    try {
      const converted = await Promise.all(
        files.map(async (f) => {
          const { base64, mimeType } = await fileToBase64(f);
          return { base64, mimeType, previewUrl: `data:${mimeType};base64,${base64}` };
        })
      );
      setImages((prev) => [...prev, ...converted].slice(0, MAX_REFERENCE_IMAGES));
    } finally {
      setIsProcessing(false);
    }
  };

  const canCreate = name.trim().length > 0 && images.length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const style: StylePreset = {
      id: editingStyle?.id || `custom-${Date.now()}`,
      name: name.trim(),
      count: editingStyle?.count || 0,
      previewColor: '#2b2118',
      description: `Свой стиль — ${images.length} эталон(а/ов)`,
      accent: '#f59e0b',
      thumbnailUrl: images[0].previewUrl,
      referenceImages: images.map((i) => ({ base64: i.base64, mimeType: i.mimeType })),
      negativePrompt: negativePrompt.trim() || undefined,
    };
    onCreate(style);
    onClose();
  };

  const handleDelete = () => {
    if (!editingStyle || !onDelete) return;
    onDelete(editingStyle.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#150f0b] border border-[#3b2b1d] rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl space-y-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2e2115] pb-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{isEditing ? 'Редактировать стиль' : 'Создать свой стиль'}</span>
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#261c13] hover:bg-[#382a1d] text-stone-300 flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-stone-400 leading-relaxed">
          Два-три кадра достаточно. Первый — главный: генератор держится его сильнее прочих, поэтому поставь самый показательный. Эти картинки реально уходят в каждый запрос генерации для этого стиля.
        </p>

        <div>
          <label className="block text-[10px] uppercase font-mono text-stone-500 mb-1">Название стиля</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Манекены"
            className="w-full bg-[#1a130e] border border-[#302418] rounded-xl px-3 py-2.5 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono text-stone-500 mb-1">
            Эталонные кадры ({images.length}/{MAX_REFERENCE_IMAGES})
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-amber-500/40 group">
                <img src={img.previewUrl} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                {idx === 0 && (
                  <span className="absolute top-0.5 left-0.5 px-1 rounded bg-black/80 text-[8px] text-amber-300 font-mono">
                    гл.
                  </span>
                )}
                <button
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
            {images.length < MAX_REFERENCE_IMAGES && (
              <label className="w-16 h-16 rounded-lg border border-dashed border-[#443322] hover:border-amber-500/60 bg-[#16100c] flex items-center justify-center cursor-pointer transition-colors">
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 text-stone-400 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-stone-400" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono text-stone-500 mb-1">
            Необязательно: чего в кадре быть НЕ должно
          </label>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            rows={2}
            placeholder="Например: без надписей и цифр, лица в тени, техника только шестидесятых годов"
            className="w-full bg-[#1a130e] border border-[#302418] rounded-xl p-3 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70 leading-relaxed resize-y"
          />
          <p className="text-[10px] text-stone-500 mt-1">
            Картинки показывают, КАК рисовать. Слова — чего не рисовать никогда.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && onDelete && (
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl bg-[#241a10] hover:bg-rose-950/40 border border-[#3b2b1d] text-rose-300 font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Удалить</span>
            </button>
          )}
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Сохранить изменения' : 'Создать стиль'}
          </button>
        </div>
      </div>
    </div>
  );
};
