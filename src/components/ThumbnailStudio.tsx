import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Image as ImageIcon, Download, Type, Palette, Sparkles } from 'lucide-react';
import { drawProceduralScene } from '../utils/proceduralCanvas';
import { ASPECT_RATIO_OPTIONS, getAspectRatioConfig, AspectRatioKey } from '../config/aspectRatios';

interface ThumbnailStudioProps {
  onBack: () => void;
}

export const ThumbnailStudio: React.FC<ThumbnailStudioProps> = ({ onBack }) => {
  const [headline, setHeadline] = useState<string>('СЕКРЕТНЫЕ МИЛЛИОНЫ');
  const [subHeadline, setSubHeadline] = useState<string>('Бизнесы, которые ты не замечал');
  const [contrast, setContrast] = useState<number>(1.2);
  const [textColor, setTextColor] = useState<string>('#facc15');
  const [format, setFormat] = useState<AspectRatioKey>('16:9');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeRatio = getAspectRatioConfig(format);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background scene
    drawProceduralScene(ctx, canvas.width, canvas.height, {
      sceneId: 1,
      title: 'YouTube Thumbnail High-CTR',
      timeSec: 2.0,
      durationSec: 4.0,
      motionType: 'static',
      aspectRatio: format,
    });

    // Dark gradient overlay for text readability
    const textGrad = ctx.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height);
    textGrad.addColorStop(0, 'rgba(0,0,0,0)');
    textGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = textGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Headline styling
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 20;
    ctx.font = '900 48px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.fillText(headline, canvas.width / 2, canvas.height - 110);

    // Subheadline
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(subHeadline, canvas.width / 2, canvas.height - 65);
    ctx.restore();
  }, [headline, subHeadline, contrast, textColor, format]);

  const handleDownloadThumbnail = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `preview_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#251c14]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к выбору</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
          <ImageIcon className="w-4 h-4" />
          <span>Конструктор обложек Превью (CTR Pro)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="p-5 rounded-2xl bg-[#15100c] border border-[#291e14] space-y-4 text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
            Оформление обложки
          </h3>

          <div>
            <label className="block text-[11px] font-semibold text-stone-400 mb-1">
              Главный заголовок
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full bg-[#1c150e] border border-[#332517] rounded-lg p-2.5 text-stone-200 font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-400 mb-1">
              Подзаголовок
            </label>
            <input
              type="text"
              value={subHeadline}
              onChange={(e) => setSubHeadline(e.target.value)}
              className="w-full bg-[#1c150e] border border-[#332517] rounded-lg p-2.5 text-stone-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-400 mb-1">Цвет акцента</label>
              <select
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-full bg-[#1c150e] border border-[#332517] rounded p-2 text-stone-200"
              >
                <option value="#facc15">Жёлтый Gold</option>
                <option value="#ef4444">Красный Accent</option>
                <option value="#38bdf8">Голубой Cyber</option>
                <option value="#ffffff">Чистый белый</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                Формат (Соотношение)
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as AspectRatioKey)}
                className="w-full bg-[#1c150e] border border-[#332517] rounded p-2 text-stone-200 text-xs"
              >
                {ASPECT_RATIO_OPTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="text-[10px] font-mono text-stone-500 mt-1">
                Vr: <span className="text-amber-400">{activeRatio.code}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadThumbnail}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 fill-black" />
            <span>Скачать готовую обложку (PNG 4K)</span>
          </button>
        </div>

        {/* Live Canvas View */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300 font-mono">
            Живой результат
          </h3>
          <div className="rounded-2xl border border-[#2b2116] bg-black overflow-hidden shadow-2xl flex items-center justify-center p-2">
            <canvas
              ref={canvasRef}
              width={format === '16:9' ? 854 : 480}
              height={format === '16:9' ? 480 : 854}
              className="w-full h-auto object-contain max-h-[380px] rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
