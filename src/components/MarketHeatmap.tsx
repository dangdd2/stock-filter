"use client";

import { useMemo, useState, useCallback } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus, LayoutGrid, List } from 'lucide-react';
import type { StockIndicatorResult, Watchlist } from '@/app/page';

const MASTER_ID = 'master';

const PALETTE = [
  '#3b82f6','#8b5cf6','#06b6d4','#f97316','#eab308',
  '#10b981','#6366f1','#14b8a6','#f59e0b','#ec4899',
  '#84cc16','#ef4444','#a855f7','#0ea5e9','#22c55e',
  '#f43f5e','#64748b',
];

interface Props {
  data: StockIndicatorResult[];
  watchlists: Watchlist[];
  onTickerClick?: (ticker: string) => void;
}

interface TreeNode {
  name: string;
  ticker?: string;
  sectorName?: string;
  changePct?: number;
  price?: number;
  marketCap?: number;
  volume?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  size: number;
  children?: TreeNode[];
  sectorColor?: string;
  // index signature for Recharts
  [key: string]: string | number | boolean | TreeNode[] | TreeNode | undefined;
}

function changePctBg(pct: number | null | undefined): string {
  if (pct == null) return '#334155';
  if (pct > 4)    return '#064e3b';
  if (pct > 2)    return '#065f46';
  if (pct > 0.5)  return '#047857';
  if (pct > -0.5) return '#1e293b';
  if (pct > -2)   return '#7f1d1d';
  if (pct > -4)   return '#991b1b';
  return '#450a0a';
}

function changePctText(pct: number | null | undefined): string {
  if (pct == null) return '#64748b';
  if (pct > 0.5)   return '#6ee7b7';
  if (pct < -0.5)  return '#fca5a5';
  return '#94a3b8';
}

interface CellProps {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; ticker?: string; changePct?: number; price?: number;
  sectorColor?: string; onTickerClick?: (t: string) => void;
}

const CustomCell = ({ x, y, width, height, name, ticker, changePct, price, sectorColor, onTickerClick }: CellProps) => {
  const _x = x ?? 0; const _y = y ?? 0;
  const _w = width ?? 0; const _h = height ?? 0;
  if (_w < 8 || _h < 8) return null;
  const bg = changePctBg(changePct);
  const tc = changePctText(changePct);
  const isUp   = changePct != null && changePct > 0;
  const isDown = changePct != null && changePct < 0;
  const pctLabel = changePct != null ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '';

  // Adaptive font sizes based on cell dimensions
  const tickerFs = _w < 40 ? 8 : _w < 65 ? 10 : _w < 100 ? 12 : 14;
  const pctFs    = _w < 40 ? 7 : _w < 65 ? 9  : _w < 100 ? 10 : 12;
  const priceFs  = _w < 65 ? 7 : 9;

  const showTicker = _w > 18 && _h > 14;
  const showPct    = _w > 28 && _h > 26;
  const showPrice  = _h > 52 && _w > 56;

  // Layout: center everything vertically
  const totalLines = (showTicker ? 1 : 0) + (showPct ? 1 : 0) + (showPrice ? 1 : 0);
  const lineH = totalLines > 2 ? 14 : 12;
  const startY = _y + _h / 2 - ((totalLines - 1) * lineH) / 2;
  let lineIdx = 0;

  // Glow border for large movers
  const glowColor = changePct != null && changePct > 3 ? '#22c55e'
                  : changePct != null && changePct < -3 ? '#ef4444' : null;

  return (
    <g onClick={() => ticker && onTickerClick?.(ticker)} style={{ cursor: ticker ? 'pointer' : 'default' }}>
      {/* Background */}
      <rect x={_x+1} y={_y+1} width={_w-2} height={_h-2} rx={3} fill={bg} />
      {/* Glow border for big movers */}
      {glowColor && <rect x={_x+1} y={_y+1} width={_w-2} height={_h-2} rx={3} fill="none" stroke={glowColor} strokeWidth={1.5} strokeOpacity={0.6} />}
      {/* Top accent bar — sector color */}
      {sectorColor && _w > 16 && (
        <rect x={_x+1} y={_y+1} width={_w-2} height={2} rx={1} fill={sectorColor} fillOpacity={0.9} />
      )}
      {/* Ticker */}
      {showTicker && (() => { const ly = startY + lineIdx++ * lineH; return (
        <text x={_x+_w/2} y={ly} textAnchor="middle" dominantBaseline="middle"
          fill="#f8fafc" fontSize={tickerFs} fontWeight="800"
          style={{ pointerEvents:'none', fontFamily:'ui-monospace,monospace', letterSpacing: '0.02em' }}>
          {name}
        </text>
      ); })()}
      {/* % change — prominent */}
      {showPct && (() => { const ly = startY + lineIdx++ * lineH; return (
        <text x={_x+_w/2} y={ly} textAnchor="middle" dominantBaseline="middle"
          fill={tc} fontSize={pctFs} fontWeight="700"
          style={{ pointerEvents:'none' }}>
          {pctLabel}
        </text>
      ); })()}
      {/* Price */}
      {showPrice && (() => { const ly = startY + lineIdx++ * lineH; return (
        <text x={_x+_w/2} y={ly} textAnchor="middle" dominantBaseline="middle"
          fill={isUp ? '#6ee7b7' : isDown ? '#fca5a5' : '#94a3b8'} fontSize={priceFs} fontWeight="500"
          style={{ pointerEvents:'none' }}>
          {price?.toLocaleString('vi-VN')}
        </text>
      ); })()}
    </g>
  );
};

