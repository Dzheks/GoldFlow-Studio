import React, { useState } from 'react';
import { parseGoogleFlowPayload, ParsedFlowFrame } from '../utils/flowResponseParser';
import { 
  Download, 
  Check, 
  Sparkles, 
  Layers, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  UploadCloud,
  FileText
} from 'lucide-react';

interface FlowImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFrames: (frames: ParsedFlowFrame[]) => void;
}

export const FlowImportModal: React.FC<FlowImportModalProps> = ({
  isOpen,
  onClose,
  onImportFrames,
}) => {
  const [inputText, setInputText] = useState('');
  const [parsedFrames, setParsedFrames] = useState<ParsedFlowFrame[]>([]);
  const [hasParsed, setHasParsed] = useState(false);

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setInputText(text);
    const frames = parseGoogleFlowPayload(text);
    setParsedFrames(frames);
    setHasParsed(true);
  };

  const handleApply = () => {
    if (parsedFrames.length > 0) {
      const frames = [...parsedFrames];
      onClose();
      setTimeout(() => {
        onImportFrames(frames);
      }, 50);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#150f0b] border border-[#3b2b1d] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#2b1f14] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-black shadow-md shadow-amber-500/20">
              <Download className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Импорт кадров из Google Flow</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Whisk / batchexecute
                </span>
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Вставьте ответ из вкладки Response в DevTools или ссылки на кадры Googleusercontent
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#241a11] hover:bg-[#342618] text-stone-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Instructions */}
        <div className="p-3 rounded-xl bg-[#1b140e] border border-[#2e2115] text-xs text-stone-300 space-y-1.5">
          <div className="font-bold text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Как перенести пачку кадров:</span>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            В DevTools (F12) на вкладке <strong>Network</strong> кликните по запросу <code className="text-amber-300 font-mono">batchexecute</code> → откройте соседнюю вкладку <strong>Response</strong> (или Preview) → выделите всё (<kbd className="bg-black px-1 rounded text-stone-300 font-mono">Ctrl+A</kbd>) и вставьте сюда. Либо просто вставьте ссылки на картинки по одной на строку.
          </p>
        </div>

        {/* Text Input Area */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-stone-300">
            Данные из Google Flow:
          </label>
          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => handleParse(e.target.value)}
            placeholder="Вставьте ответ запроса batchexecute или список ссылок https://lh3.googleusercontent.com/..."
            className="w-full bg-[#1b140e] border border-[#2f2216] rounded-xl p-3 text-xs text-stone-200 font-mono focus:outline-none focus:border-amber-500/70 resize-none"
          />
        </div>

        {/* Parsed Previews */}
        {hasParsed && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Распознано кадров:</span>
              </span>
              <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {parsedFrames.length} шт
              </span>
            </div>

            {parsedFrames.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 rounded-xl bg-[#120d09] border border-[#261a10]">
                {parsedFrames.map((frame) => (
                  <div key={frame.id} className="relative aspect-video rounded-lg overflow-hidden border border-[#3b2b1d] group bg-black">
                    <img 
                      src={frame.imageUrl} 
                      alt={`Кадр ${frame.id}`} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-center font-mono text-amber-300 py-0.5">
                      #{frame.id}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>В тексте не найдено ссылок на изображения Google Flow или googleusercontent. Скопируйте весь блок из вкладки Response или вставьте ссылки напрямую.</span>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2b1f14]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#201710] hover:bg-[#2e2117] text-stone-300 text-xs transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={parsedFrames.length === 0}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 text-black font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Применить к раскадровке ({parsedFrames.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
