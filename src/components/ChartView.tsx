"use client";

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, BarChart2 } from 'lucide-react';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, ReferenceLine, Cell, Area,
  useXAxisScale, useYAxisScale,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChartDataPoint {
  time: number; open: number; high: number; low: number; close: number;
  dateStr: string; ohlc: [number, number];
  rsi?: number; macd?: number; macdSignal?: number; macdHistogram?: number;
  stochK?: number; stochD?: number;
  ma20?: number; ma50?: number;
  volume?: number; volumeMa?: number;
  bbUpper?: number | null; bbMiddle?: number | null; bbLower?: number | null;
}

// ─── Custom renderers ─────────────────────────────────────────────────────────
const CandleBody = ({
  x, y, width, height, payload,
}: {
  x?: number; y?: number; width?: number; height?: number; payload?: ChartDataPoint;
}) => {
  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) return null;
  const color = payload.close >= payload.open ? '#10b981' : '#f43f5e';
  const gap = Math.max(Math.floor(width * 0.15), 1);
  return (
    <rect
      x={x + gap} y={y}
      width={Math.max(width - gap * 2, 1)}
      height={Math.max(height, 1.5)}
      fill={color}
    />
  );
};

const WickLayer = ({ data, yAxisId }: { data: ChartDataPoint[]; yAxisId?: string }) => {
  const xScale = useXAxisScale() as ((v: string) => number) & { bandwidth?: () => number } | undefined;
  const yScale = useYAxisScale(yAxisId) as ((v: number) => number) | undefined;
  if (!xScale || !yScale) return null;
  const bw = xScale.bandwidth ? xScale.bandwidth() : 8;
  return (
    <g>
      {data.map((d, i) => {
        const cx = xScale(d.dateStr) + bw / 2;
        return (
          <line
            key={i}
            x1={cx} y1={yScale(d.high)}
            x2={cx} y2={yScale(d.low)}
            stroke={d.close >= d.open ? '#10b981' : '#f43f5e'}
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtVol(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

function readToggle(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const val = localStorage.getItem(key);
  return val === null ? def : val === 'true';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChartView({ ticker }: { ticker: string }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Toggles — persisted in localStorage
  const [showMA20, setShowMA20] = useState(() => readToggle('chart_showMA20', true));
  const [showMA50, setShowMA50] = useState(() => readToggle('chart_showMA50', false));
  const [showBB,   setShowBB]   = useState(() => readToggle('chart_showBB',   true));

  useEffect(() => { localStorage.setItem('chart_showMA20', String(showMA20)); }, [showMA20]);
  useEffect(() => { localStorage.setItem('chart_showMA50', String(showMA50)); }, [showMA50]);
  useEffect(() => { localStorage.setItem('chart_showBB',   String(showBB));   }, [showBB]);

  // ─── Fetch — now uses /api/chart/[ticker] (correct route, not news) ───────
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/chart/${ticker}`)
      .then(r => { if (!r.ok) throw new Error('Failed to fetch chart data'); return r.json(); })
      .then((json: (ChartDataPoint & { time: number; open: number; high: number; low: number; close: number })[]) => {
        setChartData(json.map((d, i, arr) => {
          const sma = (period: number) => {
            if (i < period - 1) return undefined;
            return arr.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period;
          };
          const volMa = i < 19
            ? undefined
            : arr.slice(i - 19, i + 1).reduce((s, x) => s + (x.volume ?? 0), 0) / 20;
          return {
            ...d,
            dateStr: format(new Date(d.time * 1000), 'MMM dd'),
            ohlc: [Math.min(d.open, d.close), Math.max(d.open, d.close)] as [number, number],
            ma20: sma(20),
            ma50: sma(50),
            volumeMa: volMa,
          };
        }));
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [ticker]);

  // ─── Early returns ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-8 text-center text-slate-400 flex justify-center items-center gap-2">
      <RefreshCw size={16} className="animate-spin" /> Loading chart...
    </div>
  );
  if (error) return <div className="p-8 text-center text-rose-400">Error: {error}</div>;
  if (!chartData.length) return <div className="p-8 text-center text-slate-400">No chart data available.</div>;

  // ─── Derived values ───────────────────────────────────────────────────────
  const minPrice  = Math.min(...chartData.map(d => d.low));
  const maxPrice  = Math.max(...chartData.map(d => d.high));
  const maxVolume = Math.max(...chartData.map(d => d.volume ?? 0));

  // Toggles config
  const toggles = [
    { label: 'MA20', color: '#60a5fa', active: showMA20, set: setShowMA20 },
    { label: 'MA50', color: '#f59e0b', active: showMA50, set: setShowMA50 },
    { label: 'BB',   color: '#a78bfa', active: showBB,   set: setShowBB   },
  ] as const;

  // Shared tooltip style
  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' },
    itemStyle: { color: '#60a5fa' },
    labelStyle: { color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' as const },
  };

  return (
    <div className="p-6 bg-slate-900 border-t border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BarChart2 className="text-blue-400" /> {ticker} — 6 Months
        </h3>
        <div className="flex items-center gap-2">
          {toggles.map(({ label, color, active, set }) => (
            <button
              key={label}
              onClick={() => set(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                active ? 'border-transparent' : 'border-slate-600 opacity-40'
              }`}
              style={active ? { backgroundColor: color + '22', color, borderColor: color + '55' } : {}}
            >
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: active ? color : '#475569' }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Panel 1: Price (70%) ─────────────────────────────────────────────── */}
      <div className="w-full" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} syncId="chart" margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dateStr" hide />
            <YAxis
              yAxisId="price"
              domain={[minPrice * 0.985, maxPrice * 1.015]}
              orientation="right"
              width={70}
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={v => v.toLocaleString()}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name, props: { payload?: ChartDataPoint }) => {
                if (name === 'OHLC' && props.payload) {
                  const { open, high, low, close } = props.payload;
                  return [
                    `O:${open.toLocaleString()} H:${high.toLocaleString()} L:${low.toLocaleString()} C:${close.toLocaleString()}`,
                    'Price',
                  ];
                }
                return [value as string, String(name)];
              }}
            />

            {/* Bollinger Band fill (lower renders first so fill shows between bands) */}
            {showBB && (
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="bbUpper"
                stroke="#a78bfa"
                strokeWidth={1}
                strokeDasharray="4 3"
                fill="none"
                dot={false}
                name="BB Upper"
                connectNulls
              />
            )}
            {showBB && (
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="bbLower"
                stroke="#a78bfa"
                strokeWidth={1}
                strokeDasharray="4 3"
                fill="#a78bfa18"
                dot={false}
                name="BB Lower"
                connectNulls
              />
            )}
            {showBB && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="bbMiddle"
                stroke="#94a3b880"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                name="BB Mid"
                connectNulls
              />
            )}

            {/* Wicks — rendered before candle bodies */}
            <WickLayer data={chartData} yAxisId="price" />

            {/* Candle bodies */}
            <Bar
              yAxisId="price"
              dataKey="ohlc"
              name="OHLC"
              shape={<CandleBody />}
              isAnimationActive={false}
            />

            {/* Moving averages — on top of candles */}
            {showMA20 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ma20"
                stroke="#60a5fa"
                strokeWidth={1.5}
                dot={false}
                name="MA20"
                connectNulls
              />
            )}
            {showMA50 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ma50"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                name="MA50"
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Panel 2: Volume (30%) — separate chart, synced via syncId ──────── */}
      <div className="w-full mt-1" style={{ height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} syncId="chart" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="dateStr"
              stroke="#94a3b8"
              fontSize={11}
              tickMargin={6}
              minTickGap={40}
            />
            <YAxis
              orientation="right"
              width={70}
              stroke="#94a3b8"
              fontSize={10}
              tickFormatter={fmtVol}
              domain={[0, maxVolume * 1.2]}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name) => {
                if (name === 'Volume') return [fmtVol(Number(value)), 'Volume'];
                return [value as string, String(name)];
              }}
            />

            {/* Volume bars coloured by candle direction */}
            <Bar dataKey="volume" name="Volume" isAnimationActive={false} maxBarSize={10}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.close >= d.open ? '#10b98155' : '#f43f5e55'} />
              ))}
            </Bar>

            {/* Volume MA20 */}
            <Line
              type="monotone"
              dataKey="volumeMa"
              stroke="#f59e0baa"
              strokeWidth={1.5}
              dot={false}
              name="Vol MA20"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Oscillator panels ─────────────────────────────────────────────────── */}
      {(
        [
          { title: 'RSI (14)',       key: 'rsi',    ticks: [30, 70] as number[], refs: [{ y: 70, s: '#f43f5e' }, { y: 30, s: '#10b981' }], domain: [0, 100] as [number, number] },
          { title: 'MACD (12,26,9)', key: 'macd',   ticks: undefined,            refs: [],                                                   domain: undefined },
          { title: 'Stochastic RSI', key: 'stochK', ticks: [20, 80] as number[], refs: [{ y: 80, s: '#f43f5e' }, { y: 20, s: '#10b981' }], domain: [0, 100] as [number, number] },
        ] as const
      ).map(({ title, key, ticks, refs, domain }) => (
        <div key={key} className="w-full mt-4" style={{ height: 120 }}>
          <h4 className="text-sm font-semibold mb-1 text-slate-400">{title}</h4>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="chart" margin={{ top: 4, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="dateStr" hide />
              <YAxis
                domain={domain}
                stroke="#94a3b8"
                fontSize={11}
                ticks={ticks}
                width={70}
                orientation="right"
              />
              <Tooltip {...tooltipStyle} />
              {refs.map(r => (
                <ReferenceLine key={r.y} y={r.y} stroke={r.s} strokeDasharray="5 5" />
              ))}
              {key === 'macd' ? (
                <>
                  <Bar dataKey="macdHistogram" name="Histogram" isAnimationActive={false}>
                    {chartData.map((e, i) => (
                      <Cell key={i} fill={(e.macdHistogram ?? 0) > 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="macd"       stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MACD"   />
                  <Line type="monotone" dataKey="macdSignal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal" />
                </>
              ) : key === 'stochK' ? (
                <>
                  <Line type="monotone" dataKey="stochK" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="%K" connectNulls />
                  <Line type="monotone" dataKey="stochD" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="%D" connectNulls />
                </>
              ) : (
                <Line type="monotone" dataKey={key} stroke="#a78bfa" strokeWidth={1.5} dot={false} name={key.toUpperCase()} connectNulls />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
