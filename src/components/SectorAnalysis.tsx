'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, BarChart2, Table2, Info } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import type { SectorAnalysisResult, SectorPerf, TickerPerf } from '@/app/api/sector/route';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtPct = (v: number, signed = true) => `${signed && v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const pctColor = (v: number) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-400';
const pctBg   = (v: number) => v > 1 ? 'bg-emerald-500/15 border-emerald-500/30' : v < -1 ? 'bg-rose-500/15 border-rose-500/30' : 'bg-slate-700/40 border-slate-600/30';

// ─── Performance bar ───────────────────────────────────────────────────────────
function PerfBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max === 0 ? 0 : Math.abs(value) / Math.abs(max) * 100;
  const isPos = value >= 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
        {isPos
          ? <><div className="flex-1" /><div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} /></>
          : <><div className="h-full rounded-full bg-rose-500/70" style={{ width: `${w}%` }} /><div className="flex-1" /></>
        }
      </div>
      <span className={`text-xs font-mono font-bold w-14 text-right ${pctColor(value)}`}>{fmtPct(value)}</span>
    </div>
  );
}

// ─── Breadth pill ──────────────────────────────────────────────────────────────
function BreadthPill({ breadth }: { breadth: number }) {
  const color = breadth >= 60 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                breadth <= 40 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                'bg-slate-600/40 text-slate-300 border-slate-600/30';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${color}`}>
      {breadth.toFixed(0)}% tăng
    </span>
  );
}

// ─── Ticker row inside sector ──────────────────────────────────────────────────
function TickerRow({ t, color, onTickerClick }: { t: TickerPerf; color: string; onTickerClick?: (ticker: string) => void }) {
  if (t.error) return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600">
      <span className="font-mono w-12">{t.ticker}</span>
      <span className="text-[10px] italic">không có dữ liệu</span>
    </div>
  );
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-700/30 transition-colors cursor-pointer"
      onClick={() => onTickerClick?.(t.ticker)}
    >
      <span className="font-mono text-xs font-bold w-12" style={{ color }}>{t.ticker}</span>
      <span className="font-mono text-xs text-slate-300 w-20 text-right">{t.price.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</span>
      <span className={`font-mono text-xs font-semibold w-14 text-right ${pctColor(t.change1d)}`}>{fmtPct(t.change1d)}</span>
      <span className={`font-mono text-xs w-14 text-right ${pctColor(t.change1m)}`}>{fmtPct(t.change1m)}</span>
      <span className={`font-mono text-xs w-14 text-right ${pctColor(t.change3m)}`}>{fmtPct(t.change3m)}</span>
      <span className={`text-[10px] w-10 text-right ${t.rsi != null && t.rsi < 30 ? 'text-emerald-400' : t.rsi != null && t.rsi > 70 ? 'text-rose-400' : 'text-slate-400'}`}>
        {t.rsi != null ? t.rsi.toFixed(0) : '—'}
      </span>
    </div>
  );
}

// ─── Sector Card ───────────────────────────────────────────────────────────────
function SectorCard({
  perf, rank, maxAbs1m, expanded, onToggle, onTickerClick,
}: {
  perf: SectorPerf; rank: number; maxAbs1m: number;
  expanded: boolean; onToggle: () => void; onTickerClick?: (t: string) => void;
}) {
  const { sector, avgChange1d, avgChange1w, avgChange1m, avgChange3m, topMover, worstMover, breadth, validCount } = perf;
  const trendIcon = avgChange1m > 1 ? <TrendingUp size={13} /> : avgChange1m < -1 ? <TrendingDown size={13} /> : <Minus size={13} />;

  return (
    <div className={`bg-slate-800/50 border rounded-xl overflow-hidden transition-all ${pctBg(avgChange1m)}`}>
      {/* Header row */}
      <div className="px-4 py-3 cursor-pointer hover:bg-slate-700/20 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3">
          {/* Rank */}
          <span className="text-[10px] font-bold text-slate-500 w-4">#{rank}</span>
          {/* Color dot */}
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sector.color }} />
          {/* Name */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-100 text-sm leading-tight">{sector.name}</div>
            <div className="text-[10px] text-slate-500">{validCount} mã • {sector.nameEn}</div>
          </div>
          {/* Changes */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="text-[9px] text-slate-500 mb-0.5">1D</div>
              <span className={`font-mono font-bold ${pctColor(avgChange1d)}`}>{fmtPct(avgChange1d)}</span>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-slate-500 mb-0.5">1T</div>
              <span className={`font-mono font-bold ${pctColor(avgChange1w)}`}>{fmtPct(avgChange1w)}</span>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-slate-500 mb-0.5">1M</div>
              <span className={`font-mono font-bold ${pctColor(avgChange1m)}`}>{fmtPct(avgChange1m)}</span>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-slate-500 mb-0.5">3M</div>
              <span className={`font-mono font-bold ${pctColor(avgChange3m)}`}>{fmtPct(avgChange3m)}</span>
            </div>
          </div>
          {/* Breadth */}
          <div className="hidden md:block"><BreadthPill breadth={breadth} /></div>
          {/* Trend icon */}
          <span className={pctColor(avgChange1m)}>{trendIcon}</span>
          {expanded ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
        </div>
        {/* Progress bar */}
        <div className="mt-2">
          <PerfBar value={avgChange1m} max={maxAbs1m} color={sector.color} />
        </div>
      </div>

      {/* Expanded ticker list */}
      {expanded && (
        <div className="border-t border-slate-700/40 bg-slate-900/30">
          {/* Top/Worst movers */}
          {(topMover || worstMover) && (
            <div className="flex gap-3 px-4 py-2 border-b border-slate-700/30">
              {topMover && !topMover.error && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 text-[10px]">Dẫn đầu:</span>
                  <span className="font-mono font-bold" style={{ color: sector.color }}>{topMover.ticker}</span>
                  <span className="text-emerald-400 font-mono font-bold">{fmtPct(topMover.change1d)}</span>
                </div>
              )}
              {worstMover && !worstMover.error && worstMover.ticker !== topMover?.ticker && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 text-[10px]">Kém nhất:</span>
                  <span className="font-mono font-bold text-slate-300">{worstMover.ticker}</span>
                  <span className="text-rose-400 font-mono font-bold">{fmtPct(worstMover.change1d)}</span>
                </div>
              )}
            </div>
          )}
          {/* Column header */}
          <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-slate-600 border-b border-slate-700/20">
            <span className="w-12">Mã</span>
            <span className="w-20 text-right">Giá</span>
            <span className="w-14 text-right">1D</span>
            <span className="w-14 text-right">1M</span>
            <span className="w-14 text-right">3M</span>
            <span className="w-10 text-right">RSI</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {perf.tickers
              .sort((a, b) => (b.error ? -1 : 1) - (a.error ? -1 : 1) || b.change1d - a.change1d)
              .map(t => (
                <TickerRow key={t.ticker} t={t} color={sector.color} onTickerClick={onTickerClick} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bar chart of all sectors ──────────────────────────────────────────────────
function SectorBarChart({ sectors, period }: { sectors: SectorPerf[]; period: '1d' | '1w' | '1m' | '3m' }) {
  const key = period === '1d' ? 'avgChange1d' : period === '1w' ? 'avgChange1w' : period === '1m' ? 'avgChange1m' : 'avgChange3m';
  const data = [...sectors]
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .map(s => ({
      name: s.sector.name.replace('& ', '&\n'),
      value: +(s[key] as number).toFixed(2),
      color: s.sector.color,
    }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <ReTooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
          formatter={(v: unknown) => [`${(v as number) >= 0 ? '+' : ''}${(v as number).toFixed(2)}%`, 'Thay đổi']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.value >= 0 ? entry.color : '#f43f5e'} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Radar chart ───────────────────────────────────────────────────────────────
function SectorRadar({ sectors }: { sectors: SectorPerf[] }) {
  // Top 8 sectors by 1m for clarity
  const top = [...sectors].sort((a, b) => Math.abs(b.avgChange1m) - Math.abs(a.avgChange1m)).slice(0, 8);
  const radarData = top.map(s => ({
    subject: s.sector.name.slice(0, 6),
    '1D': +Math.max(-10, Math.min(10, s.avgChange1d)).toFixed(1),
    '1M': +Math.max(-10, Math.min(10, s.avgChange1m)).toFixed(1),
    '3M': +Math.max(-15, Math.min(15, s.avgChange3m)).toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <Radar name="1D" dataKey="1D" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={1.5} />
        <Radar name="1M" dataKey="1M" stroke="#10b981" fill="#10b981" fillOpacity={0.12} strokeWidth={1.5} />
        <Radar name="3M" dataKey="3M" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.10} strokeWidth={1.5} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Heatmap grid ──────────────────────────────────────────────────────────────
function SectorHeatmap({ sectors, period }: { sectors: SectorPerf[]; period: '1d' | '1w' | '1m' | '3m' }) {
  const key = period === '1d' ? 'avgChange1d' : period === '1w' ? 'avgChange1w' : period === '1m' ? 'avgChange1m' : 'avgChange3m';
  const vals = sectors.map(s => s[key] as number);
  const maxAbs = Math.max(...vals.map(Math.abs), 1);

  const cellColor = (v: number) => {
    const t = Math.min(1, Math.abs(v) / maxAbs);
    if (v >= 0) return `rgba(16, 185, 129, ${0.15 + t * 0.5})`;
    return `rgba(244, 63, 94, ${0.15 + t * 0.5})`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {sectors.map(s => {
        const v = s[key] as number;
        return (
          <div key={s.sector.id}
            className="rounded-xl border border-slate-700/40 p-3 flex flex-col gap-1.5 transition-all hover:border-slate-500/60"
            style={{ background: cellColor(v) }}>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.sector.color }} />
              <span className="text-[11px] font-semibold text-slate-200 leading-tight truncate">{s.sector.name}</span>
            </div>
            <span className={`text-lg font-black font-mono leading-none ${pctColor(v)}`}>{fmtPct(v)}</span>
            <div className="flex items-center justify-between">
              <BreadthPill breadth={s.breadth} />
              <span className="text-[9px] text-slate-500">{s.validCount} mã</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Table view ────────────────────────────────────────────────────────────────
function SectorTable({ sectors }: { sectors: SectorPerf[] }) {
  const sorted = [...sectors].sort((a, b) => b.avgChange1m - a.avgChange1m);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            {['#', 'Ngành', '1D', '1T', '1M', '3M', 'RSI TB', 'Breadth', 'Dẫn đầu', 'Kém nhất', 'Mã'].map(h => (
              <th key={h} className="text-left py-2.5 pr-4 text-xs text-slate-500 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {sorted.map((s, i) => (
            <tr key={s.sector.id} className="hover:bg-slate-800/30 transition-colors">
              <td className="py-2 pr-4 text-xs text-slate-600">#{i + 1}</td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.sector.color }} />
                  <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">{s.sector.name}</span>
                </div>
              </td>
              {[s.avgChange1d, s.avgChange1w, s.avgChange1m, s.avgChange3m].map((v, ci) => (
                <td key={ci} className={`py-2 pr-4 text-xs font-mono font-bold whitespace-nowrap ${pctColor(v)}`}>{fmtPct(v)}</td>
              ))}
              <td className={`py-2 pr-4 text-xs font-mono ${s.avgRsi != null && s.avgRsi < 40 ? 'text-emerald-400' : s.avgRsi != null && s.avgRsi > 65 ? 'text-rose-400' : 'text-slate-400'}`}>
                {s.avgRsi != null ? s.avgRsi.toFixed(0) : '—'}
              </td>
              <td className="py-2 pr-4"><BreadthPill breadth={s.breadth} /></td>
              <td className="py-2 pr-4 text-xs font-mono">
                {s.topMover && !s.topMover.error ? (
                  <span className="text-emerald-400 font-bold">{s.topMover.ticker} ({fmtPct(s.topMover.change1d)})</span>
                ) : '—'}
              </td>
              <td className="py-2 pr-4 text-xs font-mono">
                {s.worstMover && !s.worstMover.error && s.worstMover.ticker !== s.topMover?.ticker ? (
                  <span className="text-rose-400">{s.worstMover.ticker} ({fmtPct(s.worstMover.change1d)})</span>
                ) : '—'}
              </td>
              <td className="py-2 text-xs text-slate-600">{s.validCount}/{s.sector.tickers.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────
interface Props {
  onTickerClick?: (ticker: string) => void;
}

type ViewMode = 'cards' | 'bar' | 'heatmap' | 'radar' | 'table';
type Period = '1d' | '1w' | '1m' | '3m';

export default function SectorAnalysis({ onTickerClick }: Props) {
  const [data, setData] = useState<SectorAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('heatmap');
  const [period, setPeriod] = useState<Period>('1m');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<Period>('1m');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/sector');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sortKey = sortBy === '1d' ? 'avgChange1d' : sortBy === '1w' ? 'avgChange1w' : sortBy === '1m' ? 'avgChange1m' : 'avgChange3m';
  const sorted = data ? [...data.sectors].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)) : [];
  const maxAbs1m = sorted.length ? Math.max(...sorted.map(s => Math.abs(s.avgChange1m)), 1) : 1;

  const VIEWS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'heatmap', label: 'Heatmap',   icon: <BarChart2 size={12} /> },
    { id: 'cards',   label: 'Chi tiết',  icon: <ChevronDown size={12} /> },
    { id: 'bar',     label: 'Bar chart', icon: <BarChart2 size={12} /> },
    { id: 'radar',   label: 'Radar',     icon: <Info size={12} /> },
    { id: 'table',   label: 'Bảng',      icon: <Table2 size={12} /> },
  ];

  const PERIODS: { id: Period; label: string }[] = [
    { id: '1d', label: '1 Ngày' }, { id: '1w', label: '1 Tuần' },
    { id: '1m', label: '1 Tháng' }, { id: '3m', label: '3 Tháng' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-100">Sector Analysis</h2>
          <p className="text-xs text-slate-500 mt-0.5">Phân tích hiệu suất theo ngành — HOSE/HNX Vietnam ({data ? `${data.sectors.reduce((s, x) => s + x.validCount, 0)} mã` : '—'})</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 text-slate-300 border border-slate-600 rounded-lg text-xs hover:bg-slate-600 transition-colors disabled:opacity-40">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${view === v.id ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-700'}`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        {/* Period toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
          {PERIODS.map(p => (
            <button key={p.id}
              onClick={() => { setPeriod(p.id); setSortBy(p.id); }}
              className={`px-2.5 py-1.5 transition-colors ${period === p.id ? 'bg-slate-600 text-slate-200' : 'text-slate-500 hover:bg-slate-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {data && (
          <span className="text-[10px] text-slate-600">
            Cập nhật: {new Date(data.fetchedAt).toLocaleTimeString('vi-VN')}
          </span>
        )}
      </div>

      {/* Error */}
      {error && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2">⚠ {error}</div>}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Đang tải dữ liệu {data ? '' : '10 ngành '}từ Yahoo Finance…</span>
          {!data && <span className="text-xs text-slate-600">Có thể mất 15–20 giây lần đầu</span>}
        </div>
      )}

      {/* Content */}
      {data && !loading && (
        <>
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            {(['1d', '1w', '1m', '3m'] as Period[]).map(p => {
              const key2 = p === '1d' ? 'avgChange1d' : p === '1w' ? 'avgChange1w' : p === '1m' ? 'avgChange1m' : 'avgChange3m';
              const best = [...data.sectors].sort((a, b) => (b[key2] as number) - (a[key2] as number))[0];
              const worst = [...data.sectors].sort((a, b) => (a[key2] as number) - (b[key2] as number))[0];
              const pLabel = p === '1d' ? '1N' : p === '1w' ? '1T' : p === '1m' ? '1M' : '3M';
              return (
                <div key={p} className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs space-y-0.5">
                  <div className="text-slate-500 font-medium">{pLabel}</div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400 font-mono font-bold">{best.sector.name.slice(0, 8)}… {fmtPct(best[key2] as number)}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-rose-400 font-mono">{worst.sector.name.slice(0, 8)}… {fmtPct(worst[key2] as number)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Views */}
          {view === 'heatmap' && <SectorHeatmap sectors={sorted} period={period} />}

          {view === 'bar' && (
            <div>
              <div className="text-xs text-slate-500 mb-3">Thay đổi trung vị ({period === '1d' ? '1 ngày' : period === '1w' ? '1 tuần' : period === '1m' ? '1 tháng' : '3 tháng'})</div>
              <SectorBarChart sectors={data.sectors} period={period} />
            </div>
          )}

          {view === 'radar' && (
            <div>
              <div className="text-xs text-slate-500 mb-3">Radar — 8 ngành biến động mạnh nhất (xanh=1D, lá=1M, vàng=3M, capped ±15%)</div>
              <SectorRadar sectors={data.sectors} />
            </div>
          )}

          {view === 'table' && <SectorTable sectors={sorted} />}

          {view === 'cards' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-500">Sắp xếp theo:</span>
                {PERIODS.map(p => (
                  <button key={p.id} onClick={() => setSortBy(p.id)}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${sortBy === p.id ? 'bg-slate-600 text-slate-200 border-slate-500' : 'text-slate-500 border-slate-700 hover:bg-slate-700'}`}>
                    {p.label}
                  </button>
                ))}
                <button onClick={() => setExpanded(new Set(sorted.map(s => s.sector.id)))}
                  className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors">Mở tất cả</button>
                <button onClick={() => setExpanded(new Set())}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Đóng tất cả</button>
              </div>
              {sorted.map((s, i) => (
                <SectorCard key={s.sector.id} perf={s} rank={i + 1} maxAbs1m={maxAbs1m}
                  expanded={expanded.has(s.sector.id)} onToggle={() => toggleExpand(s.sector.id)}
                  onTickerClick={onTickerClick} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
