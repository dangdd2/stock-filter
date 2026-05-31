"use client";

import { useEffect, useState, useMemo, Fragment, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Activity, TrendingUp, TrendingDown, Filter, AlertCircle, RefreshCw, BarChart2, X, Plus, Trash2, Save, MoreVertical, Brain, GripVertical, Settings2, EyeOff, History, Map as MapIcon, SlidersHorizontal, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import SignalHistoryPanel from '@/components/SignalHistoryPanel';
import MarketHeatmap from '@/components/MarketHeatmap';
import MarketStatusBar from '@/components/MarketStatusBar';
import AdvancedScreener from '@/components/AdvancedScreener';
import {
  loadSignalHistory,
  saveSignalHistory,
  clearSignalHistory,
  addNewSignals,
  fillSignalPrices,
  type SignalLog,
  type SignalInput,
} from '@/lib/signalHistory';

export interface Watchlist {
  id: string;
  name: string;
  tickers: string[];
}
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, ReferenceLine, Cell, useXAxisScale, useYAxisScale } from 'recharts';

export interface StockIndicatorResult {
  ticker: string;
  price: number;
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  volume: number;
  timestamp: number;
  pe?: number | null;
  eps?: number | null;
  beta?: number | null;
  marketCap?: number | null;
  bookValue?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  closes7d?: number[];
  change?: number | null;
  changePct?: number | null;
  // Price stats
  change1w?: number | null;
  change1m?: number | null;
  change3m?: number | null;
  change6m?: number | null;
  high52w?: number | null;
  low52w?: number | null;
  distFromHigh?: number | null;
  distFromLow?: number | null;
  consecutiveUp?: number | null;
  consecutiveDown?: number | null;
  avgVolume20d?: number | null;
  relVolume?: number | null;
  mfi?: number | null;
  mfiPrev?: number | null;
  obvTrend?: number | null;
  macdBullishCross?: boolean;
  macdBearishCross?: boolean;
  macdAboveZero?: boolean;
  bbUpperBreakout?: boolean;
  bbLowerBreakout?: boolean;
  bbUpperReentry?: boolean;
  bbLowerReentry?: boolean;
  rsiBullishCross30?: boolean;
  rsiBearishCross70?: boolean;
  error?: string;
}

type RsiFilter = 'ALL' | 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
type MacdFilter = 'ALL' | 'BULLISH' | 'BEARISH';
type StochFilter = 'ALL' | 'OVERSOLD' | 'OVERBOUGHT' | 'BULLISH_CROSS' | 'BEARISH_CROSS';

interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  dateStr: string;
  ohlc: [number, number];
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  stochK?: number;
  stochD?: number;
  ma10?: number;
  ma20?: number;
  volume?: number;
  volumeMa?: number;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
}

interface CandleBodyProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartDataPoint;
}

// Draws only the candle body (open-to-close rectangle)
const CandleBody = ({ x, y, width, height, payload }: CandleBodyProps) => {
  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) return null;
  const color = payload.close >= payload.open ? '#10b981' : '#f43f5e';
  const gap = Math.max(Math.floor(width * 0.15), 1);
  return (
    <rect
      x={x + gap}
      y={y}
      width={Math.max(width - gap * 2, 1)}
      height={Math.max(height, 1.5)}
      fill={color}
    />
  );
};

// Draws volume bars using Recharts 3 axis scale hooks
const VolumeLayer = ({ data }: { data: ChartDataPoint[] }) => {
  const xScale = useXAxisScale() as ((v: string) => number) & { bandwidth?: () => number } | undefined;
  const yScale = useYAxisScale('volume') as ((v: number) => number) | undefined;

  if (!xScale || !yScale) return null;
  const bw = xScale.bandwidth ? xScale.bandwidth() : 8;
  const baseY = yScale(0);

  return (
    <g>
      {data.map((d, i) => {
        if (!d.volume) return null;
        const barY = yScale(d.volume);
        const color = (d.close ?? 0) >= (d.open ?? 0) ? '#10b981' : '#f43f5e';
        return (
          <rect
            key={i}
            x={xScale(d.dateStr) + 1}
            y={barY}
            width={Math.max(bw - 2, 1)}
            height={Math.max(baseY - barY, 1)}
            fill={color}
            fillOpacity={0.4}
          />
        );
      })}
    </g>
  );
};

