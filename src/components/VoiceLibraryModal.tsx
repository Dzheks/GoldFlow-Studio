import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Play, Pause, RefreshCw, Save, Trash2, Check, Pencil } from 'lucide-react';
import { fetchLumeanVoices, fetchLumeanVoiceById, VoiceLibraryEntry } from '../services/geminiPipelineClient';
import { listVoiceTemplates, saveVoiceTemplate, deleteVoiceTemplate, VoiceTemplate } from '../utils/voiceTemplateStorage';

interface VoiceLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Called when the user confirms a pick: either a browsed voice + current
  // knobs, or a saved template. The tab uses this to drive synthesis.
  onPick: (pick: {
    voiceId: string;
    voiceName: string;
    langCode: string;
    stability: number;
    similarityBoost: number;
    useSpeakerBoost: boolean;
    speed: number;
  }) => void;
  langCode: string;
  currentVoiceId?: string;
}

// Small self-contained audio slot: exactly one preview plays at a time.
function usePreviewPlayer() {
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toggle = (url: string) => {
    if (!url) return;
    if (playingUrl === url && audioRef.current) {
      audioRef.current.pause();
      setPlayingUrl(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(url);
    a.onended = () => setPlayingUrl(null);
    a.onerror = () => setPlayingUrl(null);
    audioRef.current = a;
    a.play().catch(() => setPlayingUrl(null));
    setPlayingUrl(url);
  };
  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);
  return { playingUrl, toggle };
}

export const VoiceLibraryModal: React.FC<VoiceLibraryModalProps> = ({
  isOpen, onClose, onPick, langCode, currentVoiceId,
}) => {
  const [tab, setTab] = useState<'browse' | 'saved' | 'byid'>('browse');
  const [query, setQuery] = useState('');
  const [voices, setVoices] = useState<VoiceLibraryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<VoiceLibraryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<VoiceTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [byIdInput, setByIdInput] = useState('');

  // Voice-tuning knobs (ElevenLabs voice_settings).
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [useSpeakerBoost, setUseSpeakerBoost] = useState(true);
  const [speed, setSpeed] = useState(1.0);

  const { playingUrl, toggle } = usePreviewPlayer();

  // Reload voices on open and on query change (debounced).
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      const r = await fetchLumeanVoices(query || undefined);
      if (r.error) setError(r.error);
      setVoices(r.voices);
      setIsLoading(false);
    }, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen) return;
    listVoiceTemplates().then(setTemplates);
  }, [isOpen]);

  const filteredVoices = useMemo(() => voices.slice(0, 200), [voices]);

  const handleLookupById = async () => {
    const id = byIdInput.trim();
    if (!id) return;
    setIsLoading(true);
    setError(null);
    const r = await fetchLumeanVoiceById(id);
    setIsLoading(false);
    if (r.error || !r.voice) {
      setError(r.error || 'Голос не найден');
      return;
    }
    setSelected(r.voice);
    setTab('browse');
  };

  const handleSaveTemplate = async () => {
    if (!selected) return;
    const name = templateName.trim() || `${selected.name} · тюнинг`;
    const now = Date.now();
    const tpl: VoiceTemplate = {
      id: editingTemplateId || `tpl_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      voiceId: selected.id,
      voiceName: selected.name,
      langCode,
      stability, similarityBoost, useSpeakerBoost, speed,
      createdAt: editingTemplateId ? (templates.find((t) => t.id === editingTemplateId)?.createdAt || now) : now,
      updatedAt: now,
    };
    await saveVoiceTemplate(tpl);
    setTemplates(await listVoiceTemplates());
    setEditingTemplateId(null);
    setTemplateName('');
  };

  const handleLoadTemplate = (tpl: VoiceTemplate) => {
    setStability(tpl.stability);
    setSimilarityBoost(tpl.similarityBoost);
    setUseSpeakerBoost(tpl.useSpeakerBoost);
    setSpeed(tpl.speed);
    setTemplateName(tpl.name);
    setEditingTemplateId(tpl.id);
    // Try to select the voice from the current library, else lookup by id.
    const inLib = voices.find((v) => v.id === tpl.voiceId);
    if (inLib) { setSelected(inLib); setTab('browse'); return; }
    fetchLumeanVoiceById(tpl.voiceId).then((r) => {
      if (r.voice) { setSelected(r.voice); setTab('browse'); }
      else { setSelected({ id: tpl.voiceId, name: tpl.voiceName }); setTab('browse'); }
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    await deleteVoiceTemplate(id);
    setTemplates(await listVoiceTemplates());
    if (editingTemplateId === id) { setEditingTemplateId(null); setTemplateName(''); }
  };

  const handleConfirm = () => {
    if (!selected) return;
    onPick({
      voiceId: selected.id,
      voiceName: selected.name,
      langCode,
      stability, similarityBoost, useSpeakerBoost, speed,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12100b] border border-[#2b2116] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-[#241c13] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white font-mono">Библиотека голосов Lumean</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">Выбери голос, послушай превью, настрой параметры и сохрани как шаблон.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#1a130e] text-stone-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-2">
          {(['browse', 'byid', 'saved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-[#1a130e] text-stone-400 hover:text-white border border-[#2e2216]'
              }`}
            >
              {t === 'browse' ? 'Каталог' : t === 'byid' ? 'По voice_id' : `Мои шаблоны (${templates.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 p-5">
          <div className="overflow-y-auto pr-2 space-y-3">
            {tab === 'browse' && (
              <>
                <div className="flex items-center gap-2 bg-[#1a130e] border border-[#2e2216] rounded-lg px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-stone-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Поиск по имени, акценту, описанию…"
                    className="flex-1 bg-transparent text-xs text-stone-200 placeholder-stone-600 focus:outline-none font-mono"
                  />
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
                </div>
                {error && <p className="text-[11px] text-rose-400 font-mono">{error}</p>}
                <div className="space-y-2">
                  {filteredVoices.map((v) => {
                    const isSel = selected?.id === v.id;
                    const isCurrent = currentVoiceId === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelected(v)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSel ? 'bg-[#1c150e] border-amber-500/60' : 'bg-[#150f0b] border-[#2b2116] hover:border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white truncate">{v.name}</span>
                              {isCurrent && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 rounded px-1.5 py-0.5 font-mono">выбран</span>}
                            </div>
                            <p className="text-[11px] text-stone-500 font-mono truncate">
                              {[v.gender, v.accent, v.age].filter(Boolean).join(' · ')}
                              {v.description ? ` — ${v.description}` : ''}
                            </p>
                            <p className="text-[10px] text-stone-600 font-mono truncate">voice_id: {v.id}</p>
                          </div>
                          {v.previewUrl && (
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); toggle(v.previewUrl!); }}
                              className="p-2 rounded-lg bg-[#22160f] hover:bg-[#321e15] text-amber-300 shrink-0"
                              title="Прослушать превью"
                            >
                              {playingUrl === v.previewUrl ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {!isLoading && filteredVoices.length === 0 && !error && (
                    <p className="text-[11px] text-stone-500 font-mono">Пусто. Попробуй другой запрос или вкладку «По voice_id».</p>
                  )}
                </div>
              </>
            )}

            {tab === 'byid' && (
              <div className="space-y-3">
                <p className="text-xs text-stone-400 leading-relaxed">Вставь voice_id из ElevenLabs — работает, даже если голос не в общей библиотеке.</p>
                <div className="flex gap-2">
                  <input
                    value={byIdInput}
                    onChange={(e) => setByIdInput(e.target.value)}
                    placeholder="например: 21m00Tcm4TlvDq8ikWAM"
                    className="flex-1 bg-[#1a130e] border border-[#2e2216] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500/60"
                  />
                  <button
                    onClick={handleLookupById}
                    disabled={!byIdInput.trim() || isLoading}
                    className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/40 disabled:opacity-50"
                  >
                    Найти
                  </button>
                </div>
                {error && <p className="text-[11px] text-rose-400 font-mono">{error}</p>}
              </div>
            )}

            {tab === 'saved' && (
              <div className="space-y-2">
                {templates.length === 0 && <p className="text-[11px] text-stone-500 font-mono">Пока нет сохранённых шаблонов. Настрой голос в «Каталоге» и жми «Сохранить как шаблон».</p>}
                {templates.map((tpl) => (
                  <div key={tpl.id} className="p-3 rounded-xl bg-[#150f0b] border border-[#2b2116] hover:border-amber-500/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{tpl.name}</p>
                        <p className="text-[11px] text-stone-500 font-mono truncate">
                          {tpl.voiceName} · stab {tpl.stability.toFixed(2)} · sim {tpl.similarityBoost.toFixed(2)} · speed {tpl.speed.toFixed(2)}{tpl.useSpeakerBoost ? ' · boost' : ''}
                        </p>
                        <p className="text-[10px] text-stone-600 font-mono truncate">voice_id: {tpl.voiceId} · lang: {tpl.langCode}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleLoadTemplate(tpl)} className="p-2 rounded-lg bg-[#22160f] hover:bg-[#321e15] text-amber-300" title="Открыть в каталоге">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-2 rounded-lg bg-[#22160f] hover:bg-[#3a1f18] text-rose-300" title="Удалить шаблон">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right pane: current selection + knobs + save/apply */}
          <div className="bg-[#150f0b] border border-[#2b2116] rounded-xl p-4 overflow-y-auto space-y-4">
            {selected ? (
              <>
                <div>
                  <p className="text-xs text-stone-400 font-mono">Выбран:</p>
                  <p className="text-sm font-semibold text-white">{selected.name}</p>
                  <p className="text-[10px] text-stone-500 font-mono break-all">{selected.id}</p>
                  {selected.previewUrl && (
                    <button
                      onClick={() => toggle(selected.previewUrl!)}
                      className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#22160f] hover:bg-[#321e15] text-amber-300 text-[11px] border border-[#3a2318]"
                    >
                      {playingUrl === selected.previewUrl ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      <span>{playingUrl === selected.previewUrl ? 'Пауза' : 'Прослушать превью'}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3 border-t border-[#241c13] pt-3">
                  <p className="text-[11px] text-stone-400 font-mono uppercase">Параметры</p>
                  <Slider label="Стабильность" value={stability} setValue={setStability} min={0} max={1} step={0.05} />
                  <Slider label="Похожесть на референс" value={similarityBoost} setValue={setSimilarityBoost} min={0} max={1} step={0.05} />
                  <Slider label="Скорость" value={speed} setValue={setSpeed} min={0.5} max={2} step={0.05} />
                  <label className="flex items-center gap-2 text-[11px] text-stone-300 font-mono cursor-pointer">
                    <input type="checkbox" checked={useSpeakerBoost} onChange={(e) => setUseSpeakerBoost(e.target.checked)} />
                    Speaker boost
                  </label>
                </div>

                <div className="space-y-2 border-t border-[#241c13] pt-3">
                  <p className="text-[11px] text-stone-400 font-mono uppercase">Шаблон</p>
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Название шаблона (например: «Тревожный женский»)"
                    className="w-full bg-[#1a130e] border border-[#2e2216] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/60"
                  />
                  <button
                    onClick={handleSaveTemplate}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c150e] hover:bg-[#2c2117] border border-[#382a1d] text-stone-200 text-[11px] font-mono"
                  >
                    <Save className="w-3 h-3" />
                    <span>{editingTemplateId ? 'Обновить шаблон' : 'Сохранить как шаблон'}</span>
                  </button>
                </div>

                <button
                  onClick={handleConfirm}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black text-xs font-semibold"
                >
                  <Check className="w-3.5 h-3.5" />
                  Использовать этот голос
                </button>
              </>
            ) : (
              <p className="text-[11px] text-stone-500 font-mono leading-relaxed">Выбери голос слева, чтобы услышать превью, настроить параметры и сохранить как шаблон.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Slider: React.FC<{ label: string; value: number; setValue: (n: number) => void; min: number; max: number; step: number }> = ({ label, value, setValue, min, max, step }) => (
  <label className="block space-y-1">
    <span className="flex items-center justify-between text-[11px] text-stone-300 font-mono">
      <span>{label}</span>
      <span className="text-stone-500">{value.toFixed(2)}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => setValue(Number(e.target.value))}
      className="w-full accent-amber-500"
    />
  </label>
);
