'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  Activity, BarChart2, Zap,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip as ReTooltip,
} from 'recharts';
import type { MarketOverviewResult, IndexData, MoverStock, BreadthData } from '@/app/api/market-overview/route';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtPct = (v: number | null, signed = true) =>
  v == null ? '—' : `${signed && v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const fmtPrice = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

const fmtVol = (v: number | null) => {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
};

const pctColor = (v: number | null) =>
  v == null ? 'text-slate-400' : v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-400';

const pctBg = (v: number | null) =>
  v == null ? 'bg-slate-700/40 border-slate-600/30'
  : v > 0   ? 'bg-emerald-500/15 border-emerald-500/30'
  :           'bg-rose-500/15    border-rose-500/30';

// ─── Mini sparkline for index ──────────────────────────────────────────────────
function IndexSparkline({ closes, positive }: { closes: number[]; positive: boolean }) {
  if (closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const data = closes.map((v, i) => ({ i, v }));
  const color = positive ? '#10b981' : '#f43f5e';
  return (
    <div style={{ width: 90, height: 36 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <YAxis domain={[min * 0.998, max * 1.002]} hide />
          <XAxis dataKey="i" hide />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
            fill={`url(#sg-${positive})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Index card ────────────────────────────────────────────────────────────────
function IndexCard({ idx }: { idx: IndexData }) {
  const pos = (idx.changePct ?? 0) >= 0;
  const Icon = pos ? TrendingUp : TrendingDown;
  const iconColor = pos ? 'text-emerald-400' : 'text-rose-400';
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={iconColor} />
          <span className="text-xs font-semibold text-slate-300">{idx.name}</span>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${pctBg(idx.changePct)} ${pctColor(idx.changePct)}`}>
          YTD {fmtPct(idx.ytdPct)}
        </span>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {fmtPrice(idx.price)}
          </div>
          <div className={`text-sm font-semibold font-mono mt-0.5 ${pctColor(idx.changePct)}`}>
            {idx.change != null && idx.change >= 0 ? '+' : ''}{fmtPrice(idx.change)} ({fmtPct(idx.changePct)})
          </div>
        </div>
        <IndexSparkline closes={idx.closes30d} positive={pos} />
      </div>

      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-700/50">
        {[
          { label: 'Mở', value: fmtPrice(idx.open)  },
          { label: 'Cao', value: fmtPrice(idx.high)  },
          { label: 'Thấp', value: fmtPrice(idx.low)  },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
            <div className="text-xs font-mono text-slate-300">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mover row ─────────────────────────────────────────────────────────────────
function MoverRow({
  stock, rank, type, onTickerClick,
}: {
  stock: MoverStock; rank: number; type: 'gain' | 'lose';
  onTickerClick?: (t: string) => void;
}) {
  const isGain = type === 'gain';
  const color  = isGain ? 'text-emerald-400' : 'text-rose-400';
  const bg     = isGain ? 'bg-emerald-500/10' : 'bg-rose-500/10';
  const barColor = isGain ? 'bg-emerald-500/60' : 'bg-rose-500/60';
  const barWidth = Math.min(Math.abs(stock.changePct) * 12, 100);

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer"
      onClick={() => onTickerClick?.(stock.ticker)}
    >
      <span className="text-[10px] text-slate-600 w-4 text-right shrink-0">{rank}</span>
      <div className="w-14 shrink-0">
        <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${bg} ${color}`}>
          {stock.ticker}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-300">{fmtPrice(stock.price)}</span>
          <span className={`text-xs font-bold font-mono ${color}`}>{fmtPct(stock.changePct)}</span>
        </div>
        <div className="h-1 bg-slate-700/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-slate-500 w-12 text-right shrink-0">{fmtVol(stock.volume)}</span>
    </div>
  );
}

