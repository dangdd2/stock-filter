"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { TrendingUp, TrendingDown, LayoutGrid, ChevronLeft, ChevronRight, RefreshCw, Maximize2 } from 'lucide-react';
import type { StockIndicatorResult, Watchlist } from '@/types';

// ── Mini area chart using SVG ────────────────────────────────

function MiniChart({
  closes, changePct, width = 200, height = 80,
}: { closes: number[]; changePct?: number | null; width?: number; height?: number }) {
  if (!closes || closes.length < 2) {
    return <div className="w-full h-full bg-slate-800/40 flex items-center justify-center text-slate-600 text-xs">No data</div>;
  }

  const min   = Math.min(...closes);
  const max   = Math.max(...closes);
  const range = max - min || 1;
  const pad   = { x: 4, y: 6 };
  const w     = width  - pad.x * 2;
  const h     = height - pad.y * 2;

  const pts = closes.map((v, i) => {
    const x = pad.x + (i / (closes.length - 1)) * w;
    const y = pad.y + (1 - (v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const isUp    = (changePct ?? 0) >= 0;
  const stroke  = isUp ? '#10b981' : '#f43f5e';
  const fillTop = isUp ? '#10b98133' : '#f43f5e33';
  const fillBot = isUp ? '#10b98100' : '#f43f5e00';
  const gradId  = `grad-${Math.random().toString(36).slice(2, 7)}`;
  const lastPt  = pts[pts.length - 1];
  const [lx, ly] = lastPt.split(',').map(Number);
  const fillPath = `M${pts[0]} L${pts.join(' L')} L${(pad.x + w).toFixed(1)},${(pad.y + h).toFixed(1)} L${pad.x},${(pad.y + h).toFixed(1)} Z`;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={fillTop} />
          <stop offset="100%" stopColor={fillBot} />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path d={fillPath} fill={`url(#${gradId})`} />
      {/* Line */}
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Last price dot */}
      <circle cx={lx} cy={ly} r="2.5" fill={stroke} />
    </svg>
  );
}

// ── Single ticker card ───────────────────────────────────────

function TickerCard({
  item, onClick, gridSize,
}: { item: StockIndicatorResult; onClick: () => void; gridSize: number }) {
  const isUp    = (item.changePct ?? 0) >= 0;
  const pctColor = isUp ? 'text-emerald-400' : 'text-rose-400';
  const bgColor  = isUp ? 'bg-emerald-500/5 border-emerald-500/20' : item.changePct === 0 ? 'bg-slate-800/60 border-slate-700/50' : 'bg-rose-500/5 border-rose-500/20';
  const closes   = item.closes7d && item.closes7d.length >= 2 ? item.closes7d : null;
  const chartH   = gridSize <= 3 ? 90 : gridSize === 4 ? 72 : 60;
  const fs       = gridSize <= 3 ? 'text-sm' : 'text-xs';

  return (
    <div
      onClick={onClick}
      className={`relative border rounded-xl overflow-hidden cursor-pointer hover:brightness-110 transition-all group ${bgColor}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 pt-2 pb-0.5">
        <span className={`font-bold text-slate-100 ${fs}`}>{item.ticker}</span>
        <span className={`font-semibold ${fs} ${pctColor}`}>
          {item.changePct != null ? `${isUp ? '+' : ''}${item.changePct.toFixed(2)}%` : '—'}
        </span>
      </div>

      {/* Mini chart */}
      <div style={{ height: chartH }}>
        {closes
          ? <MiniChart closes={closes} changePct={item.changePct} width={220} height={chartH} />
          : <div className="w-full h-full flex items-center justify-center"><RefreshCw size={14} className="text-slate-600 animate-spin"/></div>
        }
      </div>

      {/* Footer — min/max/current */}
      <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] text-slate-500 border-t border-white/5">
        <span>Min: <span className="text-slate-400">{item.low52w ? Math.round(item.low52w).toLocaleString() : '—'}</span></span>
        <span className={`font-semibold ${pctColor}`}>{item.price ? item.price.toLocaleString() : '—'}</span>
        <span>Max: <span className="text-slate-400">{item.high52w ? Math.round(item.high52w).toLocaleString() : '—'}</span></span>
      </div>
    </div>
  );
}

// ── Sector sidebar item ───────────────────────────────────────

function SectorItem({
  name, avgPct, count, active, onClick,
}: { name: string; avgPct: number | null; count: number; active: boolean; onClick: () => void }) {
  const isUp    = (avgPct ?? 0) >= 0;
  const pctColor = avgPct == null ? 'text-slate-500' : isUp ? 'text-emerald-400' : 'text-rose-400';
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors text-left ${
        active ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
      }`}>
      <span className="truncate max-w-[110px]">{name}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`font-mono text-[10px] font-semibold ${pctColor}`}>
          {avgPct != null ? `${isUp ? '+' : ''}${avgPct.toFixed(2)}%` : '—'}
        </span>
        <span className="text-[10px] text-slate-600">({count})</span>
      </div>
    </button>
  );
}

// ── Grid size options ─────────────────────────────────────────

const GRID_OPTIONS = [
  { label: '3×3', cols: 3, rows: 3 },
  { label: '4×4', cols: 4, rows: 4 },
  { label: '4×5', cols: 4, rows: 5 },
  { label: '5×5', cols: 5, rows: 5 },
] as const;

type GridOption = typeof GRID_OPTIONS[number];

// ── Main component ────────────────────────────────────────────

interface Props {
  data: StockIndicatorResult[];
  watchlists: Watchlist[];
  onTickerClick: (ticker: string) => void;
}

const MASTER_ID = 'master';

export default function MultiChart({ data, watchlists, onTickerClick }: Props) {
  const [grid,            setGrid]            = useState<GridOption>(GRID_OPTIONS[2]); // 4×5 default
  const [activeSector,    setActiveSector]    = useState<string>('ALL');
  const [page,            setPage]            = useState(0);

  const perPage = grid.cols * grid.rows;

  // Build sector map from watchlists (same logic as heatmap)
  const sectorMap = useMemo(() => {
    const map: Record<string, string> = {};
    watchlists.filter(w => w.id !== MASTER_ID).forEach(w => {
      w.tickers.forEach(t => { map[t.toUpperCase()] = w.name; });
    });
    return map;
  }, [watchlists]);

  const getSector = useCallback((ticker: string) => sectorMap[ticker.toUpperCase()] ?? 'Khác', [sectorMap]);

  const validData = useMemo(() => data.filter(d => !d.error && d.price > 0), [data]);

  // Build sectors list with avg % change
  const sectors = useMemo(() => {
    const groups: Record<string, StockIndicatorResult[]> = {};
    validData.forEach(d => {
      const s = getSector(d.ticker);
      (groups[s] = groups[s] ?? []).push(d);
    });

    const list = Object.entries(groups).map(([name, items]) => {
      const withPct = items.filter(i => i.changePct != null);
      const avgPct  = withPct.length ? withPct.reduce((s, i) => s + (i.changePct ?? 0), 0) / withPct.length : null;
      return { name, count: items.length, avgPct };
    }).sort((a, b) => b.count - a.count);

    // ALL entry
    const allWithPct = validData.filter(i => i.changePct != null);
    const allAvg = allWithPct.length ? allWithPct.reduce((s, i) => s + (i.changePct ?? 0), 0) / allWithPct.length : null;
    return [{ name: 'ALL', count: validData.length, avgPct: allAvg }, ...list];
  }, [validData, getSector]);

  // Filtered tickers for current sector
  const filtered = useMemo(() => {
    if (activeSector === 'ALL') return validData;
    return validData.filter(d => getSector(d.ticker) === activeSector);
  }, [validData, activeSector, getSector]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged      = filtered.slice(page * perPage, (page + 1) * perPage);

  // Reset page when sector/grid changes
  useEffect(() => { setPage(0); }, [activeSector, grid]);

  const colClass: Record<number, string> = {
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  };

  if (validData.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <LayoutGrid size={36} className="mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400">Chưa có dữ liệu. Nhấn Refresh để tải.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 h-[calc(100vh-180px)] min-h-[600px]">

      {/* ── Left sidebar ── */}
      <div className="w-52 shrink-0 bg-slate-800 border border-slate-700 rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-700">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Danh mục</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
          {sectors.map(s => (
            <SectorItem key={s.name} name={s.name === 'ALL' ? '★ Tất cả' : s.name}
              avgPct={s.avgPct} count={s.count}
              active={activeSector === s.name}
              onClick={() => setActiveSector(s.name)} />
          ))}
        </div>
      </div>

      {/* ── Right: chart grid ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Toolbar */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">
              {activeSector === 'ALL' ? 'Tất cả' : activeSector}
            </span>
            <span className="text-xs text-slate-500">({filtered.length} tickers)</span>
          </div>

          {/* Grid size selector */}
          <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs ml-auto">
            {GRID_OPTIONS.map(g => (
              <button key={g.label} onClick={() => setGrid(g)}
                className={`px-3 py-1.5 transition-colors ${grid.label === g.label ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'text-slate-400 hover:bg-slate-700'}`}>
                {g.label}
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-slate-400 min-w-[60px] text-center">
                {page + 1} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Gainers/Losers summary */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <TrendingUp size={12} /> {filtered.filter(d => (d.changePct ?? 0) > 0).length}
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <TrendingDown size={12} /> {filtered.filter(d => (d.changePct ?? 0) < 0).length}
            </span>
          </div>
        </div>

        {/* Chart grid */}
        <div className={`flex-1 grid ${colClass[grid.cols]} gap-2 overflow-hidden content-start`}>
          {paged.map(item => (
            <TickerCard key={item.ticker} item={item} gridSize={grid.cols}
              onClick={() => onTickerClick(item.ticker)} />
          ))}
          {/* Empty placeholders to keep grid uniform */}
          {Array.from({ length: perPage - paged.length }).map((_, i) => (
            <div key={`empty-${i}`} className="border border-slate-700/20 rounded-xl bg-slate-800/20" />
          ))}
        </div>
      </div>
    </div>
  );
}