// Draws all wicks using Recharts 3 axis scale hooks
const WickLayer = ({ data, yAxisId }: { data: ChartDataPoint[]; yAxisId?: string }) => {
  const xScale = useXAxisScale() as ((v: string) => number) & { bandwidth?: () => number } | undefined;
  const yScale = useYAxisScale(yAxisId) as ((v: number) => number) | undefined;

  if (!xScale || !yScale) return null;
  const bw = xScale.bandwidth ? xScale.bandwidth() : 8;

  return (
    <g>
      {data.map((d, i) => {
        const cx = xScale(d.dateStr) + bw / 2;
        const color = d.close >= d.open ? '#10b981' : '#f43f5e';
        return (
          <line
            key={i}
            x1={cx} y1={yScale(d.high)}
            x2={cx} y2={yScale(d.low)}
            stroke={color}
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
};

function ChartView({ ticker }: { ticker: string }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMA10, setShowMA10] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showBB, setShowBB] = useState(true);

  useEffect(() => {
    async function fetchChart() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stocks/${ticker}`);
        if (!res.ok) throw new Error('Failed to fetch chart data');
        const json = (await res.json()) as (ChartDataPoint & { open: number, high: number, low: number, close: number, time: number })[];
        
        // Format data for Recharts
        const formatted = json.map((d, i, arr) => {
          const ma = (period: number) => {
            if (i < period - 1) return undefined;
            const sum = arr.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0);
            return sum / period;
          };
          return {
            ...d,
            dateStr: format(new Date(d.time * 1000), 'MMM dd'),
            ohlc: [Math.min(d.open, d.close), Math.max(d.open, d.close)] as [number, number],
            ma10: ma(10),
            ma20: ma(20),
            volume: d.volume,
            volumeMa: (() => {
              const period = 20;
              if (i < period - 1) return undefined;
              const sum = arr.slice(i - period + 1, i + 1).reduce((s, x) => s + (x.volume ?? 0), 0);
              return sum / period;
            })(),
            bbUpper: d.bbUpper,
            bbMiddle: d.bbMiddle,
            bbLower: d.bbLower,
          };
        });
        setChartData(formatted);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchChart();
  }, [ticker]);

  if (loading) return <div className="p-8 text-center text-slate-400 flex justify-center items-center gap-2"><RefreshCw size={16} className="animate-spin"/> Loading chart...</div>;
  if (error) return <div className="p-8 text-center text-rose-400">Error: {error}</div>;
  if (chartData.length === 0) return <div className="p-8 text-center text-slate-400">No chart data available.</div>;

  const minPrice = Math.min(...chartData.map(d => d.low));
  const maxPrice = Math.max(...chartData.map(d => d.high));
  const maxVolume = Math.max(...chartData.map(d => d.volume ?? 0));

  return (
    <div className="p-6 bg-slate-900 border-t border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BarChart2 className="text-blue-400" /> {ticker} - 6 Months Price History
        </h3>
        <div className="flex items-center gap-2">
          {([
            { label: 'MA10', color: '#f59e0b', active: showMA10, toggle: () => setShowMA10(v => !v) },
            { label: 'MA20', color: '#60a5fa', active: showMA20, toggle: () => setShowMA20(v => !v) },
            { label: 'BB',   color: '#f43f5e', active: showBB,   toggle: () => setShowBB(v => !v) },
          ] as const).map(({ label, color, active, toggle }) => (
            <button
              key={label}
              onClick={toggle}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                active ? 'border-transparent' : 'border-slate-600 opacity-40'
              }`}
              style={active ? { backgroundColor: color + '22', color, borderColor: color + '55' } : {}}
            >
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ backgroundColor: active ? color : '#475569' }}
              />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={11} tickMargin={8} minTickGap={40} />
            {/* Price axis */}
            <YAxis
              yAxisId="price"
              domain={[minPrice * 0.985, maxPrice * 1.015]}
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={(val) => val.toLocaleString()}
              orientation="right"
              width={70}
            />
            {/* Volume axis — hidden, domain inflated 4x so bars occupy ~25% at bottom */}
            <YAxis
              yAxisId="volume"
              domain={[0, maxVolume * 4]}
              hide
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
              itemStyle={{ color: '#60a5fa' }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
              formatter={(value: unknown, name: unknown, props: { payload?: ChartDataPoint }) => {
                if (name === 'OHLC' && props.payload) {
                  const { open, high, low, close } = props.payload;
                  return [
                    `O: ${open.toLocaleString()}  H: ${high.toLocaleString()}  L: ${low.toLocaleString()}  C: ${close.toLocaleString()}`,
                    'Price'
                  ];
                }
                if (name === 'Volume') {
                  const v = Number(value);
                  return [v >= 1e6 ? `${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v), 'Volume'];
                }
                return [value as string, String(name)];
              }}
            />
            {/* Volume bars and MA at bottom (behind candles) */}
            <VolumeLayer data={chartData} />
            <Line yAxisId="volume" type="monotone" dataKey="volumeMa" stroke="#f59e0b99" strokeWidth={1.5} dot={false} name="Vol MA20" connectNulls />
            {/* Wicks then bodies then MA lines on top */}
            <WickLayer data={chartData} yAxisId="price" />
            <Bar
              yAxisId="price"
              dataKey="ohlc"
              name="OHLC"
              shape={<CandleBody />}
              isAnimationActive={false}
            />
            {showMA10 && <Line yAxisId="price" type="monotone" dataKey="ma10" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA10" connectNulls />}
            {showMA20 && <Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="MA20" connectNulls />}
            {showBB && <Line yAxisId="price" type="monotone" dataKey="bbUpper" stroke="#f43f5e" strokeWidth={1} strokeDasharray="4 3" dot={false} name="BB Upper" connectNulls />}
            {showBB && <Line yAxisId="price" type="monotone" dataKey="bbMiddle" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" dot={false} name="BB Mid" connectNulls />}
            {showBB && <Line yAxisId="price" type="monotone" dataKey="bbLower" stroke="#10b981" strokeWidth={1} strokeDasharray="4 3" dot={false} name="BB Lower" connectNulls />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[120px] w-full mt-4">
        <h4 className="text-sm font-semibold mb-2 text-slate-400">RSI (14)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={11} hide />
            <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} ticks={[30, 70]} width={70} orientation="right" />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
            <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="5 5" />
            <ReferenceLine y={30} stroke="#10b981" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="RSI" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[120px] w-full mt-4">
        <h4 className="text-sm font-semibold mb-2 text-slate-400">MACD (12, 26, 9)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={11} hide />
            <YAxis stroke="#94a3b8" fontSize={11} width={70} orientation="right" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
            />
            <Bar dataKey="macdHistogram" name="Histogram">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={(entry.macdHistogram ?? 0) > 0 ? '#10b981' : '#f43f5e'} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MACD" />
            <Line type="monotone" dataKey="macdSignal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[120px] w-full mt-4">
        <h4 className="text-sm font-semibold mb-2 text-slate-400">Stochastic RSI (14, 14, 3, 3)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={11} hide />
            <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} ticks={[20, 80]} width={70} orientation="right" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
            />
            {/* Overbought/Oversold levels */}
            <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="5 5" label={{ position: 'right', value: '80', fill: '#f43f5e', fontSize: 10 }} />
            <ReferenceLine y={20} stroke="#10b981" strokeDasharray="5 5" label={{ position: 'right', value: '20', fill: '#10b981', fontSize: 10 }} />
            
            <Line type="monotone" dataKey="stochK" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="%K" connectNulls />
            <Line type="monotone" dataKey="stochD" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="%D" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const REC_CONFIG: Record<string, { label: string; className: string }> = {
  BUY:        { label: 'BUY',        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  SELL:       { label: 'SELL',       className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  HOLD:       { label: 'HOLD',       className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  OBSERVABLE: { label: 'OBSERVABLE', className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

interface IncomeRow { date: string; revenue: number | null; grossProfit: number | null; operatingIncome: number | null; netIncome: number | null; ebit: number | null; }
interface CashFlowRow { date: string; operatingCashFlow: number | null; capex: number | null; freeCashFlow: number | null; }
interface BalanceSheetRow { date: string; totalAssets: number | null; totalLiabilities: number | null; equity: number | null; cash: number | null; totalDebt: number | null; debtToEquity: number | null; }
interface FinancialPeriod { income: IncomeRow[]; cashflow: CashFlowRow[]; balance: BalanceSheetRow[]; }
interface FinancialsData { annual: FinancialPeriod; quarterly: FinancialPeriod; }

function AiPanel({
  ticker, content, loading, error, onClose, item,
}: {
  ticker: string;
  content: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  item: StockIndicatorResult;
}) {
  const [financials, setFinancials] = useState<FinancialsData | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState<string | null>(null);
  const [finPeriod, setFinPeriod] = useState<'annual' | 'quarterly'>('annual');

  useEffect(() => {
    setFinLoading(true);
    setFinError(null);
    fetch(`/api/financials/${ticker}`)
      .then(r => r.json())
      .then((d: FinancialsData & { error?: string }) => {
        if (d.error) { setFinError(d.error); } else { setFinancials(d); setFinPeriod('annual'); }
      })
      .catch(() => setFinError('Failed to load financials'))
      .finally(() => setFinLoading(false));
  }, [ticker]);

  const recMatch = content.match(/RECOMMENDATION:\s*(BUY|SELL|HOLD|OBSERVABLE)/);
  const rec = recMatch ? REC_CONFIG[recMatch[1]] : null;
  const bodyText = content.replace(/^RECOMMENDATION:\s*(BUY|SELL|HOLD|OBSERVABLE)\n?/, '');

  const fmtCap = (v?: number | null) => {
    if (!v) return '—';
    if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6)  return `${(v / 1e6).toFixed(2)}M`;
    return v.toLocaleString();
  };

  const pb = (item.price && item.bookValue) ? item.price / item.bookValue : null;

  const fundamentals = [
    {
      label: 'P/E Ratio',
      value: item.pe ? item.pe.toFixed(2) : '—',
      note: item.pe ? (item.pe < 10 ? 'Thấp — có thể định giá thấp' : item.pe < 20 ? 'Hợp lý' : item.pe < 35 ? 'Cao — kỳ vọng tăng trưởng' : 'Rất cao — rủi ro định giá') : undefined,
      noteColor: item.pe ? (item.pe < 10 ? 'text-emerald-400' : item.pe < 20 ? 'text-slate-400' : item.pe < 35 ? 'text-amber-400' : 'text-rose-400') : '',
    },
    {
      label: 'EPS',
      value: item.eps ? item.eps.toLocaleString() : '—',
      note: item.eps ? (item.eps > 0 ? 'Dương — sinh lời' : 'Âm — lỗ') : undefined,
      noteColor: item.eps ? (item.eps > 0 ? 'text-emerald-400' : 'text-rose-400') : '',
    },
    {
      label: 'P/B Ratio',
      value: pb ? pb.toFixed(2) : '—',
      note: pb ? (pb < 1 ? 'Dưới mệnh giá sổ sách' : pb < 2 ? 'Hợp lý' : pb < 4 ? 'Cao' : 'Rất cao') : undefined,
      noteColor: pb ? (pb < 1 ? 'text-emerald-400' : pb < 2 ? 'text-slate-400' : pb < 4 ? 'text-amber-400' : 'text-rose-400') : '',
    },
    {
      label: 'Book Value/Share',
      value: item.bookValue ? item.bookValue.toLocaleString() : '—',
      note: undefined,
      noteColor: '',
    },
    {
      label: 'Beta',
      value: item.beta ? item.beta.toFixed(2) : '—',
      note: item.beta ? (item.beta < 0.8 ? 'Ít biến động' : item.beta < 1.2 ? 'Tương đương thị trường' : 'Biến động cao') : undefined,
      noteColor: item.beta ? (item.beta < 0.8 ? 'text-emerald-400' : item.beta < 1.2 ? 'text-slate-400' : 'text-rose-400') : '',
    },
    {
      label: 'Vốn hoá',
      value: fmtCap(item.marketCap),
      note: undefined,
      noteColor: '',
    },
  ];

  return (
    <div className="bg-slate-900 border-t border-violet-500/20 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-violet-400" />
          <h3 className="font-bold text-slate-200">AI Analysis — {ticker}</h3>
          {rec && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${rec.className}`}>
              {rec.label}
            </span>
          )}
          {loading && !rec && (
            <span className="text-xs text-slate-500 animate-pulse">Analyzing…</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* AI content */}
      {error && (
        <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 mb-6">
          {error}
        </div>
      )}
      {!error && (
        <div className="prose prose-invert prose-sm max-w-none mb-6">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
            {bodyText || (loading ? '' : 'No content.')}
            {loading && <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />}
          </pre>
        </div>
      )}

      {/* Fundamental Analysis */}
      <div className="border-t border-slate-700/60 pt-5">
        <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-blue-400" /> Phân Tích Cơ Bản
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {fundamentals.map(({ label, value, note, noteColor }) => (
            <div key={label} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-base font-bold text-slate-200 font-mono">{value}</p>
              {note && <p className={`text-[10px] mt-1 ${noteColor}`}>{note}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Financial Statements */}
      <div className="border-t border-slate-700/60 pt-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <BarChart2 size={15} className="text-emerald-400" /> Báo Cáo Tài Chính
            {finLoading && <RefreshCw size={13} className="animate-spin text-slate-500" />}
          </h4>
          {financials && (
            <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs">
              {(['annual', 'quarterly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFinPeriod(p)}
                  className={`px-3 py-1 transition-colors ${
                    finPeriod === p
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {p === 'annual' ? 'Năm' : 'Quý'}
                </button>
              ))}
            </div>
          )}
        </div>

        {finError && (
          <p className="text-xs text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2">{finError}</p>
        )}

        {financials && !finError && (() => {
          const fmt = (v: number | null, unit = 'B') => {
            if (v === null) return '—';
            const b = v / 1e9;
            return `${b >= 0 ? '' : ''}${b.toFixed(1)}${unit}`;
          };
          const pct = (curr: number | null, prev: number | null) => {
            if (!curr || !prev || prev === 0) return null;
            const p = ((curr - prev) / Math.abs(prev)) * 100;
            return { val: p, label: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`, color: p >= 0 ? 'text-emerald-400' : 'text-rose-400' };
          };

          const period = financials[finPeriod];
          const inc = period.income;
          const cf = period.cashflow;
          const bs = period.balance;

          const hasCfData = cf.some(r => r.operatingCashFlow !== null || r.freeCashFlow !== null || r.capex !== null);
          const hasBsData = bs.some(r => r.totalAssets !== null || r.equity !== null || r.totalLiabilities !== null);

          return (
            <div className="space-y-5">
              {/* Income Statement */}
              {inc.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Kết Quả Kinh Doanh (tỷ VND)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700">
                          <th className="text-left py-1.5 pr-4 font-medium">Chỉ tiêu</th>
                          {inc.map(r => <th key={r.date} className="text-right py-1.5 px-3 font-medium">{r.date}</th>)}
                          {inc.length >= 2 && <th className="text-right py-1.5 pl-3 font-medium text-slate-600">YoY</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {([
                          { label: 'Doanh thu', key: 'revenue' },
                          { label: 'Lợi nhuận gộp', key: 'grossProfit' },
                          { label: 'Lợi nhuận HĐ', key: 'operatingIncome' },
                          { label: 'Lợi nhuận ròng', key: 'netIncome' },
                          { label: 'EBIT', key: 'ebit' },
                        ] as { label: string; key: keyof IncomeRow }[]).map(({ label, key }) => {
                          const latest = inc[0]?.[key] as number | null;
                          const prev = inc[1]?.[key] as number | null;
                          const yoy = pct(latest, prev);
                          const isProfit = key !== 'revenue' && key !== 'ebit';
                          return (
                            <tr key={key} className="hover:bg-slate-800/40">
                              <td className="py-1.5 pr-4 text-slate-400">{label}</td>
                              {inc.map(r => {
                                const v = r[key] as number | null;
                                const color = isProfit && v !== null ? (v >= 0 ? 'text-slate-200' : 'text-rose-400') : 'text-slate-200';
                                return <td key={r.date} className={`text-right py-1.5 px-3 font-mono ${color}`}>{fmt(v)}</td>;
                              })}
                              {inc.length >= 2 && (
                                <td className={`text-right py-1.5 pl-3 font-mono ${yoy?.color ?? 'text-slate-600'}`}>
                                  {yoy?.label ?? '—'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cash Flow */}
              {cf.length > 0 && hasCfData && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Dòng Tiền (tỷ VND)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700">
                          <th className="text-left py-1.5 pr-4 font-medium">Chỉ tiêu</th>
                          {cf.map(r => <th key={r.date} className="text-right py-1.5 px-3 font-medium">{r.date}</th>)}
                          {cf.length >= 2 && <th className="text-right py-1.5 pl-3 font-medium text-slate-600">YoY</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {([
                          { label: 'Dòng tiền HĐ', key: 'operatingCashFlow' },
                          { label: 'Chi tiêu vốn', key: 'capex' },
                          { label: 'Dòng tiền tự do', key: 'freeCashFlow' },
                        ] as { label: string; key: keyof CashFlowRow }[]).map(({ label, key }) => {
                          const latest = cf[0]?.[key] as number | null;
                          const prev = cf[1]?.[key] as number | null;
                          const yoy = pct(latest, prev);
                          return (
                            <tr key={key} className="hover:bg-slate-800/40">
                              <td className="py-1.5 pr-4 text-slate-400">{label}</td>
                              {cf.map(r => {
                                const v = r[key] as number | null;
                                const color = v !== null ? (v >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-600';
                                return <td key={r.date} className={`text-right py-1.5 px-3 font-mono ${color}`}>{fmt(v)}</td>;
                              })}
                              {cf.length >= 2 && (
                                <td className={`text-right py-1.5 pl-3 font-mono ${yoy?.color ?? 'text-slate-600'}`}>
                                  {yoy?.label ?? '—'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Balance Sheet */}
              {bs.length > 0 && hasBsData && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bảng Cân Đối Kế Toán (tỷ VND)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700">
                          <th className="text-left py-1.5 pr-4 font-medium">Chỉ tiêu</th>
                          {bs.map(r => <th key={r.date} className="text-right py-1.5 px-3 font-medium">{r.date}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {([
                          { label: 'Tổng tài sản', key: 'totalAssets', special: false },
                          { label: 'Tổng nợ', key: 'totalLiabilities', special: false },
                          { label: 'Vốn chủ sở hữu', key: 'equity', special: false },
                          { label: 'Tiền mặt', key: 'cash', special: false },
                          { label: 'Tổng vay nợ', key: 'totalDebt', special: false },
                          { label: 'Nợ/Vốn (D/E)', key: 'debtToEquity', special: true },
                        ] as { label: string; key: keyof BalanceSheetRow; special: boolean }[]).map(({ label, key, special }) => (
                          <tr key={key} className="hover:bg-slate-800/40">
                            <td className="py-1.5 pr-4 text-slate-400">{label}</td>
                            {bs.map(r => {
                              const v = r[key] as number | null;
                              if (special) {
                                const color = v !== null ? (v < 1 ? 'text-emerald-400' : v < 2 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-600';
                                return <td key={r.date} className={`text-right py-1.5 px-3 font-mono ${color}`}>{v !== null ? v.toFixed(2) : '—'}</td>;
                              }
                              return <td key={r.date} className="text-right py-1.5 px-3 font-mono text-slate-200">{fmt(v)}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {inc.length === 0 && !hasCfData && !hasBsData && (
                <p className="text-xs text-slate-500">Không có dữ liệu báo cáo tài chính từ Yahoo Finance.</p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function Sparkline({ values, width = 64, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + (1 - (v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const up = values[values.length - 1] >= values[0];
  const color = up ? '#34d399' : '#f87171'; // emerald-400 / red-400
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const MASTER_ID = 'master';

export default function Home() {
  const [data, setData] = useState<StockIndicatorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowData, setRowData] = useState<StockIndicatorResult[]>([]);
  const [tableDragIdx, setTableDragIdx] = useState<number | null>(null);
  const [tableDragOverIdx, setTableDragOverIdx] = useState<number | null>(null);
  const preventFetch = useRef(false);
  const pendingExpandTicker = useRef<string | null>(null);

  const [rsiFilter, setRsiFilter] = useState<RsiFilter>('ALL');
  const [macdFilter, setMacdFilter] = useState<MacdFilter>('ALL');
  const [stochFilter, setStochFilter] = useState<StochFilter>('ALL');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // AI analysis state
  const [aiTicker, setAiTicker] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Watchlist state
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [newTicker, setNewTicker] = useState('');

  // Manage watchlist modal state
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageWatchlists, setManageWatchlists] = useState<Watchlist[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Ignored tickers in the signal/recommend section
  const [ignoredSignalTickers, setIgnoredSignalTickers] = useState<string[]>([]);

  // Master watchlist signal data (always tracks All Tickers)
  const [masterData, setMasterData] = useState<StockIndicatorResult[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);

  // Signal history & backtesting
  const [signalHistory, setSignalHistory] = useState<SignalLog[]>([]);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'history' | 'heatmap' | 'screener'>('watchlist');

  // Last successful data fetch timestamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Initial load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vn_stock_watchlists');
    let lists: Watchlist[] = [];
    if (saved) {
      try {
        lists = JSON.parse(saved) as Watchlist[];
      } catch (e) {
        console.error('Failed to parse watchlists', e);
      }
    }
    // Ensure master watchlist always exists at the top
    if (!lists.find(w => w.id === MASTER_ID)) {
      const master: Watchlist = { id: MASTER_ID, name: 'All Tickers', tickers: [] };
      lists = [master, ...lists];
    }
    if (lists.length === 1) {
      // Only master exists — add a default watchlist
      const def: Watchlist = { id: 'default', name: 'Main Watchlist', tickers: ['ACB', 'SHB', 'VCB', 'TCB', 'VPB', 'MBB', 'STB'] };
      lists = [lists[0], def];
    }
    setWatchlists(lists);
    setActiveWatchlistId(lists[0].id);

    const savedIgnored = localStorage.getItem('vn_stock_ignored_signals');
    if (savedIgnored) {
      try { setIgnoredSignalTickers(JSON.parse(savedIgnored)); } catch { /* ignore */ }
    }

    // Load signal history
    setSignalHistory(loadSignalHistory());
  }, []);

  useEffect(() => {
    localStorage.setItem('vn_stock_ignored_signals', JSON.stringify(ignoredSignalTickers));
  }, [ignoredSignalTickers]);

  const activeWatchlist = useMemo(() =>
    watchlists.find(w => w.id === activeWatchlistId)
  , [watchlists, activeWatchlistId]);

  const masterWatchlist = useMemo(() => watchlists.find(w => w.id === MASTER_ID), [watchlists]);

  const fetchData = useCallback(async () => {
    if (!activeWatchlist || activeWatchlist.tickers.length === 0) {
      setData([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks?tickers=${activeWatchlist.tickers.join(',')}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json: StockIndicatorResult[] = await res.json();
      setData(json);
      setLastUpdated(new Date());

      // ── Signal History: log new signals + fill pending prices ──
      const today = new Date().toISOString().split('T')[0];
      const priceEntries: [string, number][] = json.filter(d => !d.error).map(d => [d.ticker, d.price]);
      const priceMap = new Map(priceEntries) as Map<string, number>;

      setSignalHistory(prev => {
        // 1. Fill pending price checkpoints for already-logged signals
        let updated = fillSignalPrices(prev, priceMap);

        // 2. Collect today's new signals from fresh data
        const newInputs: SignalInput[] = [];
        json.forEach(item => {
          if (item.error) return;
          const buyReasons: string[] = [];
          const sellReasons: string[] = [];
          if (item.rsi !== null && item.rsi < 30) buyReasons.push(`RSI ${item.rsi.toFixed(0)}`);
          if (item.rsi !== null && item.rsi > 70) sellReasons.push(`RSI ${item.rsi.toFixed(0)}`);
          if (item.stochK !== null && item.stochK < 20) buyReasons.push(`Stoch ${item.stochK.toFixed(0)}`);
          if (item.stochK !== null && item.stochK > 80) sellReasons.push(`Stoch ${item.stochK.toFixed(0)}`);
          if (item.bbLower != null && item.price < item.bbLower) buyReasons.push('BB↓');
          if (item.bbUpper != null && item.price > item.bbUpper) sellReasons.push('BB↑');
          if (buyReasons.length)
            newInputs.push({ ticker: item.ticker, direction: 'BUY', reasons: buyReasons, entry: item.price, target: item.bbMiddle ?? null });
          if (sellReasons.length)
            newInputs.push({ ticker: item.ticker, direction: 'SELL', reasons: sellReasons, entry: item.price, target: item.bbMiddle ?? null });
        });

        // 3. Merge (deduplication by ticker+direction+day is inside addNewSignals)
        updated = addNewSignals(updated, newInputs, today);
        saveSignalHistory(updated);
        return updated;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [activeWatchlist]);

  // Fetch data when active watchlist or its tickers change (skip if only order changed)
  useEffect(() => {
    if (preventFetch.current) {
      preventFetch.current = false;
      return;
    }
    if (activeWatchlistId) fetchData();
  }, [activeWatchlistId, fetchData]);

  const fetchMasterData = useCallback(async () => {
    const tickers = masterWatchlist?.tickers ?? [];
    if (tickers.length === 0) { setMasterData([]); return; }
    setMasterLoading(true);
    try {
      const res = await fetch(`/api/stocks?tickers=${tickers.join(',')}`);
      if (!res.ok) throw new Error('Failed');
      setMasterData(await res.json());
    } catch { /* silent */ } finally {
      setMasterLoading(false);
    }
  }, [masterWatchlist]);

  // When master is the active watchlist, reuse its data directly (no double-fetch)
  useEffect(() => {
    if (activeWatchlistId === MASTER_ID) setMasterData(data);
  }, [data, activeWatchlistId]);

  // When a non-master watchlist is active, fetch master data separately
  useEffect(() => {
    if (activeWatchlistId !== MASTER_ID) fetchMasterData();
  }, [fetchMasterData, activeWatchlistId]);

  // Sync to localStorage
  useEffect(() => {
    if (watchlists.length > 0) {
      localStorage.setItem('vn_stock_watchlists', JSON.stringify(watchlists));
    }
  }, [watchlists]);

  const createWatchlist = () => {
    const id = Date.now().toString();
    const newList: Watchlist = { id, name: 'New Watchlist', tickers: [] };
    const updated = [...watchlists, newList];
    setWatchlists(updated);
    setActiveWatchlistId(id);
    // Open manage modal so user can immediately rename / reorder
    setManageWatchlists(updated);
    setRenamingId(id);
    setRenamingValue('New Watchlist');
    setShowManageModal(true);
  };

  const deleteWatchlist = () => {
    if (activeWatchlistId === MASTER_ID) return;
    if (watchlists.filter(w => w.id !== MASTER_ID).length <= 1) return;
    const remaining = watchlists.filter(w => w.id !== activeWatchlistId);
    setWatchlists(remaining);
    setActiveWatchlistId(remaining[0].id);
  };

  const syncMasterWatchlist = useCallback(() => {
    const allTickers = Array.from(new Set(
      watchlists
        .filter(w => w.id !== MASTER_ID)
        .flatMap(w => w.tickers)
    ));
    setWatchlists(prev => prev.map(w =>
      w.id === MASTER_ID ? { ...w, tickers: allTickers } : w
    ));
  }, [watchlists]);


  const addTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim() || !activeWatchlist) return;
    
    // Split by comma, trim, uppercase, and filter out empties
    const tickersToAdd = newTicker
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => t !== '' && !activeWatchlist.tickers.includes(t));

    if (tickersToAdd.length === 0) {
      setNewTicker('');
      return;
    }
    
    setWatchlists(watchlists.map(w => 
      w.id === activeWatchlistId ? { ...w, tickers: [...w.tickers, ...tickersToAdd] } : w
    ));
    setNewTicker('');
  };

  const removeTicker = (ticker: string) => {
    if (!activeWatchlist) return;
    setWatchlists(watchlists.map(w =>
      w.id === activeWatchlistId ? { ...w, tickers: w.tickers.filter(t => t !== ticker) } : w
    ));
  };

  const handleTableDragStart = (idx: number) => setTableDragIdx(idx);

  const handleTableDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setTableDragOverIdx(idx);
  };

  const handleTableDrop = (toIdx: number) => {
    if (tableDragIdx === null || tableDragIdx === toIdx) {
      setTableDragIdx(null);
      setTableDragOverIdx(null);
      return;
    }
    const reordered = [...rowData];
    const [moved] = reordered.splice(tableDragIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setRowData(reordered);

    // Persist new order to the watchlist (visible tickers first, then any hidden by filters)
    if (activeWatchlist) {
      const visibleTickers = reordered.map(r => r.ticker);
      const hiddenTickers = activeWatchlist.tickers.filter(t => !visibleTickers.includes(t));
      preventFetch.current = true;
      setWatchlists(watchlists.map(w =>
        w.id === activeWatchlistId ? { ...w, tickers: [...visibleTickers, ...hiddenTickers] } : w
      ));
    }
    setTableDragIdx(null);
    setTableDragOverIdx(null);
  };

  const handleTableDragEnd = () => {
    setTableDragIdx(null);
    setTableDragOverIdx(null);
  };

  const openManageModal = () => {
    setManageWatchlists([...watchlists]);
    setRenamingId(null);
    setShowManageModal(true);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const trimmed = renamingValue.trim();
    if (trimmed) {
      setManageWatchlists(prev => prev.map(w => w.id === renamingId ? { ...w, name: trimmed } : w));
    }
    setRenamingId(null);
  };

  const saveManageModal = () => {
    commitRename();
    setWatchlists(manageWatchlists);
    setShowManageModal(false);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...manageWatchlists];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setManageWatchlists(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (item.error) return false;
      
      let passRsi = true;
      if (rsiFilter === 'OVERSOLD') passRsi = (item.rsi !== null && item.rsi < 30);
      else if (rsiFilter === 'OVERBOUGHT') passRsi = (item.rsi !== null && item.rsi > 70);
      else if (rsiFilter === 'NEUTRAL') passRsi = (item.rsi !== null && item.rsi >= 30 && item.rsi <= 70);

      let passMacd = true;
      if (macdFilter === 'BULLISH') passMacd = (item.macd !== null && item.macdSignal !== null && item.macd > item.macdSignal);
      else if (macdFilter === 'BEARISH') passMacd = (item.macd !== null && item.macdSignal !== null && item.macd < item.macdSignal);

      let passStoch = true;
      if (stochFilter === 'OVERSOLD') passStoch = (item.stochK !== null && item.stochK < 20);
      else if (stochFilter === 'OVERBOUGHT') passStoch = (item.stochK !== null && item.stochK > 80);
      else if (stochFilter === 'BULLISH_CROSS') passStoch = (item.stochK !== null && item.stochD !== null && item.stochK > item.stochD);
      else if (stochFilter === 'BEARISH_CROSS') passStoch = (item.stochK !== null && item.stochD !== null && item.stochK < item.stochD);

      return passRsi && passMacd && passStoch;
    });
  }, [data, rsiFilter, macdFilter, stochFilter]);

  // Keep rowData in sync with filteredData (reset on new fetch / filter change)
  useEffect(() => {
    setRowData(filteredData);
    if (pendingExpandTicker.current) {
      const ticker = pendingExpandTicker.current;
      if (filteredData.some(d => d.ticker === ticker)) {
        pendingExpandTicker.current = null;
        setExpandedTicker(ticker);
        setTimeout(() => {
          document.getElementById(`row-${ticker}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [filteredData]);

  const { buySignals, sellSignals } = useMemo(() => {
    const buy: Array<{ ticker: string; reasons: string[]; entry: number; target: number | null }> = [];
    const sell: Array<{ ticker: string; reasons: string[]; entry: number; target: number | null }> = [];

    data.forEach(item => {
      if (item.error) return;
      if (ignoredSignalTickers.includes(item.ticker)) return;
      const br: string[] = [];
      const sr: string[] = [];

      if (item.rsi !== null && item.rsi !== undefined && item.rsi < 30) br.push(`RSI ${item.rsi.toFixed(0)}`);
      if (item.rsi !== null && item.rsi !== undefined && item.rsi > 70) sr.push(`RSI ${item.rsi.toFixed(0)}`);
      if (item.stochK !== null && item.stochK !== undefined && item.stochK < 20) br.push(`Stoch ${item.stochK.toFixed(0)}`);
      if (item.stochK !== null && item.stochK !== undefined && item.stochK > 80) sr.push(`Stoch ${item.stochK.toFixed(0)}`);
      if (item.bbLower != null && item.price < item.bbLower) br.push('BB↓');
      if (item.bbUpper != null && item.price > item.bbUpper) sr.push('BB↑');

      // BUY: entry = current price, target = BB middle (upside)
      if (br.length) buy.push({ ticker: item.ticker, reasons: br, entry: item.price, target: item.bbMiddle ?? null });
      // SELL: entry = current price, target = BB middle (downside)
      if (sr.length) sell.push({ ticker: item.ticker, reasons: sr, entry: item.price, target: item.bbMiddle ?? null });
    });

    const byConviction = (a: typeof buy[0], b: typeof buy[0]) => b.reasons.length - a.reasons.length;
    return { buySignals: buy.sort(byConviction), sellSignals: sell.sort(byConviction) };
  }, [data, ignoredSignalTickers]);

  const toggleChart = (ticker: string) => {
    if (expandedTicker === ticker) {
      setExpandedTicker(null);
    } else {
      setExpandedTicker(ticker);
    }
  };

  const handleSignalTickerClick = (ticker: string) => {
    const isInCurrentData = data.some(d => d.ticker === ticker);
    if (isInCurrentData) {
      setExpandedTicker(prev => prev === ticker ? null : ticker);
      setTimeout(() => {
        document.getElementById(`row-${ticker}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    } else {
      // Switch to master watchlist and expand after data loads
      pendingExpandTicker.current = ticker;
      setActiveWatchlistId(MASTER_ID);
    }
  };

  const runAnalysis = useCallback(async (item: StockIndicatorResult) => {
    if (aiTicker === item.ticker) {
      setAiTicker(null);
      return;
    }
    setAiTicker(item.ticker);
    setAiContent('');
    setAiError(null);
    setAiLoading(true);

    try {
      const res = await fetch(`/api/analyze/${item.ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: item.price,
          volume: item.volume,
          rsi: item.rsi,
          stochK: item.stochK,
          stochD: item.stochD,
          macd: item.macd,
          macdSignal: item.macdSignal,
          macdHistogram: item.macdHistogram,
          bbUpper: item.bbUpper ?? null,
          bbMiddle: item.bbMiddle ?? null,
          bbLower: item.bbLower ?? null,
        }),
      });

      if (!res.ok) throw new Error('Analysis request failed');
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          let parsed: { text?: string; error?: string } | null = null;
          try {
            parsed = JSON.parse(payload);
          } catch { /* skip malformed JSON */ }
          if (parsed) {
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) setAiContent(prev => prev + parsed.text);
          }
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAiLoading(false);
    }
  }, [aiTicker]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-10">
      <header className="bg-slate-800 border-b border-slate-700 py-4 px-6 sticky top-0 z-10 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Stock AI</h1>
            <p className="text-xs text-slate-400">Custom Watchlists & Technical Indicators</p>
          </div>
        </div>
        {/* Tab navigation */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-sm">
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center gap-2 px-4 py-2 transition-colors ${activeTab === 'watchlist' ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <BarChart2 size={14} /> Watchlist
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 transition-colors relative ${activeTab === 'history' ? 'bg-violet-500/20 text-violet-300 font-semibold' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <History size={14} /> Lịch Sử
            {signalHistory.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-violet-500/30 text-violet-300 rounded-full text-[10px] font-bold leading-none">
                {signalHistory.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`flex items-center gap-2 px-4 py-2 transition-colors ${activeTab === 'heatmap' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <MapIcon size={14} /> Heatmap
          </button>
          <button
            onClick={() => setActiveTab('screener')}
            className={`flex items-center gap-2 px-4 py-2 transition-colors ${activeTab === 'screener' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <SlidersHorizontal size={14} /> Screener
          </button>
          <Link
            href="/guide"
            className="flex items-center gap-2 px-4 py-2 transition-colors text-slate-400 hover:bg-slate-700 border-l border-slate-700"
          >
            <HelpCircle size={14} /> Hướng dẫn
          </Link>
        </div>
      </header>

      <main className="w-full px-4 py-4 space-y-3">

        {/* ── Market Status + Auto-Refresh Bar ── */}
        <MarketStatusBar
          loading={loading}
          lastUpdated={lastUpdated}
          onRefresh={fetchData}
        />

        {/* ── Signal History Tab ── */}
        {activeTab === 'history' && (
          <SignalHistoryPanel
            logs={signalHistory}
            onClear={() => {
              clearSignalHistory();
              setSignalHistory([]);
            }}
          />
        )}

        {/* ── Market Heatmap Tab ── */}
        {activeTab === 'heatmap' && (
          <MarketHeatmap
            data={masterData.length > 0 ? masterData : data}
            watchlists={watchlists}
            onTickerClick={(ticker) => {
              setActiveTab('watchlist');
              handleSignalTickerClick(ticker);
            }}
          />
        )}

        {/* ── Advanced Screener Tab ── */}
        {activeTab === 'screener' && (
          <AdvancedScreener
            data={masterData.length > 0 ? masterData : data}
            onTickerClick={(ticker) => {
              setActiveTab('watchlist');
              handleSignalTickerClick(ticker);
            }}
          />
        )}

        {/* ── Watchlist Tab ── */}
        {activeTab === 'watchlist' && <>
        {/* ── Top Control Bar ── */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">

          {/* Watchlist selector */}
          <div className="flex items-center gap-2">
            <BarChart2 size={15} className="text-blue-400 shrink-0" />
            <div className="relative">
              <select
                value={activeWatchlistId}
                onChange={(e) => setActiveWatchlistId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
              >
                {watchlists.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.id === MASTER_ID ? `★ ${w.name}` : w.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-500">
                <MoreVertical size={13} />
              </div>
            </div>
          </div>

          {/* Watchlist actions */}
          {activeWatchlist && (
            activeWatchlistId === MASTER_ID ? (
              <button
                onClick={syncMasterWatchlist}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md text-xs transition-colors"
              >
                <RefreshCw size={12} /> Sync
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openManageModal}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-xs transition-colors"
                >
                  <Settings2 size={12} /> Manage
                </button>
                <button
                  onClick={createWatchlist}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-md text-xs transition-colors"
                >
                  <Plus size={12} /> New
                </button>
              </div>
            )
          )}

          {/* Add ticker */}
          <form onSubmit={addTicker} className="flex gap-2">
            <input
              type="text"
              placeholder="Add ticker (e.g. VCB)"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
            />
            <button type="submit" className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors">
              <Plus size={15} />
            </button>
          </form>

          <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block" />

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-slate-400 shrink-0" />

            <select
              value={rsiFilter}
              onChange={(e) => setRsiFilter(e.target.value as RsiFilter)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">RSI: All</option>
              <option value="OVERSOLD">RSI &lt; 30</option>
              <option value="NEUTRAL">RSI 30–70</option>
              <option value="OVERBOUGHT">RSI &gt; 70</option>
            </select>

            <select
              value={macdFilter}
              onChange={(e) => setMacdFilter(e.target.value as MacdFilter)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">MACD: All</option>
              <option value="BULLISH">Bullish</option>
              <option value="BEARISH">Bearish</option>
            </select>

            <select
              value={stochFilter}
              onChange={(e) => setStochFilter(e.target.value as StochFilter)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Stoch: All</option>
              <option value="OVERSOLD">Oversold &lt; 20</option>
              <option value="OVERBOUGHT">Overbought &gt; 80</option>
              <option value="BULLISH_CROSS">Bullish Cross</option>
              <option value="BEARISH_CROSS">Bearish Cross</option>
            </select>
          </div>

          {/* Summary ticker count pushed to the right */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400">
              <span className="font-bold text-slate-200">{filteredData.length}</span> / {activeWatchlist?.tickers.length || 0} tickers
            </span>
          </div>
        </div>

        {/* ── Signals Summary Panel ── */}
        {(buySignals.length > 0 || sellSignals.length > 0 || masterLoading) && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Activity size={13} className="text-blue-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Khuyến Nghị Cổ Phiếu</span>
              {loading && <RefreshCw size={11} className="animate-spin text-slate-400 ml-1" />}
              <span className="text-xs text-slate-500">— {activeWatchlist?.name ?? 'All Tickers'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-400 tracking-wide">
                sorted by conviction
              </span>
            </div>

            {buySignals.length > 0 && (
              <div className="flex flex-wrap items-start gap-2">
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 shrink-0 pt-0.5 min-w-[70px]">
                  <TrendingUp size={13} /> MUA ({buySignals.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {buySignals.map(({ ticker, reasons, entry, target }) => {
                    const score = reasons.length;
                    const cardCls =
                      score === 3 ? 'bg-emerald-500/25 border-emerald-500/50 ring-1 ring-emerald-500/30' :
                      score === 2 ? 'bg-emerald-500/15 border-emerald-500/35' :
                                   'bg-emerald-500/10 border-emerald-500/20';
                    const chipCls =
                      score === 3 ? 'bg-emerald-400/20 text-emerald-300 font-bold' :
                      score === 2 ? 'bg-emerald-500/15 text-emerald-400' :
                                   'bg-slate-700 text-emerald-600';
                    return (
                      <div
                        key={ticker}
                        onClick={() => handleSignalTickerClick(ticker)}
                        className={`relative flex flex-col px-2.5 py-1.5 border rounded-lg text-xs cursor-pointer hover:brightness-110 transition-all group ${cardCls}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-emerald-300">{ticker}</span>
                          <span className="text-emerald-500/70">{reasons.join(' · ')}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono leading-none ${chipCls}`}>
                            {score}/3
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setIgnoredSignalTickers(prev => [...prev, ticker]); }}
                            className="ml-auto p-0.5 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Ignore this ticker"
                          >
                            <EyeOff size={11} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                          {target != null ? (
                            <>
                              <span className="text-emerald-400 font-medium">{entry.toLocaleString()}</span>
                              <span className="text-slate-500">-</span>
                              <span className="text-emerald-300 font-medium">{Math.round(target).toLocaleString()}</span>
                              <span className="text-slate-500">(</span>
                              <span className="text-emerald-300 font-semibold">+{(((target - entry) / entry) * 100).toFixed(1)}%</span>
                              <span className="text-slate-500">)</span>
                            </>
                          ) : (
                            <span className="text-emerald-400 font-medium">{entry.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sellSignals.length > 0 && (
              <div className="flex flex-wrap items-start gap-2">
                <span className="flex items-center gap-1 text-xs font-semibold text-rose-400 shrink-0 pt-0.5 min-w-[70px]">
                  <TrendingDown size={13} /> BÁN ({sellSignals.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {sellSignals.map(({ ticker, reasons, entry, target }) => {
                    const score = reasons.length;
                    const cardCls =
                      score === 3 ? 'bg-rose-500/25 border-rose-500/50 ring-1 ring-rose-500/30' :
                      score === 2 ? 'bg-rose-500/15 border-rose-500/35' :
                                   'bg-rose-500/10 border-rose-500/20';
                    const chipCls =
                      score === 3 ? 'bg-rose-400/20 text-rose-300 font-bold' :
                      score === 2 ? 'bg-rose-500/15 text-rose-400' :
                                   'bg-slate-700 text-rose-600';
                    return (
                      <div
                        key={ticker}
                        onClick={() => handleSignalTickerClick(ticker)}
                        className={`relative flex flex-col px-2.5 py-1.5 border rounded-lg text-xs cursor-pointer hover:brightness-110 transition-all group ${cardCls}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-rose-300">{ticker}</span>
                          <span className="text-rose-500/70">{reasons.join(' · ')}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono leading-none ${chipCls}`}>
                            {score}/3
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setIgnoredSignalTickers(prev => [...prev, ticker]); }}
                            className="ml-auto p-0.5 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Ignore this ticker"
                          >
                            <EyeOff size={11} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                          {target != null ? (
                            <>
                              <span className="text-rose-400 font-medium">{entry.toLocaleString()}</span>
                              <span className="text-slate-500">-</span>
                              <span className="text-rose-300 font-medium">{Math.round(target).toLocaleString()}</span>
                              <span className="text-slate-500">(</span>
                              <span className="text-rose-300 font-semibold">{(((target - entry) / entry) * 100).toFixed(1)}%</span>
                              <span className="text-slate-500">)</span>
                            </>
                          ) : (
                            <span className="text-rose-400 font-medium">{entry.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <section>
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start gap-3 mb-6">
              <AlertCircle className="shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Error Loading Data</h3>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="pl-3 pr-1 py-4 w-6" />
                    <th className="px-4 py-4 font-medium">Ticker</th>
                    <th className="px-4 py-4 font-medium">Price</th>
                    <th className="px-4 py-4 font-medium">Change</th>
                    <th className="px-4 py-4 font-medium">P/E</th>
                    <th className="px-4 py-4 font-medium">EPS</th>
                    <th className="px-4 py-4 font-medium">Beta</th>
                    <th className="px-4 py-4 font-medium">Mkt Cap</th>
                    <th className="px-4 py-4 font-medium">BV/Share</th>
                    <th className="px-4 py-4 font-medium">BB %B</th>
                    <th className="px-4 py-4 font-medium">RSI</th>
                    <th className="px-4 py-4 font-medium">Stoch RSI</th>
                    <th className="px-4 py-4 font-medium">MACD Hist</th>
                    <th className="px-4 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="pl-3 pr-1 py-4"><div className="w-3 h-3 bg-slate-700 rounded" /></td>
                        <td className="px-4 py-4">
                          <div className="h-3.5 w-10 bg-slate-700 rounded mb-1.5" />
                          <div className="h-2 w-8 bg-slate-800 rounded" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-16 bg-slate-700 rounded" />
                            <div className="h-3 w-14 bg-slate-700 rounded" />
                          </div>
                        </td>
                        <td className="px-4 py-4"><div className="h-7 w-16 bg-slate-700 rounded-md" /></td>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-4"><div className="h-3 w-10 bg-slate-700 rounded" /></td>
                        ))}
                        <td className="px-4 py-4"><div className="h-7 w-12 bg-slate-700 rounded-md" /></td>
                        <td className="px-4 py-4"><div className="h-7 w-14 bg-slate-700 rounded-md" /></td>
                        <td className="px-4 py-4"><div className="h-7 w-14 bg-slate-700 rounded-md" /></td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <div className="h-7 w-7 bg-slate-700 rounded-md" />
                            <div className="h-7 w-7 bg-slate-700 rounded-md" />
                            <div className="h-7 w-7 bg-slate-700 rounded-md" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : rowData.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-12 text-center text-slate-500">
                        {activeWatchlist && activeWatchlist.tickers.length === 0
                          ? "Your watchlist is empty. Add some tickers to get started!"
                          : "No stocks match the selected filters."}
                      </td>
                    </tr>
                  ) : (
                    rowData.map((item, rowIdx) => {
                      const rsiZone =
                        item.rsi === null ? null :
                        item.rsi > 70 ? 'overbought' :
                        item.rsi < 30 ? 'oversold' : 'neutral';

                      const stochZone =
                        item.stochK === null || item.stochK === undefined ? null :
                        item.stochK > 80 ? 'overbought' :
                        item.stochK < 20 ? 'oversold' : 'neutral';

                      const zoneBadge = (zone: 'oversold' | 'overbought' | 'neutral' | null) =>
                        zone === 'oversold'   ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' :
                        zone === 'overbought' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300' :
                        zone === 'neutral'    ? 'bg-slate-700/60 border border-slate-600/40 text-slate-300' :
                                               'text-slate-500';

                      const isExpanded = expandedTicker === item.ticker;

                      const formatMarketCap = (val?: number | null) => {
                        if (!val) return '-';
                        if (val >= 1e12) return `${(val / 1e12).toFixed(2)}T`;
                        if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
                        if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
                        return val.toLocaleString();
                      };

                      return (
                        <Fragment key={item.ticker}>
                          <tr
                            id={`row-${item.ticker}`}
                            draggable
                            onDragStart={() => handleTableDragStart(rowIdx)}
                            onDragOver={(e) => handleTableDragOver(e, rowIdx)}
                            onDrop={() => handleTableDrop(rowIdx)}
                            onDragEnd={handleTableDragEnd}
                            className={`transition-colors ${
                              tableDragOverIdx === rowIdx && tableDragIdx !== rowIdx
                                ? 'bg-blue-500/10 border-t-2 border-t-blue-500'
                                : tableDragIdx === rowIdx
                                ? 'opacity-40 bg-slate-700/20'
                                : isExpanded
                                ? 'bg-slate-700/20'
                                : 'hover:bg-slate-700/20'
                            }`}
                          >
                            <td className="pl-3 pr-1 py-4 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors">
                              <GripVertical size={14} />
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-bold text-slate-200">{item.ticker}</div>
                              {item.timestamp && (
                                <div className="text-[10px] text-slate-500 whitespace-nowrap">
                                  {format(new Date(item.timestamp * 1000), 'MMM dd')}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <Sparkline values={item.closes7d ?? []} />
                                <span className="font-mono text-slate-300 text-sm tabular-nums">
                                  {item.price ? item.price.toLocaleString() : '-'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {item.changePct != null && item.change != null ? (
                                <div className={`inline-flex flex-col px-2 py-0.5 rounded-md font-mono text-xs tabular-nums font-bold ${
                                  item.changePct > 0
                                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                    : item.changePct < 0
                                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                                    : 'bg-slate-700/60 border border-slate-600/40 text-slate-400'
                                }`}>
                                  <span>{item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(2)}%</span>
                                  <span className="text-[9px] font-normal opacity-75 leading-none mt-0.5">
                                    {item.change > 0 ? '+' : ''}{item.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              ) : <span className="text-slate-500 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">
                              {item.pe ? item.pe.toFixed(2) : '-'}
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">
                              {item.eps ? item.eps.toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">
                              {item.beta ? item.beta.toFixed(2) : '-'}
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">
                              {formatMarketCap(item.marketCap)}
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">
                              {item.bookValue ? item.bookValue.toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-4 text-xs font-mono">
                              {(() => {
                                const { bbUpper, bbLower, price } = item;
                                if (!bbUpper || !bbLower || bbUpper === bbLower) return <span className="text-slate-500">-</span>;
                                const pct = (price - bbLower) / (bbUpper - bbLower);
                                const color = pct > 1 ? 'text-rose-400' : pct < 0 ? 'text-emerald-400' : 'text-slate-300';
                                const label = pct > 1 ? '↑ Above' : pct < 0 ? '↓ Below' : 'Inside';
                                return (
                                  <div className={`flex flex-col ${color}`}>
                                    <span>{(pct * 100).toFixed(0)}%</span>
                                    <span className="text-[10px] opacity-70">{label}</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-4">
                              {item.rsi !== null ? (
                                <div className={`inline-flex flex-col items-center px-2 py-0.5 rounded-md font-mono text-xs font-bold tabular-nums ${zoneBadge(rsiZone)}`}>
                                  <span>{item.rsi.toFixed(1)}</span>
                                  {rsiZone !== 'neutral' && (
                                    <span className="text-[9px] font-normal opacity-80 leading-none mt-0.5">
                                      {rsiZone === 'oversold' ? 'OVERSOLD' : 'OVERBOUGHT'}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-slate-500 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-4">
                              {item.stochK !== null && item.stochK !== undefined && item.stochD !== null && item.stochD !== undefined ? (
                                <div className={`inline-flex flex-col px-2 py-0.5 rounded-md font-mono text-xs tabular-nums ${zoneBadge(stochZone)}`}>
                                  <span className="font-bold">K: {item.stochK.toFixed(1)}</span>
                                  <span className="text-[9px] opacity-70 leading-none mt-0.5">D: {item.stochD.toFixed(1)}</span>
                                </div>
                              ) : <span className="text-slate-500 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-4">
                              {item.macdHistogram !== null && item.macdHistogram !== undefined ? (() => {
                                const pos = item.macdHistogram > 0;
                                return (
                                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold tabular-nums ${
                                    pos
                                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                      : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                                  }`}>
                                    <span>{pos ? '▲' : '▼'}</span>
                                    <span>{item.macdHistogram.toFixed(1)}</span>
                                  </div>
                                );
                              })() : <span className="text-slate-500 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => toggleChart(item.ticker)}
                                  className={`p-1.5 rounded-md transition-colors border ${
                                    isExpanded
                                      ? 'bg-slate-700 text-slate-200 border-slate-600'
                                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  }`}
                                  title={isExpanded ? 'Close Chart' : 'View Chart'}
                                >
                                  {isExpanded ? <X size={16} /> : <BarChart2 size={16} />}
                                </button>
                                <button
                                  onClick={() => runAnalysis(item)}
                                  disabled={aiLoading && aiTicker !== item.ticker}
                                  className={`p-1.5 rounded-md transition-colors border ${
                                    aiTicker === item.ticker
                                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                                      : 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20'
                                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                                  title="AI Analysis"
                                >
                                  {aiLoading && aiTicker === item.ticker
                                    ? <RefreshCw size={16} className="animate-spin" />
                                    : <Brain size={16} />
                                  }
                                </button>
                                <button
                                  onClick={() => removeTicker(item.ticker)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                                  title="Remove"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={12} className="p-0">
                                <ChartView ticker={item.ticker} />
                              </td>
                            </tr>
                          )}
                          {aiTicker === item.ticker && (
                            <tr>
                              <td colSpan={12} className="p-0">
                                <AiPanel
                                  ticker={item.ticker}
                                  content={aiContent}
                                  loading={aiLoading}
                                  error={aiError}
                                  onClose={() => setAiTicker(null)}
                                  item={item}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        </> /* end activeTab === 'watchlist' */}
      </main>

      {/* Manage Watchlists Modal */}
      {showManageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) saveManageModal(); }}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <h2 className="font-semibold text-slate-100 text-sm">Manage Watchlists</h2>
              <button onClick={saveManageModal} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Watchlist list */}
            <div className="px-5 py-3 overflow-y-auto flex-1">
              <p className="text-xs text-slate-500 mb-3">Drag to reorder · Click name to rename · ★ is always pinned at top</p>
              <ul className="space-y-1">
                {manageWatchlists.map((w, idx) => {
                  const isMaster = w.id === MASTER_ID;
                  const isRenaming = renamingId === w.id;
                  const nonMasterCount = manageWatchlists.filter(x => x.id !== MASTER_ID).length;
                  return (
                    <li
                      key={w.id}
                      draggable={!isMaster}
                      onDragStart={() => !isMaster && handleDragStart(idx)}
                      onDragOver={(e) => !isMaster && handleDragOver(e, idx)}
                      onDrop={() => !isMaster && handleDrop(idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors select-none ${
                        isMaster
                          ? 'border-slate-700/30 bg-slate-900/20 opacity-60 cursor-default'
                          : dragOverIndex === idx && dragIndex !== idx
                          ? 'border-blue-500 bg-blue-500/10 cursor-grab'
                          : dragIndex === idx
                          ? 'border-slate-600 bg-slate-700/40 opacity-50 cursor-grabbing'
                          : 'border-slate-700/50 bg-slate-900/40 hover:bg-slate-700/30 cursor-grab'
                      }`}
                    >
                      <GripVertical size={14} className={`shrink-0 ${isMaster ? 'text-slate-700' : 'text-slate-500'}`} />

                      {isRenaming ? (
                        <input
                          autoFocus
                          type="text"
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                          className="flex-1 bg-slate-900 border border-blue-500 rounded px-2 py-0.5 text-sm outline-none"
                        />
                      ) : (
                        <span
                          className={`flex-1 text-sm font-medium ${isMaster ? 'text-slate-400' : 'text-slate-200 hover:text-blue-300 cursor-text'}`}
                          onDoubleClick={() => { if (!isMaster) { setRenamingId(w.id); setRenamingValue(w.name); } }}
                          title={isMaster ? undefined : 'Double-click to rename'}
                        >
                          {isMaster ? `★ ${w.name}` : w.name}
                        </span>
                      )}

                      <span className="text-[10px] text-slate-500 shrink-0">{isMaster ? '' : `${w.tickers.length} tickers`}</span>

                      {!isMaster && (
                        <button
                          onClick={() => {
                            if (nonMasterCount <= 1) return;
                            const updated = manageWatchlists.filter(x => x.id !== w.id);
                            setManageWatchlists(updated);
                            if (activeWatchlistId === w.id) setActiveWatchlistId(updated.find(x => x.id !== MASTER_ID)?.id ?? updated[0].id);
                          }}
                          disabled={nonMasterCount <= 1}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-700 flex justify-end shrink-0">
              <button
                onClick={saveManageModal}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors font-medium"
              >
                <Save size={13} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
