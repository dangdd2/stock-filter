'use client';

import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Trophy, TrendingUp, TrendingDown, Minus, BarChart2, Activity, Table2, LineChart } from 'lucide-react';
import {
  ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis,
  Tooltip as ReTooltip, Legend as ReLegend, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import type { CompareResult, CompareTickerData } from '@/app/api/compare/route';

// ─── Constants ─────────────────────────────────────────────────────────────────
const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];
const SIGNAL_CFG = {
  strong_buy:  { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: '● Mua mạnh' },
  buy:         { cls: 'bg-green-500/15 text-green-300 border-green-500/30',       label: '▲ Mua'     },
  neutral:     { cls: 'bg-slate-600/40 text-slate-300 border-slate-500/30',       label: '— Trung lập' },
  sell:        { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30',    label: '▼ Bán'    },
  strong_sell: { cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40',          label: '● Bán mạnh' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number | null, dec = 2, suffix = '') =>
  v == null ? '—' : `${v.toFixed(dec)}${suffix}`;
const fmtPct = (v: number | null) =>
  v == null ? '—' : <span className={v >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>;
const fmtPrice = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

// ─── Signal Badge ──────────────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: CompareTickerData['signal'] }) {
  const c = SIGNAL_CFG[signal];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${c.cls}`}>{c.label}</span>;
}

// ─── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score, color }: { score: number; color: string }) {
  const pct = ((score + 6) / 12) * 100;
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
        <span>-6</span>
        <span className="font-bold" style={{ color }}>{score > 0 ? `+${score}` : score}</span>
        <span>+6</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Gauge (semicircle) ────────────────────────────────────────────────────────
function Gauge({ value, min, max, label, color }: { value: number | null; min: number; max: number; label: string; color: string }) {
  if (value == null) return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-8 flex items-center justify-center text-slate-500 text-lg font-bold">—</div>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -180 + pct * 180; // -180 (left) → 0 (right)
  const rad = (angle * Math.PI) / 180;
  const r = 28, cx = 32, cy = 32;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);
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

// ─── Overview Card ─────────────────────────────────────────────────────────────
function OverviewCard({ data, color, isWinner }: { data: CompareTickerData; color: string; isWinner: boolean }) {
  return (
    <div className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col gap-3 relative ${isWinner ? 'border-yellow-500/50' : 'border-slate-700/60'}`}>
      {isWinner && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
          <Trophy size={9} /> Tốt nhất
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-2xl font-black font-mono" style={{ color }}>{data.ticker}</span>
        <SignalBadge signal={data.signal} />
      </div>
      {data.error && <div className="text-xs text-rose-400">⚠ {data.error}</div>}

      {/* Price */}
      <div>
        <div className="text-xl font-bold text-slate-100 font-mono">{fmtPrice(data.price)}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          <span className={data.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {data.change1d >= 0 ? '+' : ''}{data.change1d.toFixed(2)}% hôm nay
          </span>
        </div>
      </div>

      {/* Score */}
      <ScoreBar score={data.score} color={color} />

      {/* Changes table */}
      <div className="grid grid-cols-3 gap-1 text-center">
        {[['1T', data.change1w], ['1M', data.change1m], ['3M', data.change3m], ['6M', data.change6m]].map(([label, val]) => (
          <div key={String(label)} className="bg-slate-700/40 rounded-lg px-1 py-1.5">
            <div className="text-[9px] text-slate-500 mb-0.5">{label}</div>
            <div className={`text-xs font-bold font-mono ${(val as number) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(val as number) >= 0 ? '+' : ''}{(val as number).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* 52w range */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Đáy 52T: {fmtPrice(data.low52w)}</span>
          <span>Đỉnh 52T: {fmtPrice(data.high52w)}</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.max(2, ((data.price - data.low52w) / (data.high52w - data.low52w)) * 100).toFixed(0)}%`, background: color }} />
        </div>
        <div className="text-[10px] text-slate-500 mt-1 text-center">{Math.max(0, ((data.price - data.low52w) / (data.high52w - data.low52w)) * 100).toFixed(0)}% từ đáy 52 tuần</div>
      </div>

      {/* Trend */}
      <div className="flex gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${data.trendVsSma20 === 'above' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
          {data.trendVsSma20 === 'above' ? '↑' : '↓'} SMA20
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${data.trendVsSma50 === 'above' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
          {data.trendVsSma50 === 'above' ? '↑' : '↓'} SMA50
        </span>
      </div>
    </div>
  );
}

// ─── Normalised Price Chart ────────────────────────────────────────────────────
function PriceChart({ dataArr }: { dataArr: CompareTickerData[] }) {
  const valid = dataArr.filter(d => d.normalizedCloses.length > 10);
  if (!valid.length) return null;

  const maxLen = Math.max(...valid.map(d => d.normalizedCloses.length));
  // Downsample to ~120 pts for perf
  const step = Math.max(1, Math.floor(maxLen / 120));
  const points: Record<string, number | string>[] = [];
  for (let i = 0; i < maxLen; i += step) {
    const pt: Record<string, number | string> = { i };
    valid.forEach(d => {
      const idx = Math.min(i, d.normalizedCloses.length - 1);
      if (d.normalizedCloses[idx] != null) pt[d.ticker] = +d.normalizedCloses[idx].toFixed(2);
    });
    points.push(pt);
  }

  return (
    <div>
      <div className="text-xs text-slate-500 mb-3">Hiệu suất chuẩn hóa (100 = điểm bắt đầu 1 năm trước)</div>
      <ResponsiveContainer width="100%" height={260}>
        <ReLineChart data={points} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="i" tick={false} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} width={40}
            tickFormatter={v => `${v.toFixed(0)}`} />
          <ReTooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelFormatter={() => ''}
            formatter={(v: unknown, name: unknown) => [`${(v as number).toFixed(2)} (norm)`, String(name)]}
          />
          <ReLegend wrapperStyle={{ fontSize: 11 }} />
          {valid.map((d, i) => (
            <Line key={d.ticker} type="monotone" dataKey={d.ticker} stroke={COLORS[i % COLORS.length]}
              dot={false} strokeWidth={2} />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Volume Bar Chart ──────────────────────────────────────────────────────────
function VolumeChart({ dataArr }: { dataArr: CompareTickerData[] }) {
  const chartData = dataArr.map((d, i) => ({
    ticker: d.ticker,
    volume: Math.round(d.avgVolume20d / 1000),
    fill: COLORS[i % COLORS.length],
  }));
  return (
    <div>
      <div className="text-xs text-slate-500 mb-3">Khối lượng giao dịch trung bình 20 ngày (nghìn cp)</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="ticker" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={48} tickFormatter={v => `${v}K`} />
          <ReTooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(v: unknown) => [`${(v as number).toLocaleString()}K cổ phiếu`, 'Khối lượng']}
          />
          <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <rect key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Indicators Panel ──────────────────────────────────────────────────────────
function IndicatorsPanel({ dataArr }: { dataArr: CompareTickerData[] }) {
  return (
    <div className="space-y-6">
      {/* Gauges row */}
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-3">Chỉ số kỹ thuật chính</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 pr-4 text-xs text-slate-500 font-medium w-36">Chỉ số</th>
                {dataArr.map((d, i) => (
                  <th key={d.ticker} className="text-center py-2 px-3 text-xs font-bold" style={{ color: COLORS[i] }}>{d.ticker}</th>
                ))}
                <th className="text-left py-2 pl-4 text-xs text-slate-500 font-medium">Tốt nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {[
                {
                  label: 'RSI (14)', vals: dataArr.map(d => d.rsi14), fmt: (v: number | null) => fmt(v, 1),
                  best: (vals: (number | null)[]) => {
                    const filtered = vals.map((v, i) => ({ v, i })).filter(x => x.v != null);
                    const oversold = filtered.filter(x => x.v! < 40);
                    if (oversold.length) return oversold.reduce((a, b) => a.v! < b.v! ? a : b).i;
                    return filtered.length ? filtered.reduce((a, b) => Math.abs(50 - a.v!) < Math.abs(50 - b.v!) ? a : b).i : -1;
                  },
                  color: (v: number | null) => v == null ? '' : v < 30 ? 'text-emerald-400' : v > 70 ? 'text-rose-400' : 'text-slate-300',
                },
                {
                  label: 'Stoch K', vals: dataArr.map(d => d.stochK), fmt: (v: number | null) => fmt(v, 1),
                  best: (vals: (number | null)[]) => { const f = vals.map((v, i) => ({ v, i })).filter(x => x.v != null); return f.length ? f.reduce((a, b) => Math.abs(50 - a.v!) < Math.abs(50 - b.v!) ? a : b).i : -1; },
                  color: (v: number | null) => v == null ? '' : v < 20 ? 'text-emerald-400' : v > 80 ? 'text-rose-400' : 'text-slate-300',
                },
                {
                  label: 'MACD Hist', vals: dataArr.map(d => d.macdHistogram), fmt: (v: number | null) => fmt(v, 3),
                  best: (vals: (number | null)[]) => { const f = vals.map((v, i) => ({ v, i })).filter(x => x.v != null); return f.length ? f.reduce((a, b) => a.v! > b.v! ? a : b).i : -1; },
                  color: (v: number | null) => v == null ? '' : v > 0 ? 'text-emerald-400' : 'text-rose-400',
                },
                {
                  label: 'BB Width %', vals: dataArr.map(d => d.bbWidth), fmt: (v: number | null) => fmt(v, 1, '%'),
                  best: () => -1,
                  color: () => 'text-slate-300',
                },
                {
                  label: 'ATR (14)', vals: dataArr.map(d => d.atr14), fmt: (v: number | null) => fmt(v, 0),
                  best: () => -1,
                  color: () => 'text-slate-300',
                },
                {
                  label: 'Thay đổi 1M', vals: dataArr.map(d => d.change1m), fmt: (v: number | null) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
                  best: (vals: (number | null)[]) => { const f = vals.map((v, i) => ({ v, i })).filter(x => x.v != null); return f.length ? f.reduce((a, b) => a.v! > b.v! ? a : b).i : -1; },
                  color: (v: number | null) => v == null ? '' : v >= 0 ? 'text-emerald-400' : 'text-rose-400',
                },
                {
                  label: 'Thay đổi 3M', vals: dataArr.map(d => d.change3m), fmt: (v: number | null) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
                  best: (vals: (number | null)[]) => { const f = vals.map((v, i) => ({ v, i })).filter(x => x.v != null); return f.length ? f.reduce((a, b) => a.v! > b.v! ? a : b).i : -1; },
                  color: (v: number | null) => v == null ? '' : v >= 0 ? 'text-emerald-400' : 'text-rose-400',
                },
                {
                  label: 'vs 52T Đỉnh', vals: dataArr.map(d => d.distFromHigh), fmt: (v: number | null) => v == null ? '—' : `${v.toFixed(1)}%`,
                  best: (vals: (number | null)[]) => { const f = vals.map((v, i) => ({ v, i })).filter(x => x.v != null); return f.length ? f.reduce((a, b) => a.v! > b.v! ? a : b).i : -1; },
                  color: (v: number | null) => v == null ? '' : v > -5 ? 'text-emerald-400' : v < -20 ? 'text-rose-400' : 'text-slate-300',
                },
              ].map(({ label, vals, fmt: fmtFn, best, color }) => {
                const bestIdx = best(vals);
                return (
                  <tr key={label}>
                    <td className="py-2 pr-4 text-xs text-slate-500 font-medium">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`py-2 px-3 text-center text-xs font-mono font-semibold ${color(v)}`}>
                        {fmtFn(v)}
                      </td>
                    ))}
                    <td className="py-2 pl-4 text-xs font-bold" style={{ color: bestIdx >= 0 ? COLORS[bestIdx] : '#64748b' }}>
                      {bestIdx >= 0 ? `${dataArr[bestIdx].ticker} ✓` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gauges */}
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-3">So sánh RSI trực quan</div>
        <div className="flex gap-8 flex-wrap">
          {dataArr.map((d, i) => (
            <div key={d.ticker} className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold font-mono" style={{ color: COLORS[i] }}>{d.ticker}</span>
              <Gauge value={d.rsi14} min={0} max={100} label="RSI" color={COLORS[i]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Table View ────────────────────────────────────────────────────────────────
function TablePanel({ dataArr }: { dataArr: CompareTickerData[] }) {
  const rows: { label: string; vals: (string | React.ReactNode)[] }[] = [
    { label: 'Giá hiện tại',   vals: dataArr.map(d => <span className="font-mono font-bold text-slate-200">{fmtPrice(d.price)}</span>) },
    { label: 'Thay đổi 1 ngày', vals: dataArr.map(d => fmtPct(d.change1d)) },
    { label: 'Thay đổi 1 tuần', vals: dataArr.map(d => fmtPct(d.change1w)) },
    { label: 'Thay đổi 1 tháng', vals: dataArr.map(d => fmtPct(d.change1m)) },
    { label: 'Thay đổi 3 tháng', vals: dataArr.map(d => fmtPct(d.change3m)) },
    { label: 'Thay đổi 6 tháng', vals: dataArr.map(d => fmtPct(d.change6m)) },
    { label: '52T Đỉnh',        vals: dataArr.map(d => fmtPrice(d.high52w)) },
    { label: '52T Đáy',         vals: dataArr.map(d => fmtPrice(d.low52w)) },
    { label: 'Cách đỉnh 52T',   vals: dataArr.map(d => fmtPct(d.distFromHigh)) },
    { label: 'KL TB 20 ngày',   vals: dataArr.map(d => `${(d.avgVolume20d / 1e6).toFixed(2)}M`) },
    { label: 'RSI(14)',         vals: dataArr.map(d => <span className={d.rsiZone === 'oversold' ? 'text-emerald-400' : d.rsiZone === 'overbought' ? 'text-rose-400' : 'text-slate-300'}>{fmt(d.rsi14, 1)}</span>) },
    { label: 'Stoch K',         vals: dataArr.map(d => <span className={d.stochZone === 'oversold' ? 'text-emerald-400' : d.stochZone === 'overbought' ? 'text-rose-400' : 'text-slate-300'}>{fmt(d.stochK, 1)}</span>) },
    { label: 'MACD Hist',       vals: dataArr.map(d => <span className={d.macdTrend === 'bullish' ? 'text-emerald-400' : d.macdTrend === 'bearish' ? 'text-rose-400' : 'text-slate-300'}>{fmt(d.macdHistogram, 3)}</span>) },
    { label: 'BB Width',        vals: dataArr.map(d => fmt(d.bbWidth, 1, '%')) },
    { label: 'ATR(14)',         vals: dataArr.map(d => fmt(d.atr14, 0)) },
    { label: 'SMA 20',         vals: dataArr.map(d => fmt(d.sma20, 0)) },
    { label: 'SMA 50',         vals: dataArr.map(d => fmt(d.sma50, 0)) },
    { label: 'vs SMA20',        vals: dataArr.map(d => <span className={d.trendVsSma20 === 'above' ? 'text-emerald-400' : 'text-rose-400'}>{d.trendVsSma20 === 'above' ? '↑ Trên' : '↓ Dưới'}</span>) },
    { label: 'vs SMA50',        vals: dataArr.map(d => <span className={d.trendVsSma50 === 'above' ? 'text-emerald-400' : 'text-rose-400'}>{d.trendVsSma50 === 'above' ? '↑ Trên' : '↓ Dưới'}</span>) },
    { label: 'Điểm tổng',       vals: dataArr.map((d, i) => <span className="font-bold font-mono" style={{ color: COLORS[i] }}>{d.score > 0 ? '+' : ''}{d.score}</span>) },
    { label: 'Tín hiệu',        vals: dataArr.map(d => <SignalBadge signal={d.signal} />) },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2.5 pr-6 text-xs text-slate-500 font-medium">Chỉ tiêu</th>
            {dataArr.map((d, i) => (
              <th key={d.ticker} className="text-center py-2.5 px-4 text-sm font-black" style={{ color: COLORS[i] }}>{d.ticker}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {rows.map(({ label, vals }) => (
            <tr key={label} className="hover:bg-slate-800/30 transition-colors">
              <td className="py-2 pr-6 text-xs text-slate-500 whitespace-nowrap">{label}</td>
              {vals.map((v, i) => (
                <td key={i} className="py-2 px-4 text-center text-xs font-mono font-semibold text-slate-300">{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Winner Banner ─────────────────────────────────────────────────────────────
function WinnerBanner({ winner, data }: { winner: string | null; data: CompareTickerData[] }) {
  if (!winner) return null;
  const d = data.find(x => x.ticker === winner);
  if (!d) return null;
  const idx = data.findIndex(x => x.ticker === winner);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
      <Trophy size={16} />
      <span className="text-sm font-bold">{winner}</span>
      <span className="text-sm">có điểm kỹ thuật tốt nhất</span>
      <SignalBadge signal={d.signal} />
      <span className="ml-auto font-mono text-xs font-bold" style={{ color: COLORS[idx] }}>
        Score: {d.score > 0 ? '+' : ''}{d.score}
      </span>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────
interface Props {
  tickers: string[];
  onTickerClick?: (ticker: string) => void;
}

type ViewTab = 'overview' | 'chart' | 'indicators' | 'table';

export default function ComparisonTool({ tickers: watchlistTickers, onTickerClick }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>('overview');

  useEffect(() => {
    if (watchlistTickers.length >= 2 && selected.length === 0) {
      setSelected(watchlistTickers.slice(0, 2));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistTickers]);

  const fetch = useCallback(async (tickers: string[]) => {
    if (tickers.length < 2) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await window.fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected.length >= 2) {
      const t = setTimeout(() => fetch(selected), 300);
      return () => clearTimeout(t);
    } else {
      setResult(null);
    }
  }, [fetch, selected]);

  const add = (t: string) => {
    const c = t.trim().toUpperCase();
    if (!c || selected.includes(c) || selected.length >= 3) return;
    setSelected(p => [...p, c]);
    setInput('');
  };
  const remove = (t: string) => setSelected(p => p.filter(x => x !== t));

  const VIEWS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',    label: 'Tổng quan',   icon: <Activity size={13} /> },
    { id: 'chart',       label: 'Biểu đồ',     icon: <LineChart size={13} /> },
    { id: 'indicators',  label: 'Chỉ số',      icon: <BarChart2 size={13} /> },
    { id: 'table',       label: 'Bảng đầy đủ', icon: <Table2 size={13} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-100">Comparison Tool</h2>
          <p className="text-xs text-slate-500 mt-0.5">So sánh 2–3 cổ phiếu side-by-side — giá, chỉ số kỹ thuật, hiệu suất</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && add(input)}
            placeholder="Thêm mã (VD: VNM)"
            className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36"
          />
          <button onClick={() => add(input)}
            className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-lg text-sm hover:bg-blue-500/30 transition-colors">
            + Thêm
          </button>
          <button onClick={() => fetch(selected)} disabled={loading || selected.length < 2}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors disabled:opacity-40">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Watchlist quick-pick */}
      {watchlistTickers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-slate-500 mr-1">Watchlist:</span>
          {watchlistTickers.map(t => (
            <button key={t} onClick={() => selected.includes(t) ? remove(t) : add(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
                selected.includes(t) ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-600/60'
              }`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Selected chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {selected.map((t, i) => (
          <span key={t} className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-mono font-bold"
            style={{ background: `${COLORS[i]}15`, borderColor: `${COLORS[i]}50`, color: COLORS[i] }}>
            {t}
            <button onClick={() => remove(t)} className="opacity-50 hover:opacity-100 transition-opacity">×</button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-xs text-slate-500">Chọn 2–3 mã cổ phiếu để so sánh</span>}
        {selected.length === 1 && <span className="text-xs text-slate-500 italic">Thêm ít nhất 1 mã nữa…</span>}
        {selected.length >= 3 && <span className="text-xs text-slate-500">(tối đa 3 mã)</span>}
      </div>

      {/* Trend icons when 2+ selected */}
      {selected.length >= 2 && !loading && !result && (
        <div className="flex items-center justify-center gap-4 py-4 text-slate-500 text-sm">
          {selected.map((t, i) => (
            <span key={t} className="font-mono font-bold" style={{ color: COLORS[i] }}>{t}</span>
          )).reduce<React.ReactNode[]>((acc, el, i) => [
            ...acc,
            ...(i > 0 ? [<span key={`vs-${i}`} className="text-slate-600 font-light">vs</span>] : []),
            el,
          ], [])}
        </div>
      )}

      {/* Error */}
      {error && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2">⚠ {error}</div>}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Đang tải dữ liệu so sánh…</span>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          <WinnerBanner winner={result.winner} data={result.data} />

          {/* View tabs */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700 w-fit text-xs">
            {VIEWS.map(v => (
              <button key={v.id} onClick={() => setViewTab(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${viewTab === v.id ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-700'}`}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {viewTab === 'overview' && (
            <div className={`grid gap-4 ${result.data.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
              {result.data.map((d, i) => (
                <div key={d.ticker} onClick={() => !d.error && onTickerClick?.(d.ticker)} className={!d.error ? 'cursor-pointer' : ''}>
                  <OverviewCard data={d} color={COLORS[i]} isWinner={result.winner === d.ticker} />
                </div>
              ))}
            </div>
          )}

          {/* ── Chart ── */}
          {viewTab === 'chart' && (
            <div className="space-y-6">
              <PriceChart dataArr={result.data} />
              <VolumeChart dataArr={result.data} />
            </div>
          )}

          {/* ── Indicators ── */}
          {viewTab === 'indicators' && <IndicatorsPanel dataArr={result.data} />}

          {/* ── Table ── */}
          {viewTab === 'table' && <TablePanel dataArr={result.data} />}
        </div>
      )}
    </div>
  );
}
