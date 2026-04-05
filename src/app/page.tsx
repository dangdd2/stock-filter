"use client";

import { useEffect, useState, useMemo, Fragment, useCallback } from 'react';
import { format } from 'date-fns';
import { Activity, TrendingUp, TrendingDown, Filter, AlertCircle, RefreshCw, BarChart2, X, Plus, Trash2, Edit2, Save, MoreVertical } from 'lucide-react';

export interface Watchlist {
  id: string;
  name: string;
  tickers: string[];
}
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, ReferenceLine, Cell } from 'recharts';

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
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  stochK?: number;
  stochD?: number;
}

interface CandlestickProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartDataPoint;
  yAxis?: {
    scale: (val: number) => number;
  };
}

const Candlestick = (props: CandlestickProps) => {
  const { x, y, width, height, payload, yAxis } = props;

  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) {
    return null;
  }

  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? '#10b981' : '#f43f5e';
  const wickX = x + width / 2;

  // For wicks, we use the scale function if available
  let highY = y;
  let lowY = y + height;
  
  if (yAxis && typeof yAxis.scale === 'function') {
    highY = yAxis.scale(high);
    lowY = yAxis.scale(low);
  }

  return (
    <g>
      {/* Wick */}
      <line
        x1={wickX}
        y1={highY}
        x2={wickX}
        y2={lowY}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 2)} // Ensure at least 2px height for Doji
        fill={color}
      />
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
        const formatted = json.map((d) => ({
          ...d,
          dateStr: format(new Date(d.time * 1000), 'MMM dd'),
          // Range for the Bar component
          ohlc: [Math.min(d.open, d.close), Math.max(d.open, d.close)] as [number, number],
        }));
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

  return (
    <div className="p-6 bg-slate-900 border-t border-slate-700">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <BarChart2 className="text-blue-400" /> {ticker} - 3 Months Price History
      </h3>
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={12} tickMargin={10} minTickGap={30} />
            <YAxis 
              domain={[minPrice * 0.98, maxPrice * 1.02]} 
              stroke="#94a3b8" 
              fontSize={12} 
              tickFormatter={(val) => val.toLocaleString()} 
              orientation="right"
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
              itemStyle={{ color: '#60a5fa' }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
              formatter={(value: unknown, name: string, props: { payload: ChartDataPoint }) => {
                if (name === 'OHLC' && props.payload) {
                  const { open, high, low, close } = props.payload;
                  return [
                    `O: ${open.toLocaleString()} H: ${high.toLocaleString()} L: ${low.toLocaleString()} C: ${close.toLocaleString()}`,
                    'Price'
                  ];
                }
                return [value as string, name];
              }}
            />
            <Bar 
              dataKey="ohlc" 
              name="OHLC"
              shape={<Candlestick />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="h-[150px] w-full mt-6">
        <h4 className="text-sm font-semibold mb-2 text-slate-400">MACD (12, 26, 9)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={12} hide />
            <YAxis stroke="#94a3b8" fontSize={12} />
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

      <div className="h-[150px] w-full mt-8">
        <h4 className="text-sm font-semibold mb-2 text-slate-400">Stochastic RSI (14, 14, 3, 3)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={12} hide />
            <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} ticks={[0, 20, 80, 100]} />
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

export default function Home() {
  const [data, setData] = useState<StockIndicatorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rsiFilter, setRsiFilter] = useState<RsiFilter>('ALL');
  const [macdFilter, setMacdFilter] = useState<MacdFilter>('ALL');
  const [stochFilter, setStochFilter] = useState<StochFilter>('ALL');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // Watchlist state
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTicker, setNewTicker] = useState('');

  // Initial load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vn_stock_watchlists');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Watchlist[];
        setWatchlists(parsed);
        if (parsed.length > 0) {
          setActiveWatchlistId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to parse watchlists', e);
      }
    } else {
      // Default watchlist if none exists
      const defaultWatchlist: Watchlist = {
        id: 'default',
        name: 'Main Watchlist',
        tickers: ['ACB', 'SHB', 'VCB', 'TCB', 'VPB', 'MBB', 'STB']
      };
      setWatchlists([defaultWatchlist]);
      setActiveWatchlistId('default');
      localStorage.setItem('vn_stock_watchlists', JSON.stringify([defaultWatchlist]));
    }
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
    if (watchlists.length <= 1) return;
    const remaining = watchlists.filter(w => w.id !== activeWatchlistId);
    setWatchlists(remaining);
    setActiveWatchlistId(remaining[0].id);
  };

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
    const ticker = newTicker.trim().toUpperCase();
    if (activeWatchlist.tickers.includes(ticker)) {
      setNewTicker('');
      return;
    }
    
    setWatchlists(watchlists.map(w => 
      w.id === activeWatchlistId ? { ...w, tickers: [...w.tickers, ticker] } : w
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-10">
      <header className="bg-slate-800 border-b border-slate-700 py-4 px-6 sticky top-0 z-10 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">VN Stock Filter</h1>
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
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                  <MoreVertical size={14} />
                </div>
              </div>

              {activeWatchlist && (
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
                        disabled={watchlists.length <= 1}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-md text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </>
                  )}
                </div>
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
                  <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Ticker</th>
                    <th className="px-6 py-4 font-medium">Price</th>
                    <th className="px-6 py-4 font-medium">RSI</th>
                    <th className="px-6 py-4 font-medium">Stoch RSI</th>
                    <th className="px-6 py-4 font-medium">MACD Hist</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <RefreshCw size={24} className="animate-spin text-blue-500" />
                          <p>Analyzing technical indicators...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
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

                      return (
                        <Fragment key={item.ticker}>
                          <tr className={`hover:bg-slate-700/20 transition-colors ${isExpanded ? 'bg-slate-700/20' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-200">{item.ticker}</div>
                              {item.timestamp && (
                                <div className="text-[10px] text-slate-500">
                                  {format(new Date(item.timestamp * 1000), 'MMM dd, yyyy')}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-300 text-sm">
                              {item.price ? item.price.toLocaleString() : '-'}
                            </td>
                            <td className={`px-6 py-4 font-mono font-medium text-sm ${rsiColor}`}>
                              {item.rsi !== null ? item.rsi.toFixed(2) : '-'}
                            </td>
                            <td className={`px-6 py-4 font-mono text-sm ${stochColor}`}>
                              {item.stochK !== null && item.stochK !== undefined && item.stochD !== null && item.stochD !== undefined ? (
                                <div className="flex flex-col">
                                  <span>K: {item.stochK.toFixed(2)}</span>
                                  <span className="text-[10px] opacity-70 text-slate-400">D: {item.stochD.toFixed(2)}</span>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4">
                              {item.macdHistogram !== null && item.macdHistogram !== undefined ? (
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono text-xs ${item.macdHistogram > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {item.macdHistogram.toFixed(2)}
                                  </span>
                                  <div className="w-12 h-4 bg-slate-900 rounded overflow-hidden flex items-center">
                                    <div 
                                      className={`h-full ${item.macdHistogram > 0 ? 'bg-emerald-500' : 'bg-rose-500'} transition-all`}
                                      style={{ 
                                        width: `${Math.min(100, Math.abs(item.macdHistogram) * 10)}%`,
                                        marginLeft: item.macdHistogram < 0 ? 'auto' : '0',
                                        marginRight: item.macdHistogram > 0 ? 'auto' : '0'
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => toggleChart(item.ticker)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                                    isExpanded 
                                      ? 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600' 
                                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                                  }`}
                                >
                                  {isExpanded ? <X size={14} /> : <BarChart2 size={14} />}
                                  {isExpanded ? 'Close' : 'Chart'}
                                </button>
                                <button
                                  onClick={() => removeTicker(item.ticker)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                                  title="Remove from watchlist"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-0">
                                <ChartView ticker={item.ticker} />
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
