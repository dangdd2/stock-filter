"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Trash2, Play, Save, BookOpen, ChevronDown, ChevronUp,
  X, BarChart2, Sparkles, Info,
} from 'lucide-react';
import {
  FIELD_META, BUILT_IN_PRESETS, applyScreener, loadUserPresets,
  saveUserPresets, newCondition, conditionLabel,
  type Condition, type FieldKey, type Operator, type Logic, type Preset,
} from '@/lib/screener';
import type { StockIndicatorResult } from '@/app/page';

interface Props {
  data: StockIndicatorResult[];
  onTickerClick: (ticker: string) => void;
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '<',       label: '<'       },
  { value: '<=',      label: '≤'       },
  { value: '>',       label: '>'       },
  { value: '>=',      label: '≥'       },
  { value: '==',      label: '='       },
  { value: 'between', label: 'trong khoảng' },
];

// ── Condition Row ─────────────────────────────────────────────
function ConditionRow({
  cond, index, total, onChange, onRemove,
}: {
  cond: Condition; index: number; total: number;
  onChange: (c: Condition) => void; onRemove: () => void;
}) {
  const meta = FIELD_META[cond.field];
  return (
    <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/50">
      {/* Logic connector */}
      {index > 0 && (
        <button
          onClick={() => onChange({ ...cond, logic: cond.logic === 'AND' ? 'OR' : 'AND' })}
          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors w-10 text-center ${
            cond.logic === 'AND'
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          }`}
        >
          {cond.logic}
        </button>
      )}
      {index === 0 && <span className="text-[10px] text-slate-500 w-10 text-center">KHI</span>}

      {/* Field selector */}
      <select
        value={cond.field}
        onChange={e => onChange({ ...cond, field: e.target.value as FieldKey })}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {(Object.entries(FIELD_META) as [FieldKey, typeof FIELD_META[FieldKey]][]).map(([k, m]) => (
          <option key={k} value={k}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={cond.op}
        onChange={e => onChange({ ...cond, op: e.target.value as Operator })}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
      >
        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Value(s) */}
      <input
        type="number"
        value={cond.value}
        step={meta.step}
        onChange={e => onChange({ ...cond, value: parseFloat(e.target.value) || 0 })}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-24 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {cond.op === 'between' && (
        <>
          <span className="text-slate-500 text-xs">đến</span>
          <input
            type="number"
            value={cond.value2 ?? ''}
            step={meta.step}
            onChange={e => onChange({ ...cond, value2: parseFloat(e.target.value) || 0 })}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-24 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </>
      )}
      {meta.unit && <span className="text-slate-500 text-[10px]">{meta.unit}</span>}

      {/* Remove */}
      <button
        onClick={onRemove}
        disabled={total <= 1}
        className="ml-auto p-1 text-slate-600 hover:text-rose-400 transition-colors disabled:opacity-20"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Preset Card ───────────────────────────────────────────────
function PresetCard({
  preset, onLoad, onDelete, isUser,
}: {
  preset: Preset; onLoad: () => void; onDelete?: () => void; isUser?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg overflow-hidden hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-base">{preset.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-200 truncate">{preset.name}</p>
          <p className="text-[10px] text-slate-500 truncate">{preset.desc}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 text-slate-600 hover:text-slate-300 transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {isUser && onDelete && (
            <button onClick={onDelete} className="p-1 text-slate-600 hover:text-rose-400 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={onLoad}
            className="flex items-center gap-1 px-2 py-1 bg-blue-500/15 text-blue-300 border border-blue-500/25 rounded text-[10px] hover:bg-blue-500/25 transition-colors"
          >
            <Play size={10} /> Dùng
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-2.5 border-t border-slate-800 pt-2 space-y-1">
          {preset.conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px]">
              {i > 0 && (
                <span className={`px-1.5 py-0.5 rounded font-bold ${c.logic === 'AND' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {c.logic}
                </span>
              )}
              <span className="text-slate-400">{conditionLabel({ ...c, id: '' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function AdvancedScreener({ data, onTickerClick }: Props) {
  const [conditions,   setConditions]   = useState<Condition[]>([newCondition('AND')]);
  const [userPresets,  setUserPresets]  = useState<Preset[]>([]);
  const [saveModalOpen,setSaveModal]    = useState(false);
  const [newPresetName,setNewPresetName]= useState('');
  const [newPresetEmoji,setNewEmoji]    = useState('⭐');
  const [showPresets,  setShowPresets]  = useState(true);
  const [hasRun,       setHasRun]       = useState(false);
  const [results,      setResults]      = useState<StockIndicatorResult[]>([]);
  const [sortKey,      setSortKey]      = useState<keyof StockIndicatorResult>('ticker');
  const [sortAsc,      setSortAsc]      = useState(true);

  useEffect(() => { setUserPresets(loadUserPresets()); }, []);

  const validData = useMemo(() => data.filter(d => !d.error && d.price > 0), [data]);

  const runScreener = () => {
    setResults(applyScreener(validData, conditions));
    setHasRun(true);
  };

  const loadPreset = (preset: Preset) => {
    setConditions(preset.conditions.map((c, i) => ({
      ...c,
      id: `c_${Date.now()}_${i}`,
      logic: i === 0 ? 'AND' : c.logic,
    })));
    setHasRun(false);
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const p: Preset = {
      id: `user_${Date.now()}`,
      name: newPresetName.trim(),
      emoji: newPresetEmoji || '⭐',
      desc: conditions.map(c => conditionLabel({ ...c })).join(' '),
      conditions: conditions.map(({ id: _id, ...rest }) => rest),
    };
    const updated = [...userPresets, p];
    setUserPresets(updated);
    saveUserPresets(updated);
    setSaveModal(false);
    setNewPresetName('');
  };

  const deleteUserPreset = (id: string) => {
    const updated = userPresets.filter(p => p.id !== id);
    setUserPresets(updated);
    saveUserPresets(updated);
  };

  const updateCond = (id: string, updated: Condition) =>
    setConditions(cs => cs.map(c => c.id === id ? updated : c));

  const removeCond = (id: string) =>
    setConditions(cs => cs.length > 1 ? cs.filter(c => c.id !== id) : cs);

  const addCond = () =>
    setConditions(cs => [...cs, newCondition('AND')]);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
  }, [results, sortKey, sortAsc]);

  const toggleSort = (k: keyof StockIndicatorResult) => {
    if (sortKey === k) setSortAsc(v => !v);
    else { setSortKey(k); setSortAsc(true); }
  };

  const SortArrow = ({ k }: { k: keyof StockIndicatorResult }) =>
    sortKey === k ? <span className="ml-0.5 opacity-60">{sortAsc ? '↑' : '↓'}</span> : null;

  return (
    <div className="space-y-4">

      {/* ── Presets panel ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPresets(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <BookOpen size={15} className="text-amber-400" /> Preset Sẵn Có
            <span className="text-[10px] text-slate-500 font-normal">({BUILT_IN_PRESETS.length + userPresets.length} templates)</span>
          </span>
          {showPresets ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
        </button>

        {showPresets && (
          <div className="px-4 pb-4 border-t border-slate-700/50">
            {/* Built-in */}
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-3 mb-2">Built-in</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {BUILT_IN_PRESETS.map(p => (
                <PresetCard key={p.id} preset={p} onLoad={() => loadPreset(p)} />
              ))}
            </div>

            {/* User saved */}
            {userPresets.length > 0 && (
              <>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-4 mb-2">Của Tôi</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {userPresets.map(p => (
                    <PresetCard key={p.id} preset={p} isUser onLoad={() => loadPreset(p)}
                      onDelete={() => deleteUserPreset(p.id)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Query builder ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Sparkles size={15} className="text-violet-400" /> Điều Kiện Lọc
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSaveModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-xs hover:bg-amber-500/20 transition-colors">
              <Save size={12} /> Lưu Preset
            </button>
            <button onClick={addCond}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 text-slate-300 rounded-md text-xs hover:bg-slate-600 transition-colors">
              <Plus size={12} /> Thêm điều kiện
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {conditions.map((cond, i) => (
            <ConditionRow key={cond.id} cond={cond} index={i} total={conditions.length}
              onChange={updated => updateCond(cond.id, updated)}
              onRemove={() => removeCond(cond.id)} />
          ))}
        </div>

        {/* Logic hint */}
        <div className="flex items-start gap-1.5 mb-4 text-[10px] text-slate-500">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>Click <strong className="text-blue-400">AND</strong>/<strong className="text-amber-400">OR</strong> để đổi logic. AND = tất cả phải đúng, OR = ít nhất một đúng.</span>
        </div>

        {/* Run button */}
        <button
          onClick={runScreener}
          disabled={validData.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
        >
          <Play size={15} />
          Chạy Screener
          <span className="text-violet-200 text-xs font-normal">({validData.length} tickers)</span>
        </button>
      </div>

      {/* ── Results ── */}
      {hasRun && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <BarChart2 size={15} className="text-emerald-400" />
              <span className="text-sm font-semibold text-slate-200">Kết Quả</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                results.length > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'
              }`}>
                {results.length} / {validData.length} tickers
              </span>
            </div>
            <span className="text-[10px] text-slate-500">Click ticker để xem chart</span>
          </div>

          {results.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm">Không có cổ phiếu nào khớp điều kiện</p>
              <p className="text-xs mt-1 text-slate-600">Thử nới lỏng điều kiện hoặc dùng preset khác</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700/50 bg-slate-900/30 uppercase tracking-wider text-[10px]">
                    {[
                      { k: 'ticker',        label: 'Ticker' },
                      { k: 'price',         label: 'Giá' },
                      { k: 'changePct',     label: '% Ngày' },
                      { k: 'rsi',           label: 'RSI' },
                      { k: 'stochK',        label: 'Stoch K' },
                      { k: 'macdHistogram', label: 'MACD Hist' },
                      { k: 'bbPct',         label: 'BB %B', noSort: true },
                      { k: 'pe',            label: 'P/E' },
                      { k: 'volume',        label: 'Volume' },
                    ].map(({ k, label, noSort }) => (
                      <th key={k}
                        onClick={() => !noSort && toggleSort(k as keyof StockIndicatorResult)}
                        className={`text-left px-3 py-2.5 font-medium ${noSort ? '' : 'cursor-pointer hover:text-slate-300'}`}>
                        {label}{!noSort && <SortArrow k={k as keyof StockIndicatorResult} />}
                      </th>
                    ))}
                    <th className="text-left px-3 py-2.5 font-medium">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {sortedResults.map(item => {
                    const bbPct = (() => {
                      if (!item.bbUpper || !item.bbLower || item.bbUpper === item.bbLower) return null;
                      return ((item.price - item.bbLower) / (item.bbUpper - item.bbLower)) * 100;
                    })();

                    // Count how many conditions this item passes (all pass since it's in results)

                    const rsiColor = item.rsi == null ? '' : item.rsi < 30 ? 'text-emerald-400' : item.rsi > 70 ? 'text-rose-400' : 'text-slate-300';
                    const stochColor = item.stochK == null ? '' : item.stochK < 20 ? 'text-emerald-400' : item.stochK > 80 ? 'text-rose-400' : 'text-slate-300';

                    return (
                      <tr key={item.ticker}
                        onClick={() => onTickerClick(item.ticker)}
                        className="hover:bg-slate-700/30 cursor-pointer transition-colors">
                        <td className="px-3 py-2.5 font-bold text-slate-100">{item.ticker}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-300">{item.price.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono font-semibold">
                          {item.changePct != null ? (
                            <span className={item.changePct > 0 ? 'text-emerald-400' : item.changePct < 0 ? 'text-rose-400' : 'text-slate-400'}>
                              {item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className={`px-3 py-2.5 font-mono ${rsiColor}`}>
                          {item.rsi?.toFixed(1) ?? '—'}
                        </td>
                        <td className={`px-3 py-2.5 font-mono ${stochColor}`}>
                          {item.stochK?.toFixed(1) ?? '—'}
                        </td>
                        <td className={`px-3 py-2.5 font-mono ${(item.macdHistogram ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.macdHistogram != null ? (item.macdHistogram > 0 ? '+' : '') + item.macdHistogram.toFixed(1) : '—'}
                        </td>
                        <td className={`px-3 py-2.5 font-mono ${bbPct == null ? 'text-slate-600' : bbPct > 100 ? 'text-rose-400' : bbPct < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {bbPct != null ? `${bbPct.toFixed(0)}%` : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">
                          {item.pe?.toFixed(1) ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">
                          {item.volume >= 1e6 ? `${(item.volume / 1e6).toFixed(2)}M` : item.volume >= 1e3 ? `${(item.volume / 1e3).toFixed(0)}K` : item.volume}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-0.5" title={`${conditions.length} điều kiện khớp`}>
                            {conditions.map((_, i) => (
                              <span key={i} className="w-2 h-2 rounded-sm bg-emerald-500/70" />
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Save Preset Modal ── */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSaveModal(false); }}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2"><Save size={15} className="text-amber-400" /> Lưu Preset</h3>
              <button onClick={() => setSaveModal(false)} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Emoji" value={newPresetEmoji}
                  onChange={e => setNewEmoji(e.target.value.slice(-2))}
                  className="w-14 bg-slate-900 border border-slate-700 rounded-md px-2 py-2 text-center text-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text" placeholder="Tên preset..." value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePreset()}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Preview conditions */}
              <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
                {conditions.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
                    {i > 0 && <span className={`px-1.5 py-0.5 rounded font-bold ${c.logic === 'AND' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{c.logic}</span>}
                    <span className="text-slate-400">{conditionLabel(c)}</span>
                  </div>
                ))}
              </div>

              <button onClick={savePreset} disabled={!newPresetName.trim()}
                className="w-full py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-40">
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