interface TooltipPayload { payload?: TreeNode }
interface TooltipProps { active?: boolean; payload?: TooltipPayload[] }

const HeatTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.[0]?.payload?.ticker) return null;
  const d = payload[0].payload;
  const pct = d.changePct;
  const isUp = pct != null && pct > 0;
  const isDown = pct != null && pct < 0;
  const vol = d.volume;
  const mc = d.marketCap;
  const rsi = d.rsi;
  const macd = d.macd;
  const macdSignal = d.macdSignal;

  const rsiColor = typeof rsi === 'number'
    ? rsi >= 70 ? 'text-rose-400' : rsi <= 30 ? 'text-emerald-400' : 'text-slate-300'
    : 'text-slate-400';
  const rsiTag = typeof rsi === 'number'
    ? rsi >= 70 ? 'Quá mua' : rsi <= 30 ? 'Quá bán' : null
    : null;

  const macdDiff = typeof macd === 'number' && typeof macdSignal === 'number' ? macd - macdSignal : null;
  const macdColor = macdDiff == null ? 'text-slate-400' : macdDiff > 0 ? 'text-emerald-400' : 'text-rose-400';
  const macdTag = macdDiff == null ? null : macdDiff > 0 ? 'Bullish' : 'Bearish';

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs min-w-[180px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold text-slate-100 text-sm">{d.ticker}</span>
        {isUp   && <TrendingUp   size={13} className="text-emerald-400" />}
        {isDown && <TrendingDown size={13} className="text-rose-400" />}
        {!isUp && !isDown && <Minus size={13} className="text-slate-400" />}
        <span className="ml-auto text-[10px] text-slate-500">Click để mở chart</span>
      </div>
      <div className="space-y-0.5 text-slate-400">
        <div>Giá: <span className="text-slate-200 font-mono">{d.price?.toLocaleString()} VND</span></div>
        <div>Thay đổi: <span className={`font-mono font-semibold ${isUp?'text-emerald-400':isDown?'text-rose-400':'text-slate-400'}`}>
          {pct != null ? `${pct>0?'+':''}${pct.toFixed(2)}%` : '—'}
        </span></div>
        {typeof vol === 'number' && <div>Volume: <span className="text-slate-300 font-mono">
          {vol >= 1e6 ? `${(vol/1e6).toFixed(2)}M` : `${(vol/1e3).toFixed(0)}K`}
        </span></div>}
        {typeof mc === 'number' && <div>Vốn hóa: <span className="text-slate-300 font-mono">
          {mc >= 1e12 ? `${(mc/1e12).toFixed(2)}T` : mc >= 1e9 ? `${(mc/1e9).toFixed(2)}B` : `${(mc/1e6).toFixed(0)}M`}
        </span></div>}

        {(typeof rsi === 'number' || typeof macd === 'number') && (
          <div className="pt-1 mt-1 border-t border-slate-700 space-y-0.5">
            {typeof rsi === 'number' && (
              <div className="flex items-center justify-between gap-2">
                <span>RSI (14):</span>
                <span className="flex items-center gap-1">
                  <span className={`font-mono font-semibold ${rsiColor}`}>{rsi.toFixed(1)}</span>
                  {rsiTag && <span className={`text-[9px] px-1 rounded ${rsi>=70?'bg-rose-500/20 text-rose-300':'bg-emerald-500/20 text-emerald-300'}`}>{rsiTag}</span>}
                </span>
              </div>
            )}
            {typeof macd === 'number' && (
              <div className="flex items-center justify-between gap-2">
                <span>MACD:</span>
                <span className="flex items-center gap-1">
                  <span className={`font-mono font-semibold ${macdColor}`}>{macd.toFixed(2)}</span>
                  {macdTag && <span className={`text-[9px] px-1 rounded ${macdDiff! > 0 ?'bg-emerald-500/20 text-emerald-300':'bg-rose-500/20 text-rose-300'}`}>{macdTag}</span>}
                </span>
              </div>
            )}
          </div>
        )}

        {d.sectorName && d.sectorColor && (
          <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: String(d.sectorColor) }} />
            <span className="text-slate-500">{d.sectorName}</span>
          </div>
        )}
      </div>
    </div>
  );
};

