"use client";

import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Search, SlidersHorizontal, BarChart2 } from 'lucide-react';
import { scanPatterns, PATTERN_CONFIG, type PatternResult, type PatternType, type PatternDirection } from '@/lib/patternRecognition';
import type { StockIndicatorResult } from '@/types';

// ── Mini SVG pattern chart ────────────────────────────────────
function PatternMiniChart({ closes, pattern }: { closes: number[]; pattern: PatternResult }) {
  const w = 200; const h = 72; const pad = { x: 6, y: 8 };
  const cw = w - pad.x * 2; const ch = h - pad.y * 2;

  const min = Math.min(...closes); const max = Math.max(...closes);
  const range = max - min || 1;
  const px = (i: number) => pad.x + (i / (closes.length - 1)) * cw;
  const py = (v: number) => pad.y + (1 - (v - min) / range) * ch;

  const pts = closes.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const isUp = pattern.direction === 'bullish';
  const stroke = isUp ? '#10b981' : pattern.direction === 'bearish' ? '#f43f5e' : '#94a3b8';

  // Draw key levels
  const lvls = [
    { price: pattern.keyLevels.resistance, color: '#f43f5e88', dash: '4,3' },
    { price: pattern.keyLevels.support,    color: '#10b98188', dash: '4,3' },
    { price: pattern.keyLevels.neckline,   color: '#f59e0b88', dash: '3,2' },
    { price: pattern.keyLevels.target,     color: '#a78bfa88', dash: '6,3' },
  ].filter(l => l.price != null);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {/* Price line */}
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Key levels */}
      {lvls.map((l, i) => {
        const y = py(l.price!).toFixed(1);
        return <line key={i} x1={pad.x} y1={y} x2={w - pad.x} y2={y} stroke={l.color} strokeWidth="1" strokeDasharray={l.dash}/>;
      })}
    </svg>
  );
}