// ─── Breadth bar ───────────────────────────────────────────────────────────────
function BreadthBar({ breadth }: { breadth: BreadthData }) {
  const adv = breadth.total > 0 ? (breadth.advance   / breadth.total) * 100 : 0;
  const dec = breadth.total > 0 ? (breadth.decline   / breadth.total) * 100 : 0;
  const unc = breadth.total > 0 ? (breadth.unchanged / breadth.total) * 100 : 0;

  const label = breadth.advanceRatio >= 60 ? 'Thị trường tích cực'
    : breadth.advanceRatio <= 40           ? 'Thị trường tiêu cực'
    :                                        'Thị trường trung tính';
  const labelColor = breadth.advanceRatio >= 60 ? 'text-emerald-400'
    : breadth.advanceRatio <= 40               ? 'text-rose-400'
    :                                            'text-slate-400';

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Activity size={13} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-300">Market Breadth</span>
        <span className="ml-auto text-[10px] text-slate-500">{breadth.total} cổ phiếu</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xl font-bold font-mono ${labelColor}`}>
          {breadth.advanceRatio.toFixed(0)}%
        </span>
        <span className={`text-xs ${labelColor}`}>{label}</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        <div className="bg-emerald-500/70 transition-all" style={{ width: `${adv}%` }} />
        <div className="bg-slate-600/60 transition-all"   style={{ width: `${unc}%` }} />
        <div className="bg-rose-500/70 transition-all"    style={{ width: `${dec}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-1">
        {[
          { label: 'Tăng',    value: breadth.advance,   color: 'text-emerald-400', dot: 'bg-emerald-500' },
          { label: 'Không đổi', value: breadth.unchanged, color: 'text-slate-400', dot: 'bg-slate-600'  },
          { label: 'Giảm',   value: breadth.decline,   color: 'text-rose-400',    dot: 'bg-rose-500'    },
        ].map(({ label, value, color, dot }) => (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
            <span className={`text-sm font-bold font-mono ${color}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
interface Props {
  onTickerClick?: (ticker: string) => void;
}

export default function MarketOverview({ onTickerClick }: Props) {
  const [data,    setData]    = useState<MarketOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/market-overview');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MarketOverviewResult = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} className="text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">Tổng quan thị trường</span>
          {lastUpdated && (
            <span className="text-[10px] text-slate-500">
              · Cập nhật {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-700 transition-colors border border-transparent hover:border-slate-600 disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          Lỗi: {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 h-32 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Index cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.indices.map(idx => <IndexCard key={idx.symbol} idx={idx} />)}
          </div>

          {/* Movers + Breadth */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Top Gainers */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <TrendingUp size={13} className="text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300">Top tăng</span>
                <span className="ml-auto text-[10px] text-slate-500">Giá / Vol</span>
              </div>
              {data.topGainers.length === 0 ? (
                <div className="text-xs text-slate-500 px-3 py-4 text-center">Không có dữ liệu</div>
              ) : (
                data.topGainers.map((s, i) => (
                  <MoverRow key={s.ticker} stock={s} rank={i + 1} type="gain" onTickerClick={onTickerClick} />
                ))
              )}
            </div>

            {/* Top Losers */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <TrendingDown size={13} className="text-rose-400" />
                <span className="text-xs font-semibold text-slate-300">Top giảm</span>
                <span className="ml-auto text-[10px] text-slate-500">Giá / Vol</span>
              </div>
              {data.topLosers.length === 0 ? (
                <div className="text-xs text-slate-500 px-3 py-4 text-center">Không có dữ liệu</div>
              ) : (
                data.topLosers.map((s, i) => (
                  <MoverRow key={s.ticker} stock={s} rank={i + 1} type="lose" onTickerClick={onTickerClick} />
                ))
              )}
            </div>

            {/* Breadth */}
            <div className="flex flex-col gap-3">
              <BreadthBar breadth={data.breadth} />

              {/* Quick stats */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 grid grid-cols-2 gap-2">
                {[
                  { label: 'VN-Index vol', value: fmtVol(data.indices[0]?.volume), icon: <Zap size={11} className="text-blue-400" /> },
                  { label: 'A/D ratio',    value: data.breadth.decline > 0 ? (data.breadth.advance / data.breadth.decline).toFixed(2) : '∞', icon: <Activity size={11} className="text-slate-400" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      {icon}
                      <span className="text-[10px] text-slate-500">{label}</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-slate-200">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
