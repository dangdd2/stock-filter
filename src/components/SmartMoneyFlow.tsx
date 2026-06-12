'use client';

import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Activity, BarChart2, ChevronDown } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip as ReTooltip, CartesianGrid, ReferenceLine, Area,
} from 'recharts';
import type { SmartMoneyResult, FlowSignal, PriceVsFlowDivergence } from '@/app/api/smartmoney/route';

// ─── Config maps ───────────────────────────────────────────────────────────────
const SIGNAL_CFG: Record<FlowSignal, { label: string; cls: string; dot: string }> = {
  strong_accumulation: { label: '✅ Tích lũy mạnh',   cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
  accumulation:        { label: '🟢 Tích lũy',        cls: 'bg-green-500/15 text-green-300 border-green-500/30',       dot: 'bg-green-400'   },
  neutral:             { label: '⬜ Trung tính',       cls: 'bg-slate-600/40 text-slate-300 border-slate-600/30',       dot: 'bg-slate-500'   },
  distribution:        { label: '🟠 Phân phối',        cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30',    dot: 'bg-orange-400'  },
  strong_distribution: { label: '🔴 Phân phối mạnh',  cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40',          dot: 'bg-rose-400'    },
};

const DIV_CFG: Record<PriceVsFlowDivergence, { label: string; cls: string }> = {
  bullish_divergence: { label: '📈 Phân kỳ tăng',  cls: 'text-emerald-400' },
  bearish_divergence: { label: '📉 Phân kỳ giảm',  cls: 'text-rose-400'    },
  confirmed_up:       { label: '✅ Xác nhận tăng',  cls: 'text-emerald-400' },
  confirmed_down:     { label: '❌ Xác nhận giảm', cls: 'text-rose-400'    },
  neutral:            { label: '— Trung tính',      cls: 'text-slate-500'   },
};

// ─── Gauge ─────────────────────────────────────────────────────────────────────
function Gauge({ value, min = 0, max = 100, label, color }: { value: number | null; min?: number; max?: number; label: string; color: string }) {
  if (value == null) return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-8 flex items-center justify-center text-slate-500 font-mono text-lg">—</div>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -180 + pct * 180;
  const rad = angle * Math.PI / 180;
  const r = 28, cx = 32, cy = 32;
  const nx = cx + r * Math.cos(rad), ny = cy + r * Math.sin(rad);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg viewBox="0 0 64 36" className="w-16 h-10">
        <path d="M4,32 A28,28 0 0,1 60,32" fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
        <path d={`M4,32 A28,28 0 0,1 ${nx.toFixed(1)},${ny.toFixed(1)}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
        <text x="32" y="30" textAnchor="middle" fontSize="9" fill="#e2e8f0" fontWeight="bold">{value.toFixed(1)}</text>
      </svg>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}

// ─── Trend arrow ───────────────────────────────────────────────────────────────
function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up')   return <TrendingUp  size={13} className="text-emerald-400" />;
  if (trend === 'down') return <TrendingDown size={13} className="text-rose-400"   />;
  return <Minus size={13} className="text-slate-500" />;
}

// ─── Flow chart (price + CMF + volume bars) ────────────────────────────────────
function FlowChart({ data }: { data: SmartMoneyResult['dailyFlow'] }) {
  if (!data.length) return null;
  const chartData = data.slice(-60).map(d => ({
    date: d.date.slice(5),
    close: d.close,
    vwap: d.vwap20,
    cmf: d.cmf20 != null ? +d.cmf20.toFixed(3) : null,
    mfi: d.mfi14,
    posVol:  d.mfVolume > 0 ? d.mfVolume / 1e6 : 0,
    negVol:  d.mfVolume < 0 ? Math.abs(d.mfVolume) / 1e6 : 0,
  }));

  return (
    <div className="space-y-3">
      {/* Price + VWAP + Volume */}
      <div>
        <div className="text-[10px] text-slate-500 mb-1">Giá & VWAP20 + Dòng tiền (khối lượng tích cực/tiêu cực)</div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} interval={9} />
            <YAxis yAxisId="price" orientation="right" tick={{ fill: '#64748b', fontSize: 9 }} width={50}
              tickFormatter={v => v.toLocaleString('vi-VN')} domain={['auto','auto']} />
            <YAxis yAxisId="vol" orientation="left" tick={{ fill: '#64748b', fontSize: 9 }} width={36}
              tickFormatter={v => `${v.toFixed(0)}M`} />
            <ReTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(v: unknown, name: unknown) => {
                const val = v as number;
                const n = name as string;
                if (n === 'Mua') return [`${val.toFixed(2)}M`, n];
                if (n === 'Bán') return [`${val.toFixed(2)}M`, n];
                return [val.toLocaleString('vi-VN'), n];
              }} />
            <Bar yAxisId="vol" dataKey="posVol" name="Mua" fill="#10b981" opacity={0.7} stackId="vol" />
            <Bar yAxisId="vol" dataKey="negVol" name="Bán" fill="#f43f5e" opacity={0.7} stackId="vol" />
            <Line yAxisId="price" type="monotone" dataKey="close" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Giá" />
            <Line yAxisId="price" type="monotone" dataKey="vwap"  stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="4 3" name="VWAP20" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* CMF */}
      <div>
        <div className="text-[10px] text-slate-500 mb-1">Chaikin Money Flow (CMF20) — trên 0 = dòng tiền vào, dưới 0 = dòng tiền ra</div>
        <ResponsiveContainer width="100%" height={90}>
          <ComposedChart data={chartData} margin={{ left: 4, right: 8, top: 2, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} width={40} tickFormatter={v => v.toFixed(2)} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <ReferenceLine y={0.15}  stroke="#10b981" strokeDasharray="2 4" strokeOpacity={0.4} />
            <ReferenceLine y={-0.15} stroke="#f43f5e" strokeDasharray="2 4" strokeOpacity={0.4} />
            <ReTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(v: unknown) => [(v as number).toFixed(3), 'CMF20']} />
            <Area type="monotone" dataKey="cmf" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={1.5} name="CMF20" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MFI */}
      <div>
        <div className="text-[10px] text-slate-500 mb-1">Money Flow Index (MFI14) — &lt;30 quá bán, &gt;70 quá mua</div>
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={chartData} margin={{ left: 4, right: 8, top: 2, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} width={28} />
            <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(v: unknown) => [(v as number).toFixed(1), 'MFI14']} />
            <Line type="monotone" dataKey="mfi" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MFI14" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Single ticker card ────────────────────────────────────────────────────────
function TickerCard({ data, onGoToTicker }: { data: SmartMoneyResult; onGoToTicker?: (t: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sig = SIGNAL_CFG[data.signal];
  const div = DIV_CFG[data.divergence];

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-700/20 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded(p => !p)}>
        <button onClick={e => { e.stopPropagation(); onGoToTicker?.(data.ticker); }}
          className="font-mono font-black text-lg text-blue-400 hover:text-blue-300 transition-colors">
          {data.ticker}
        </button>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${sig.cls}`}>
          {sig.label}
        </span>
        <span className={`text-xs font-semibold ${div.cls}`}>{div.label}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className={`font-mono text-sm font-bold ${data.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.change1d >= 0 ? '+' : ''}{data.change1d.toFixed(2)}%
          </span>
          <span className="font-mono text-sm text-slate-300">{data.price.toLocaleString('vi-VN')}</span>
          <ChevronDown size={14} className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 px-4 py-3 border-b border-slate-700/40">
        {/* Gauges */}
        <div className="flex flex-col items-center">
          <Gauge value={data.mfi14} min={0} max={100} label="MFI(14)"
            color={data.mfi14 != null && data.mfi14 < 30 ? '#10b981' : data.mfi14 != null && data.mfi14 > 70 ? '#f43f5e' : '#a78bfa'} />
        </div>
        {/* CMF */}
        <div className="bg-slate-700/30 rounded-lg px-2 py-2 flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500">CMF(20)</span>
          <span className={`font-mono font-bold text-sm ${data.cmf20 != null && data.cmf20 > 0 ? 'text-emerald-400' : data.cmf20 != null && data.cmf20 < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {data.cmf20 != null ? (data.cmf20 > 0 ? '+' : '') + data.cmf20.toFixed(3) : '—'}
          </span>
        </div>
        {/* OBV trend */}
        <div className="bg-slate-700/30 rounded-lg px-2 py-2 flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500">OBV Trend</span>
          <div className="flex items-center gap-1"><TrendArrow trend={data.obvTrend} />
            <span className="text-xs font-semibold text-slate-300 capitalize">{data.obvTrend}</span>
          </div>
        </div>
        {/* A/D trend */}
        <div className="bg-slate-700/30 rounded-lg px-2 py-2 flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500">A/D Line</span>
          <div className="flex items-center gap-1"><TrendArrow trend={data.adTrend} />
            <span className="text-xs font-semibold text-slate-300 capitalize">{data.adTrend}</span>
          </div>
        </div>
        {/* VWAP */}
        <div className="bg-slate-700/30 rounded-lg px-2 py-2 flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500">vs VWAP20</span>
          <span className={`text-xs font-bold ${data.priceVsVwap === 'above' ? 'text-emerald-400' : data.priceVsVwap === 'below' ? 'text-rose-400' : 'text-slate-500'}`}>
            {data.priceVsVwap === 'above' ? '↑ Trên' : data.priceVsVwap === 'below' ? '↓ Dưới' : '—'}
            {data.vwap20 && <span className="text-slate-500 font-normal ml-1 text-[10px]">{data.vwap20.toLocaleString('vi-VN')}</span>}
          </span>
        </div>
        {/* Flow ratio */}
        <div className="bg-slate-700/30 rounded-lg px-2 py-2 flex flex-col gap-1">
          <span className="text-[9px] text-slate-500">Flow 30N ({data.posFlowDays}↑/{data.negFlowDays}↓)</span>
          {data.flowRatio != null && (
            <div className="h-1.5 bg-rose-500/30 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${data.flowRatio * 100}%` }} />
            </div>
          )}
          <span className="text-[10px] font-mono text-slate-400">{data.flowRatio != null ? `${(data.flowRatio * 100).toFixed(0)}% ngày mua` : '—'}</span>
        </div>
      </div>

      {/* Signal note */}
      <div className="px-4 py-2 text-xs text-slate-400 bg-slate-900/30">{data.signalNote}</div>

      {/* Expanded chart */}
      {expanded && (
        <div className="px-4 py-4 border-t border-slate-700/40">
          {data.error
            ? <div className="text-rose-400 text-sm">⚠ {data.error}</div>
            : <FlowChart data={data.dailyFlow} />}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────
interface Props {
  watchlistTickers: string[];
  onTickerClick?: (ticker: string) => void;
}

export default function SmartMoneyFlow({ watchlistTickers, onTickerClick }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Map<string, SmartMoneyResult>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<'signal' | 'ticker'>('signal');

  // init from watchlist
  useEffect(() => {
    if (watchlistTickers.length > 0 && selected.length === 0) {
      setSelected(watchlistTickers.slice(0, 6));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistTickers]);

  const loadTicker = useCallback(async (ticker: string) => {
    setLoading(p => new Set([...p, ticker]));
    try {
      const res = await fetch(`/api/smartmoney?ticker=${ticker}`);
      const json = await res.json();
      setResults(p => new Map([...p, [ticker, json]]));
    } catch {
      // ignore
    } finally {
      setLoading(p => { const n = new Set(p); n.delete(ticker); return n; });
    }
  }, []);

  // load when selected changes
  useEffect(() => {
    const notLoaded = selected.filter(t => !results.has(t));
    notLoaded.forEach(t => loadTicker(t));
  }, [selected, results, loadTicker]);

  const addTicker = (t: string) => {
    const c = t.trim().toUpperCase();
    if (!c || selected.includes(c)) return;
    setSelected(p => [...p, c]);
    setInput('');
  };
  const remove = (t: string) => setSelected(p => p.filter(x => x !== t));
  const refresh = (t: string) => { setResults(p => { const n = new Map(p); n.delete(t); return n; }); loadTicker(t); };

  const SIGNAL_ORDER: FlowSignal[] = ['strong_accumulation', 'accumulation', 'neutral', 'distribution', 'strong_distribution'];
  const sorted = [...selected].sort((a, b) => {
    if (sortMode === 'signal') {
      const aS = results.get(a)?.signal ?? 'neutral';
      const bS = results.get(b)?.signal ?? 'neutral';
      return SIGNAL_ORDER.indexOf(aS) - SIGNAL_ORDER.indexOf(bS);
    }
    return a.localeCompare(b);
  });

  // Summary stats
  const loadedResults = sorted.map(t => results.get(t)).filter(Boolean) as SmartMoneyResult[];
  const accumulationCount = loadedResults.filter(r => ['strong_accumulation', 'accumulation'].includes(r.signal)).length;
  const distributionCount = loadedResults.filter(r => ['strong_distribution', 'distribution'].includes(r.signal)).length;
  const divBullish = loadedResults.filter(r => r.divergence === 'bullish_divergence').length;
  const divBearish = loadedResults.filter(r => r.divergence === 'bearish_divergence').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-100">Smart Money Flow</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dòng tiền thông minh — MFI · CMF · OBV · A/D Line · VWAP · Divergence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addTicker(input)}
            placeholder="Thêm mã..."
            className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-28" />
          <button onClick={() => addTicker(input)}
            className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-lg text-xs hover:bg-blue-500/30 transition-colors">
            + Thêm
          </button>
        </div>
      </div>

      {/* Watchlist quick-pick */}
      {watchlistTickers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-slate-500 mr-1">Watchlist:</span>
          {watchlistTickers.map(t => (
            <button key={t} onClick={() => selected.includes(t) ? remove(t) : addTicker(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${selected.includes(t) ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-600/60'}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Stats row */}
      {loadedResults.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Tích lũy',     value: accumulationCount, cls: 'text-emerald-400' },
            { label: 'Phân phối',    value: distributionCount, cls: 'text-rose-400'    },
            { label: 'PK tăng',      value: divBullish,        cls: 'text-blue-400'    },
            { label: 'PK giảm',      value: divBearish,        cls: 'text-amber-400'   },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-slate-800/50 border border-slate-700/40 rounded-xl px-3 py-2 text-center">
              <div className={`text-xl font-black font-mono ${cls}`}>{value}</div>
              <div className="text-[10px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sort + chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
          <button onClick={() => setSortMode('signal')}
            className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${sortMode === 'signal' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500 hover:bg-slate-700'}`}>
            <Activity size={11}/> Theo tín hiệu
          </button>
          <button onClick={() => setSortMode('ticker')}
            className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${sortMode === 'ticker' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500 hover:bg-slate-700'}`}>
            <BarChart2 size={11}/> Theo mã
          </button>
        </div>
        {selected.map(t => (
          <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-slate-700/60 border border-slate-600/50 rounded-full text-xs font-mono text-slate-300">
            {loading.has(t) && <RefreshCw size={9} className="animate-spin" />}
            {t}
            <button onClick={() => remove(t)} className="text-slate-500 hover:text-rose-400 ml-0.5 transition-colors">×</button>
            <button onClick={() => refresh(t)} className="text-slate-500 hover:text-blue-400 transition-colors">↻</button>
          </span>
        ))}
      </div>

      {/* Empty state */}
      {selected.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">Chọn mã từ watchlist hoặc thêm thủ công để phân tích dòng tiền</div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {sorted.map(ticker => {
          const data = results.get(ticker);
          if (!data) return (
            <div key={ticker} className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
              <RefreshCw size={13} className="animate-spin text-slate-500" />
              <span className="font-mono font-bold text-slate-400">{ticker}</span>
              <span className="text-xs text-slate-600">Đang tải dữ liệu dòng tiền…</span>
            </div>
          );
          return <TickerCard key={ticker} data={data} onGoToTicker={onTickerClick} />;
        })}
      </div>
    </div>
  );
}