type SizeMode  = 'marketcap' | 'volume' | 'equal';
type GroupMode = 'sector' | 'flat';

export default function MarketHeatmap({ data, watchlists, onTickerClick }: Props) {
  const [sizeMode,  setSizeMode]  = useState<SizeMode>('marketcap');
  const [groupMode, setGroupMode] = useState<GroupMode>('sector');

  const validData = useMemo(() => data.filter(d => !d.error && d.price > 0), [data]);

  // Derive sector lookup from user's watchlists
  const { sectorMap, sectorColorMap } = useMemo(() => {
    const sMap:  Record<string, string> = {};
    const cMap:  Record<string, string> = {};
    watchlists.filter(w => w.id !== MASTER_ID).forEach((w, idx) => {
      cMap[w.name] = PALETTE[idx % PALETTE.length];
      w.tickers.forEach(t => { sMap[t.toUpperCase()] = w.name; });
    });
    return { sectorMap: sMap, sectorColorMap: cMap };
  }, [watchlists]);

  const getSector      = useCallback((t: string) => sectorMap[t.toUpperCase()] ?? 'Khác', [sectorMap]);
  const getSectorColor = useCallback((s: string) => sectorColorMap[s] ?? '#64748b',       [sectorColorMap]);

  const getSize = useCallback((d: StockIndicatorResult): number => {
    if (sizeMode === 'marketcap' && d.marketCap) return d.marketCap;
    if (sizeMode === 'volume'    && d.volume)    return d.volume;
    return 1;
  }, [sizeMode]);

  const stats = useMemo(() => {
    const w = validData.filter(d => d.changePct != null);
    const gainers = w.filter(d => (d.changePct ?? 0) > 0).length;
    const losers  = w.filter(d => (d.changePct ?? 0) < 0).length;
    const avgPct  = w.length ? w.reduce((s, d) => s + (d.changePct ?? 0), 0) / w.length : null;
    const sorted  = [...w].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
    return { gainers, losers, neutral: w.length - gainers - losers, avgPct,
             topGainer: sorted[0], topLoser: sorted[sorted.length - 1] };
  }, [validData]);

  const treeData = useMemo((): TreeNode[] => {
    if (groupMode === 'sector') {
      const sectors: Record<string, StockIndicatorResult[]> = {};
      validData.forEach(d => {
        const s = getSector(d.ticker);
        (sectors[s] = sectors[s] ?? []).push(d);
      });
      return Object.entries(sectors)
        .map(([sector, items]) => ({
          name: sector, size: items.reduce((s, d) => s + getSize(d), 0),
          sectorColor: getSectorColor(sector),
          children: items.map(d => ({
            name: d.ticker, ticker: d.ticker, sectorName: sector,
            changePct: d.changePct ?? undefined, price: d.price,
            marketCap: d.marketCap ?? undefined, volume: d.volume,
            rsi: d.rsi ?? undefined, macd: d.macd ?? undefined, macdSignal: d.macdSignal ?? undefined,
            sectorColor: getSectorColor(sector), size: getSize(d),
          })),
        }))
        .sort((a, b) => b.size - a.size);
    }
    return validData.map(d => ({
      name: d.ticker, ticker: d.ticker, sectorName: getSector(d.ticker),
      changePct: d.changePct ?? undefined, price: d.price,
      marketCap: d.marketCap ?? undefined, volume: d.volume,
      rsi: d.rsi ?? undefined, macd: d.macd ?? undefined, macdSignal: d.macdSignal ?? undefined,
      sectorColor: getSectorColor(getSector(d.ticker)), size: getSize(d),
    }));
  }, [validData, groupMode, getSize, getSector, getSectorColor]);

  const activeSectors = useMemo(() => {
    const names = new Set(validData.map(d => getSector(d.ticker)));
    const result = watchlists
      .filter(w => w.id !== MASTER_ID && names.has(w.name))
      .map((w, idx) => ({
        name: w.name, color: PALETTE[idx % PALETTE.length],
        count: validData.filter(d => getSector(d.ticker) === w.name).length,
      }));
    if (names.has('Khác'))
      result.push({ name: 'Khác', color: '#64748b', count: validData.filter(d => getSector(d.ticker) === 'Khác').length });
    return result;
  }, [validData, watchlists, getSector]);

  if (validData.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <LayoutGrid size={36} className="mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400">Chưa có dữ liệu. Nhấn Refresh để tải.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><TrendingUp size={14}/>{stats.gainers} tăng</span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5 text-rose-400 font-semibold"><TrendingDown size={14}/>{stats.losers} giảm</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-500 text-xs">{stats.neutral} đứng</span>
        </div>
        {stats.avgPct != null && (
          <div className="text-xs text-slate-400">
            TB: <span className={`font-mono font-semibold ${stats.avgPct>0?'text-emerald-400':stats.avgPct<0?'text-rose-400':'text-slate-400'}`}>
              {stats.avgPct>0?'+':''}{stats.avgPct.toFixed(2)}%
            </span>
          </div>
        )}
        {stats.topGainer && (
          <span className="text-xs text-slate-500">🏆 <span className="text-slate-300 font-semibold">{stats.topGainer.ticker}</span> <span className="text-emerald-400 font-mono">+{stats.topGainer.changePct?.toFixed(2)}%</span></span>
        )}
        {stats.topLoser && (
          <span className="text-xs text-slate-500">📉 <span className="text-slate-300 font-semibold">{stats.topLoser.ticker}</span> <span className="text-rose-400 font-mono">{stats.topLoser.changePct?.toFixed(2)}%</span></span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs">
            <button onClick={() => setGroupMode('sector')} className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${groupMode==='sector'?'bg-blue-500/20 text-blue-300':'text-slate-400 hover:bg-slate-700'}`}>
              <LayoutGrid size={11}/> Danh mục
            </button>
            <button onClick={() => setGroupMode('flat')} className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${groupMode==='flat'?'bg-blue-500/20 text-blue-300':'text-slate-400 hover:bg-slate-700'}`}>
              <List size={11}/> Flat
            </button>
          </div>
          <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs">
            {(['equal','marketcap','volume'] as SizeMode[]).map(m => (
              <button key={m} onClick={() => setSizeMode(m)} className={`px-2.5 py-1.5 transition-colors ${sizeMode===m?'bg-violet-500/20 text-violet-300':'text-slate-400 hover:bg-slate-700'}`}>
                {m==='marketcap'?'Vốn hóa':m==='volume'?'Volume':'Đều'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Treemap */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        {groupMode === 'sector' && activeSectors.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pt-3 pb-2 border-b border-slate-800">
            {activeSectors.map(s => (
              <div key={s.name} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                {s.name} <span className="text-slate-600">({s.count})</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 620 }} className="p-1">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap data={treeData} dataKey="size" nameKey="name" isAnimationActive={false}
              content={(props) => {
                const p = props as unknown as TreeNode & { x?: number; y?: number; width?: number; height?: number };
                if (!p.ticker) {
                  const w = p.width ?? 0; const h = p.height ?? 0;
                  if (w < 40 || h < 18) return <g />;
                  return (
                    <g>
                      <rect x={(p.x??0)+1} y={(p.y??0)+1} width={w-2} height={h-2} rx={6}
                        fill="#0f172a" fillOpacity={0.5}
                        stroke={String(p.sectorColor ?? '#334155')} strokeWidth={1.5} strokeOpacity={0.6} />
                      {h > 24 && (
                        <text x={(p.x??0)+8} y={(p.y??0)+14}
                          fill={String(p.sectorColor ?? '#64748b')} fontSize={10} fontWeight="700"
                          style={{ pointerEvents:'none', letterSpacing:'0.05em' }}>
                          {p.name}
                        </text>
                      )}
                    </g>
                  );
                }
                return (
                  <CustomCell x={p.x} y={p.y} width={p.width} height={p.height}
                    name={p.name} ticker={String(p.ticker)}
                    changePct={typeof p.changePct === 'number' ? p.changePct : undefined}
                    price={typeof p.price === 'number' ? p.price : undefined}
                    sectorColor={typeof p.sectorColor === 'string' ? p.sectorColor : undefined}
                    onTickerClick={onTickerClick} />
                );
              }}>
              <Tooltip content={<HeatTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-1 flex-wrap">
          <span className="text-[10px] text-slate-600">% thay đổi:</span>
          {([
            { label:'>+6%',   bg:'#14532d', tc:'#bbf7d0' },
            { label:'+3→6%',  bg:'#15803d', tc:'#bbf7d0' },
            { label:'0→+3%',  bg:'#16a34a', tc:'#bbf7d0' },
            { label:'~0%',    bg:'#1e293b', tc:'#94a3b8' },
            { label:'0→-3%',  bg:'#b91c1c', tc:'#fecaca' },
            { label:'-3→-6%', bg:'#dc2626', tc:'#fecaca' },
            { label:'<-6%',   bg:'#991b1b', tc:'#fecaca' },
          ]).map(({ label, bg, tc }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="w-6 h-3 rounded-sm" style={{ backgroundColor: bg }} />
              <span className="text-[9px]" style={{ color: tc }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
