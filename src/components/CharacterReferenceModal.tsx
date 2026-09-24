import React, { useEffect, useState } from 'react';
import { X, Upload, RefreshCw, User, MapPin } from 'lucide-react';

interface CharacterReferenceModalProps {
  isOpen: boolean;
  kind: 'character' | 'location';
  initialName?: string;
  initialRole?: string;
  initialImage?: string;
  onClose: () => void;
  onSave: (data: { name: string; role: string; customImage?: string }) => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const CharacterReferenceModal: React.FC<CharacterReferenceModalProps> = ({
  isOpen,
  kind,
  initialName,
  initialRole,
  initialImage,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialName || '');
  const [role, setRole] = useState(initialRole || '');
  const [image, setImage] = useState<string | undefined>(initialImage);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setRole(initialRole || '');
      setImage(initialImage);
    }
  }, [isOpen, initialName, initialRole, initialImage]);

  if (!isOpen) return null;

  const isCharacter = kind === 'character';
  const canSave = name.trim().length > 0;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsProcessing(true);
    try {
      setImage(await fileToDataUrl(file));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file) await handleFile(file);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), role: role.trim() || (isCharacter ? 'Персонаж' : 'Локация'), customImage: image });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      onPaste={handlePaste}
    >
      <div
        className="bg-[#150f0b] border border-[#3b2b1d] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2e2115] pb-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            {isCharacter ? <User className="w-4 h-4 text-amber-400" /> : <MapPin className="w-4 h-4 text-amber-400" />}
            <span>{isCharacter ? 'Референс персонажа' : 'Референс локации'}</span>
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#261c13] hover:bg-[#382a1d] text-stone-300 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-stone-400 leading-relaxed">
          Загрузи фото {isCharacter ? 'персонажа' : 'локации'} — эта картинка реально уходит референсом в каждый кадр, где {isCharacter ? 'он упоминается' : 'она упоминается'} по имени. Без фото просто держим имя и описание.
        </p>

        <div>
          <label className="block text-[10px] uppercase font-mono text-stone-500 mb-1">
            {isCharacter ? 'Имя персонажа' : 'Название локации'}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isCharacter ? 'Например: Рави' : 'Например: Старый маяк'}
            className="w-full bg-[#1a130e] border border-[#302418] rounded-xl px-3 py-2.5 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono text-stone-500 mb-1">
            {isCharacter ? 'Роль (необязательно)' : 'Тип (необязательно)'}
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={isCharacter ? 'Например: главный герой' : 'Например: интерьер'}
            className="w-full bg-[#1a130e] border border-[#302418] rounded-xl px-3 py-2.5 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/70"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono text-stone-500 mb-1">
            Референсное фото (необязательно, Ctrl+V тоже работает)
          </label>
          <div className="flex items-center gap-3">
            {image ? (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-amber-500/40 group">
                <img src={image} alt={name} className="w-full h-full object-cover" />
                <button
                  onClick={() => setImage(undefined)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <label className="w-20 h-20 rounded-lg border border-dashed border-[#443322] hover:border-amber-500/60 bg-[#16100c] flex items-center justify-center cursor-pointer transition-colors">
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 text-stone-400 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-stone-400" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
};