// ── Pattern card ──────────────────────────────────────────────
function PatternCard({
  ticker, pattern, closes, price, changePct, onClick,
}: {
  ticker: string; pattern: PatternResult; closes: number[];
  price: number; changePct?: number | null; onClick: () => void;
}) {
  const cfg = PATTERN_CONFIG[pattern.type];
  const borderColor = cfg.direction === 'bullish' ? 'border-emerald-500/30' : cfg.direction === 'bearish' ? 'border-rose-500/30' : 'border-slate-600/50';
  const bgColor     = cfg.direction === 'bullish' ? 'bg-emerald-500/5'      : cfg.direction === 'bearish' ? 'bg-rose-500/5'      : 'bg-slate-800/60';
  const badgeColor  = cfg.direction === 'bullish' ? 'bg-emerald-500/20 text-emerald-300' : cfg.direction === 'bearish' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-300';
  const confColor   = pattern.confidence >= 75 ? 'bg-emerald-500' : pattern.confidence >= 55 ? 'bg-amber-500' : 'bg-slate-500';

  return (
    <div onClick={onClick} className={`border rounded-xl overflow-hidden cursor-pointer hover:brightness-110 transition-all ${borderColor} ${bgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-100 text-sm">{ticker}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeColor}`}>
            {cfg.emoji} {cfg.label}
          </span>
        </div>
        <span className={`text-xs font-mono font-semibold ${(changePct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
        </span>
      </div>

      {/* Mini chart */}
      <div className="h-[72px] mx-1">
        <PatternMiniChart closes={closes} pattern={pattern}/>
      </div>

      {/* Key levels */}
      <div className="px-3 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-white/5">
        {pattern.keyLevels.neckline   && <span className="text-[10px] text-amber-400">Neckline: {pattern.keyLevels.neckline.toLocaleString()}</span>}
        {pattern.keyLevels.resistance && <span className="text-[10px] text-rose-400">KCự: {pattern.keyLevels.resistance.toLocaleString()}</span>}
        {pattern.keyLevels.support    && <span className="text-[10px] text-emerald-400">HT: {pattern.keyLevels.support.toLocaleString()}</span>}
        {pattern.keyLevels.target     && <span className="text-[10px] text-violet-400">Target: {pattern.keyLevels.target.toLocaleString()}</span>}
      </div>

      {/* Footer */}
      <div className="px-3 pb-2.5 pt-1 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 truncate max-w-[60%]">{pattern.description}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-500">Tin cậy</span>
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${confColor}`} style={{ width: `${pattern.confidence}%` }}/>
          </div>
          <span className="text-[10px] text-slate-400 font-mono w-8">{pattern.confidence}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────
interface ScanResult {
  ticker: string;
  item: StockIndicatorResult;
  patterns: PatternResult[];
  topPattern: PatternResult;
}

interface Props {
  data: StockIndicatorResult[];
  onTickerClick: (ticker: string) => void;
}

type DirFilter = 'ALL' | 'bullish' | 'bearish' | 'neutral';

const PATTERN_GROUPS: { label: string; types: PatternType[] }[] = [
  { label: 'Đảo chiều', types: ['HEAD_AND_SHOULDERS','INV_HEAD_AND_SHOULDERS','DOUBLE_TOP','DOUBLE_BOTTOM'] },
  { label: 'Tiếp diễn', types: ['BULL_FLAG','BEAR_FLAG','CUP_AND_HANDLE'] },
  { label: 'Tam giác',  types: ['ASCENDING_TRIANGLE','DESCENDING_TRIANGLE','SYMMETRICAL_TRIANGLE'] },
  { label: 'Nêm',       types: ['RISING_WEDGE','FALLING_WEDGE'] },
];

export default function PatternRecognitionPanel({ data, onTickerClick }: Props) {
  const [dirFilter,  setDirFilter]  = useState<DirFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<PatternType | 'ALL'>('ALL');
  const [minConf,    setMinConf]    = useState(50);
  const [search,     setSearch]     = useState('');
  const [sortBy,     setSortBy]     = useState<'confidence' | 'ticker'>('confidence');

  // Run pattern scan on all valid data
  const scanResults = useMemo<ScanResult[]>(() => {
    const results: ScanResult[] = [];
    for (const item of data) {
      if (item.error || !item.closes6m || item.closes6m.length < 20) continue;
      if (!item.highs6m || !item.lows6m) continue;
      const patterns = scanPatterns(item.closes6m, item.highs6m, item.lows6m);
      if (!patterns.length) continue;
      results.push({ ticker: item.ticker, item, patterns, topPattern: patterns[0] });
    }
    return results;
  }, [data]);

  const filtered = useMemo(() => {
    return scanResults
      .filter(r => dirFilter  === 'ALL' || r.topPattern.direction === dirFilter)
      .filter(r => typeFilter === 'ALL' || r.patterns.some(p => p.type === typeFilter))
      .filter(r => r.topPattern.confidence >= minConf)
      .filter(r => !search || r.ticker.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => sortBy === 'confidence'
        ? b.topPattern.confidence - a.topPattern.confidence
        : a.ticker.localeCompare(b.ticker));
  }, [scanResults, dirFilter, typeFilter, minConf, search, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const bull = scanResults.filter(r => r.topPattern.direction === 'bullish').length;
    const bear = scanResults.filter(r => r.topPattern.direction === 'bearish').length;
    const byType: Partial<Record<PatternType, number>> = {};
    scanResults.forEach(r => { byType[r.topPattern.type] = (byType[r.topPattern.type] ?? 0) + 1; });
    const topType = Object.entries(byType).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    return { total: scanResults.length, bull, bear, topType };
  }, [scanResults]);

  if (data.filter(d => !d.error && d.closes6m && d.closes6m.length >= 20).length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <BarChart2 size={36} className="mx-auto mb-3 text-slate-600"/>
        <p className="text-slate-400 font-medium mb-1">Chưa có dữ liệu</p>
        <p className="text-slate-600 text-sm">Nhấn Refresh để tải dữ liệu rồi quét pattern.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-200">Pattern Recognition</span>
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold">{stats.total} patterns</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400"><TrendingUp size={12}/> {stats.bull} Bullish</span>
          <span className="flex items-center gap-1 text-rose-400"><TrendingDown size={12}/> {stats.bear} Bearish</span>
          <span className="flex items-center gap-1 text-slate-400"><Minus size={12}/> {stats.total - stats.bull - stats.bear} Neutral</span>
        </div>
        {stats.topType && (
          <span className="text-xs text-slate-500">
            Phổ biến nhất: <span className="text-slate-300">{PATTERN_CONFIG[stats.topType[0] as PatternType]?.emoji} {PATTERN_CONFIG[stats.topType[0] as PatternType]?.label}</span> ({stats.topType[1]})
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3">
        <SlidersHorizontal size={13} className="text-slate-500"/>

        {/* Search */}
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input type="text" placeholder="Tìm ticker..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-md pl-7 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"/>
        </div>

        {/* Direction */}
        <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs">
          {([['ALL','Tất cả'],['bullish','🟢 Tăng'],['bearish','🔴 Giảm'],['neutral','⚪ Trung lập']] as [DirFilter,string][]).map(([v,l]) => (
            <button key={v} onClick={() => setDirFilter(v)} className={`px-2.5 py-1.5 transition-colors ${dirFilter===v?'bg-blue-500/20 text-blue-300':'text-slate-400 hover:bg-slate-700'}`}>{l}</button>
          ))}
        </div>

        {/* Pattern type group */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as PatternType | 'ALL')}
          className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="ALL">Mọi pattern</option>
          {PATTERN_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.types.map(t => <option key={t} value={t}>{PATTERN_CONFIG[t].emoji} {PATTERN_CONFIG[t].label}</option>)}
            </optgroup>
          ))}
        </select>

        {/* Min confidence */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Tin cậy ≥</span>
          <input type="range" min={40} max={90} step={5} value={minConf} onChange={e => setMinConf(Number(e.target.value))}
            className="w-20 accent-blue-500"/>
          <span className="text-slate-200 font-mono w-8">{minConf}%</span>
        </div>

        {/* Sort */}
        <div className="ml-auto flex rounded-md overflow-hidden border border-slate-700 text-xs">
          <button onClick={() => setSortBy('confidence')} className={`px-2.5 py-1.5 transition-colors ${sortBy==='confidence'?'bg-slate-600 text-slate-200':'text-slate-400 hover:bg-slate-700'}`}>Tin cậy</button>
          <button onClick={() => setSortBy('ticker')}     className={`px-2.5 py-1.5 transition-colors ${sortBy==='ticker'    ?'bg-slate-600 text-slate-200':'text-slate-400 hover:bg-slate-700'}`}>Ticker</button>
        </div>

        <span className="text-xs text-slate-500">{filtered.length} kết quả</span>
      </div>

      {/* Pattern grid */}
      {filtered.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl py-12 text-center">
          <p className="text-slate-500">Không tìm thấy pattern khớp bộ lọc</p>
          <p className="text-slate-600 text-sm mt-1">Thử giảm ngưỡng tin cậy hoặc bỏ bớt bộ lọc</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(({ ticker, item, topPattern }) => (
            <PatternCard
              key={ticker} ticker={ticker} pattern={topPattern}
              closes={item.closes6m ?? item.closes60d ?? item.closes7d ?? []}
              price={item.price} changePct={item.changePct}
              onClick={() => onTickerClick(ticker)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Chú thích đường kẻ trên chart</p>
        <div className="flex flex-wrap gap-4 text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-8 h-px bg-amber-400 inline-block" style={{borderTop:'1px dashed #f59e0b'}}/><span className="text-slate-400">Neckline</span></span>
          <span className="flex items-center gap-1.5"><span className="w-8 h-px bg-rose-400 inline-block" style={{borderTop:'1px dashed #f43f5e'}}/><span className="text-slate-400">Kháng cự</span></span>
          <span className="flex items-center gap-1.5"><span className="w-8 h-px bg-emerald-400 inline-block" style={{borderTop:'1px dashed #10b981'}}/><span className="text-slate-400">Hỗ trợ</span></span>
          <span className="flex items-center gap-1.5"><span className="w-8 h-px bg-violet-400 inline-block" style={{borderTop:'1px dashed #a78bfa'}}/><span className="text-slate-400">Target</span></span>
          <span className="text-slate-600 ml-auto">Pattern tính từ dữ liệu 6 tháng · Click card để xem chart đầy đủ + AI Analysis</span>
        </div>
      </div>
    </div>
  );
}
