"use client";

import { useEffect, useState, useMemo, Fragment, useCallback } from 'react';
import { format } from 'date-fns';
import { Activity, TrendingUp, TrendingDown, Filter, AlertCircle, RefreshCw, BarChart2, X, Plus, Trash2, Edit2, Save, MoreVertical, Brain } from 'lucide-react';

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
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <BarChart2 className="text-blue-400" /> {ticker} - 6 Months Price History
      </h3>
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
            <Line yAxisId="price" type="monotone" dataKey="ma10" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA10" connectNulls />
            <Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="MA20" connectNulls />
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

function AiPanel({
  ticker, content, loading, error, onClose,
}: {
  ticker: string;
  content: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const recMatch = content.match(/RECOMMENDATION:\s*(BUY|SELL|HOLD|OBSERVABLE)/);
  const rec = recMatch ? REC_CONFIG[recMatch[1]] : null;
  // Strip the first RECOMMENDATION line from display to avoid duplication
  const bodyText = content.replace(/^RECOMMENDATION:\s*(BUY|SELL|HOLD|OBSERVABLE)\n?/, '');

  return (
    <div className="bg-slate-900 border-t border-violet-500/20 p-6">
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
      {error && (
        <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
          {error}
        </div>
      )}
      {!error && (
        <div className="prose prose-invert prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
            {bodyText || (loading ? '' : 'No content.')}
            {loading && <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />}
          </pre>
        </div>
      )}
    </div>
  );
}

const MASTER_ID = 'master';

export default function Home() {
  const [data, setData] = useState<StockIndicatorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTicker, setNewTicker] = useState('');

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
  }, []);

  const activeWatchlist = useMemo(() => 
    watchlists.find(w => w.id === activeWatchlistId)
  , [watchlists, activeWatchlistId]);

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
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [activeWatchlist]);

  // Fetch data when active watchlist or its tickers change
  useEffect(() => {
    if (activeWatchlistId) {
      fetchData();
    }
  }, [activeWatchlistId, fetchData]);

  // Sync to localStorage
  useEffect(() => {
    if (watchlists.length > 0) {
      localStorage.setItem('vn_stock_watchlists', JSON.stringify(watchlists));
    }
  }, [watchlists]);

  const createWatchlist = () => {
    const id = Date.now().toString();
    const newList: Watchlist = { id, name: 'New Watchlist', tickers: [] };
    setWatchlists([...watchlists, newList]);
    setActiveWatchlistId(id);
    setIsEditingName(true);
    setNewName('New Watchlist');
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

  const renameWatchlist = () => {
    if (!newName.trim()) {
      setIsEditingName(false);
      return;
    }
    setWatchlists(watchlists.map(w => 
      w.id === activeWatchlistId ? { ...w, name: newName } : w
    ));
    setIsEditingName(false);
  };

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

  const toggleChart = (ticker: string) => {
    if (expandedTicker === ticker) {
      setExpandedTicker(null);
    } else {
      setExpandedTicker(ticker);
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
          rsi: item.rsi,
          stochK: item.stochK,
          stochD: item.stochD,
          macd: item.macd,
          macdSignal: item.macdSignal,
          macdHistogram: item.macdHistogram,
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
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData} 
            disabled={loading || !activeWatchlist || activeWatchlist.tickers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-1 space-y-6">
          {/* Watchlist Management */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <BarChart2 size={18} className="text-blue-400" /> Watchlist
              </h2>
              <button 
                onClick={createWatchlist}
                className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-blue-400 transition-colors"
                title="Create new watchlist"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <select
                  value={activeWatchlistId}
                  onChange={(e) => setActiveWatchlistId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                >
                  {watchlists.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.id === MASTER_ID ? `★ ${w.name}` : w.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                  <MoreVertical size={14} />
                </div>
              </div>

              {activeWatchlist && (
                activeWatchlistId === MASTER_ID ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">Aggregates all tickers from every other watchlist.</p>
                    <button
                      onClick={syncMasterWatchlist}
                      className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md text-xs transition-colors"
                    >
                      <RefreshCw size={12} /> Sync from all watchlists
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {isEditingName ? (
                      <div className="flex w-full gap-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onBlur={renameWatchlist}
                          onKeyDown={(e) => e.key === 'Enter' && renameWatchlist()}
                          autoFocus
                          className="flex-1 bg-slate-900 border border-blue-500 rounded-md px-2 py-1 text-sm outline-none"
                        />
                        <button onClick={renameWatchlist} className="text-emerald-400"><Save size={18}/></button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { setIsEditingName(true); setNewName(activeWatchlist.name); }}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-xs transition-colors"
                        >
                          <Edit2 size={12} /> Rename
                        </button>
                        <button
                          onClick={deleteWatchlist}
                          disabled={watchlists.filter(w => w.id !== MASTER_ID).length <= 1}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-md text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                )
              )}

              <form onSubmit={addTicker} className="flex gap-2 pt-2 border-t border-slate-700/50">
                <input 
                  type="text"
                  placeholder="Add ticker (e.g. VCB)"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button 
                  type="submit"
                  className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors"
                >
                  <Plus size={16} />
                </button>
              </form>
            </div>
          </div>

          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2 mb-4 text-slate-200">
              <Filter size={18} />
              <h2 className="font-semibold text-lg">Filters</h2>
            </div>
            
            <div className="space-y-5">
              {/* RSI Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">RSI (Relative Strength Index)</label>
                <div className="space-y-2">
                  {(['ALL', 'OVERSOLD', 'NEUTRAL', 'OVERBOUGHT'] as RsiFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setRsiFilter(f)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex justify-between items-center ${
                        rsiFilter === f 
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                          : 'hover:bg-slate-700 text-slate-300 border border-transparent'
                      }`}
                    >
                      <span>
                        {f === 'ALL' && 'All Conditions'}
                        {f === 'OVERSOLD' && 'Oversold (< 30)'}
                        {f === 'NEUTRAL' && 'Neutral (30 - 70)'}
                        {f === 'OVERBOUGHT' && 'Overbought (> 70)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* MACD Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">MACD Trend</label>
                <div className="space-y-2">
                  {(['ALL', 'BULLISH', 'BEARISH'] as MacdFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setMacdFilter(f)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex justify-between items-center ${
                        macdFilter === f 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'hover:bg-slate-700 text-slate-300 border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {f === 'BULLISH' && <TrendingUp size={16} className="text-emerald-400"/>}
                        {f === 'BEARISH' && <TrendingDown size={16} className="text-rose-400"/>}
                        {f === 'ALL' && 'All Trends'}
                        {f !== 'ALL' && (f === 'BULLISH' ? 'Bullish (MACD > Signal)' : 'Bearish (MACD < Signal)')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stoch RSI Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Stochastic RSI</label>
                <div className="space-y-2">
                  {(['ALL', 'OVERSOLD', 'OVERBOUGHT', 'BULLISH_CROSS', 'BEARISH_CROSS'] as StochFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setStochFilter(f)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex justify-between items-center ${
                        stochFilter === f 
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                          : 'hover:bg-slate-700 text-slate-300 border border-transparent'
                      }`}
                    >
                      <span>
                        {f === 'ALL' && 'All Conditions'}
                        {f === 'OVERSOLD' && 'Oversold (< 20)'}
                        {f === 'OVERBOUGHT' && 'Overbought (> 80)'}
                        {f === 'BULLISH_CROSS' && 'Bullish Cross (K > D)'}
                        {f === 'BEARISH_CROSS' && 'Bearish Cross (K < D)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                <p className="text-2xl font-bold text-slate-200">{filteredData.length}</p>
                <p className="text-xs text-slate-500">Matching</p>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                <p className="text-2xl font-bold text-slate-200">{activeWatchlist?.tickers.length || 0}</p>
                <p className="text-xs text-slate-500">In Watchlist</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="lg:col-span-3">
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
                    <th className="px-4 py-4 font-medium">Ticker</th>
                    <th className="px-4 py-4 font-medium">Price</th>
                    <th className="px-4 py-4 font-medium">P/E</th>
                    <th className="px-4 py-4 font-medium">EPS</th>
                    <th className="px-4 py-4 font-medium">Beta</th>
                    <th className="px-4 py-4 font-medium">Mkt Cap</th>
                    <th className="px-4 py-4 font-medium">BV/Share</th>
                    <th className="px-4 py-4 font-medium">RSI</th>
                    <th className="px-4 py-4 font-medium">Stoch RSI</th>
                    <th className="px-4 py-4 font-medium">MACD Hist</th>
                    <th className="px-4 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <RefreshCw size={24} className="animate-spin text-blue-500" />
                          <p>Analyzing technical indicators...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                        {activeWatchlist && activeWatchlist.tickers.length === 0 
                          ? "Your watchlist is empty. Add some tickers to get started!" 
                          : "No stocks match the selected filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item) => {
                      const rsiColor = 
                        item.rsi === null ? 'text-slate-400' :
                        item.rsi > 70 ? 'text-rose-400' : 
                        item.rsi < 30 ? 'text-emerald-400' : 
                        'text-slate-300';
                        
                      const stochColor = 
                        (item.stochK === null || item.stochD === null) ? 'text-slate-400' :
                        item.stochK > 80 ? 'text-rose-400' :
                        item.stochK < 20 ? 'text-emerald-400' :
                        'text-slate-300';

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
                          <tr className={`hover:bg-slate-700/20 transition-colors ${isExpanded ? 'bg-slate-700/20' : ''}`}>
                            <td className="px-4 py-4">
                              <div className="font-bold text-slate-200">{item.ticker}</div>
                              {item.timestamp && (
                                <div className="text-[10px] text-slate-500 whitespace-nowrap">
                                  {format(new Date(item.timestamp * 1000), 'MMM dd')}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-300 text-sm">
                              {item.price ? item.price.toLocaleString() : '-'}
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
                            <td className={`px-4 py-4 font-mono font-medium text-sm ${rsiColor}`}>
                              {item.rsi !== null ? item.rsi.toFixed(2) : '-'}
                            </td>
                            <td className={`px-4 py-4 font-mono text-sm ${stochColor}`}>
                              {item.stochK !== null && item.stochK !== undefined && item.stochD !== null && item.stochD !== undefined ? (
                                <div className="flex flex-col">
                                  <span>K: {item.stochK.toFixed(1)}</span>
                                  <span className="text-[10px] opacity-70 text-slate-400">D: {item.stochD.toFixed(1)}</span>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-4">
                              {item.macdHistogram !== null && item.macdHistogram !== undefined ? (
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono text-xs ${item.macdHistogram > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {item.macdHistogram.toFixed(1)}
                                  </span>
                                </div>
                              ) : '-'}
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
                              <td colSpan={11} className="p-0">
                                <ChartView ticker={item.ticker} />
                              </td>
                            </tr>
                          )}
                          {aiTicker === item.ticker && (
                            <tr>
                              <td colSpan={11} className="p-0">
                                <AiPanel
                                  ticker={item.ticker}
                                  content={aiContent}
                                  loading={aiLoading}
                                  error={aiError}
                                  onClose={() => setAiTicker(null)}
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
      </main>
    </div>
  );
}
