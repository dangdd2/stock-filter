import { Fragment } from 'react';
import { format } from 'date-fns';
import {
  BarChart2, MoreVertical, RefreshCcw, Settings2, Plus, Filter, Info,
  AlertCircle, GripVertical, X, Brain, RefreshCw, Trash2,
} from 'lucide-react';
import { MASTER_ID, type RsiFilter, type MacdFilter, type StochFilter, type StockIndicatorResult, type Watchlist } from '@/types';
import Sparkline from '@/components/Sparkline';
import SignalRecommendationPanel from '@/components/watchlist/SignalRecommendationPanel';
import type { SignalEntry } from '@/hooks/useTickerSignals';
import type { UseWatchlistsReturn } from '@/hooks/useWatchlists';

const fmtCap = (v?: number | null) =>
  !v ? '-' : v >= 1e12 ? `${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v.toLocaleString();

interface Props {
  wl: UseWatchlistsReturn;
  rowData: StockIndicatorResult[];
  loading: boolean;
  error: string | null;
  filteredCount: number;
  rsiFilter: RsiFilter; setRsiFilter: (v: RsiFilter) => void;
  macdFilter: MacdFilter; setMacdFilter: (v: MacdFilter) => void;
  stochFilter: StochFilter; setStochFilter: (v: StochFilter) => void;
  buySignals: SignalEntry[];
  sellSignals: SignalEntry[];
  onIgnoreTicker: (ticker: string) => void;
  expandedTicker: string | null;
  onOpenChart: (ticker: string) => void;
  onOpenAi: (ticker: string, item: StockIndicatorResult) => void;
  onTickerClick: (ticker: string) => void;
  aiTicker: string | null;
  aiLoading: boolean;
  tableDragIdx: number | null;
  tableDragOverIdx: number | null;
  onTableDragStart: (idx: number) => void;
  onTableDragOver: (idx: number) => void;
  onTableDrop: (idx: number) => void;
  onTableDragEnd: () => void;
}

export default function WatchlistView({
  wl, rowData, loading, error, filteredCount,
  rsiFilter, setRsiFilter, macdFilter, setMacdFilter, stochFilter, setStochFilter,
  buySignals, sellSignals, onIgnoreTicker,
  expandedTicker, onOpenChart, onOpenAi, onTickerClick,
  aiTicker, aiLoading,
  tableDragIdx, tableDragOverIdx, onTableDragStart, onTableDragOver, onTableDrop, onTableDragEnd,
}: Props) {
  return (
    <>
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} className="text-blue-400 shrink-0"/>
          <div className="relative">
            <select value={wl.activeWatchlistId} onChange={e => wl.setActiveWatchlistId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none">
              {wl.watchlists.map((w: Watchlist) => <option key={w.id} value={w.id}>{w.id === MASTER_ID ? `★ ${w.name}` : w.name}</option>)}
            </select>
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-500"><MoreVertical size={13}/></div>
          </div>
        </div>
        {wl.activeWatchlist && (wl.activeWatchlistId === MASTER_ID ? (
          <button onClick={wl.syncMasterWatchlist} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md text-xs transition-colors">
            <RefreshCcw size={12}/> Sync
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={wl.openManageModal} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-xs transition-colors"><Settings2 size={12}/> Manage</button>
            <button onClick={wl.createWatchlist} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-md text-xs transition-colors"><Plus size={12}/> New</button>
          </div>
        ))}

        {wl.activeWatchlistId === MASTER_ID ? (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-900/50 border border-slate-700/50 rounded-md px-2.5 py-1.5">
            <Info size={12} className="text-slate-500 shrink-0" />
            <span>&quot;All Tickers&quot; tự tổng hợp từ các watchlist con — chọn watchlist khác để thêm mã.</span>
          </div>
        ) : (
          <form onSubmit={wl.addTicker} className="flex gap-2">
            <input type="text" placeholder="Add ticker (e.g. VCB)" value={wl.newTicker} onChange={e => wl.setNewTicker(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"/>
            <button type="submit" className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors"><Plus size={15}/></button>
          </form>
        )}

        <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block"/>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400 shrink-0"/>
          {[
            { val: rsiFilter,   set: setRsiFilter,   opts: [['ALL','RSI: All'],['OVERSOLD','RSI < 30'],['NEUTRAL','RSI 30–70'],['OVERBOUGHT','RSI > 70']] },
            { val: macdFilter,  set: setMacdFilter,  opts: [['ALL','MACD: All'],['BULLISH','Bullish'],['BEARISH','Bearish']] },
            { val: stochFilter, set: setStochFilter, opts: [['ALL','Stoch: All'],['OVERSOLD','Oversold < 20'],['OVERBOUGHT','Overbought > 80'],['BULLISH_CROSS','Bullish Cross'],['BEARISH_CROSS','Bearish Cross']] },
          ].map(({ val, set, opts }, i) => (
            <select key={i} value={val} onChange={e => (set as (v: string) => void)(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>
        <div className="ml-auto text-xs text-slate-400">
          <span className="font-bold text-slate-200">{filteredCount}</span> / {wl.activeWatchlist?.tickers.length || 0} tickers
        </div>
      </div>

      <SignalRecommendationPanel
        buySignals={buySignals}
        sellSignals={sellSignals}
        watchlistName={wl.activeWatchlist?.name ?? 'All Tickers'}
        loading={loading}
        onTickerClick={onTickerClick}
        onIgnoreTicker={onIgnoreTicker}
      />

      <section>
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start gap-3 mb-6">
            <AlertCircle className="shrink-0 mt-0.5"/>
            <div><h3 className="font-semibold">Error Loading Data</h3><p className="text-sm opacity-90">{error}</p></div>
          </div>
        )}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-[10px] uppercase tracking-wider">
                  <th className="pl-3 pr-1 py-4 w-6"/><th className="px-4 py-4 font-medium">Ticker</th>
                  <th className="px-4 py-4 font-medium">Price</th><th className="px-4 py-4 font-medium">Change</th>
                  <th className="px-4 py-4 font-medium">P/E</th><th className="px-4 py-4 font-medium">EPS</th>
                  <th className="px-4 py-4 font-medium">Beta</th><th className="px-4 py-4 font-medium">Mkt Cap</th>
                  <th className="px-4 py-4 font-medium">BV/Share</th><th className="px-4 py-4 font-medium">BB %B</th>
                  <th className="px-4 py-4 font-medium">RSI</th><th className="px-4 py-4 font-medium">Stoch RSI</th>
                  <th className="px-4 py-4 font-medium">MACD Hist</th><th className="px-4 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="pl-3 pr-1 py-4"><div className="w-3 h-3 bg-slate-700 rounded"/></td>
                    <td className="px-4 py-4"><div className="h-3.5 w-10 bg-slate-700 rounded mb-1.5"/><div className="h-2 w-8 bg-slate-800 rounded"/></td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-6 w-16 bg-slate-700 rounded"/><div className="h-3 w-14 bg-slate-700 rounded"/></div></td>
                    <td className="px-4 py-4"><div className="h-7 w-16 bg-slate-700 rounded-md"/></td>
                    {Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-4"><div className="h-3 w-10 bg-slate-700 rounded"/></td>)}
                    <td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><div className="h-7 w-7 bg-slate-700 rounded-md"/><div className="h-7 w-7 bg-slate-700 rounded-md"/><div className="h-7 w-7 bg-slate-700 rounded-md"/></div></td>
                  </tr>
                )) : rowData.length === 0 ? (
                  <tr><td colSpan={14} className="px-6 py-12 text-center text-slate-500">
                    {wl.activeWatchlist?.tickers.length === 0 ? 'Your watchlist is empty. Add some tickers to get started!' : 'No stocks match the selected filters.'}
                  </td></tr>
                ) : rowData.map((item, rowIdx) => {
                  const rsiZone   = item.rsi == null ? null : item.rsi > 70 ? 'overbought' : item.rsi < 30 ? 'oversold' : 'neutral';
                  const stochZone = item.stochK == null ? null : item.stochK > 80 ? 'overbought' : item.stochK < 20 ? 'oversold' : 'neutral';
                  const zoneBadge = (z: typeof rsiZone) => z === 'oversold' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : z === 'overbought' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300' : z === 'neutral' ? 'bg-slate-700/60 border border-slate-600/40 text-slate-300' : 'text-slate-500';
                  const isExpanded = expandedTicker === item.ticker;
                  return (
                    <Fragment key={item.ticker}>
                      <tr id={`row-${item.ticker}`} draggable
                        onDragStart={() => onTableDragStart(rowIdx)} onDragOver={e => { e.preventDefault(); onTableDragOver(rowIdx); }}
                        onDrop={() => onTableDrop(rowIdx)} onDragEnd={onTableDragEnd}
                        className={`transition-colors ${tableDragOverIdx === rowIdx && tableDragIdx !== rowIdx ? 'bg-blue-500/10 border-t-2 border-t-blue-500' : tableDragIdx === rowIdx ? 'opacity-40 bg-slate-700/20' : isExpanded ? 'bg-slate-700/20' : 'hover:bg-slate-700/20'}`}>
                        <td className="pl-3 pr-1 py-4 cursor-grab text-slate-600 hover:text-slate-400 transition-colors"><GripVertical size={14}/></td>
                        <td className="px-4 py-4"><div className="font-bold text-slate-200">{item.ticker}</div>{item.timestamp && <div className="text-[10px] text-slate-500 whitespace-nowrap">{format(new Date(item.timestamp * 1000), 'MMM dd')}</div>}</td>
                        <td className="px-4 py-4"><div className="flex items-center gap-2"><Sparkline values={item.closes7d ?? []}/><span className="font-mono text-slate-300 text-sm tabular-nums">{item.price ? item.price.toLocaleString() : '-'}</span></div></td>
                        <td className="px-4 py-4">{item.changePct != null && item.change != null ? (<div className={`inline-flex flex-col px-2 py-0.5 rounded-md font-mono text-xs tabular-nums font-bold ${item.changePct > 0 ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : item.changePct < 0 ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300' : 'bg-slate-700/60 border border-slate-600/40 text-slate-400'}`}><span>{item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(2)}%</span><span className="text-[9px] font-normal opacity-75 leading-none mt-0.5">{item.change > 0 ? '+' : ''}{item.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>) : <span className="text-slate-500 text-xs">-</span>}</td>
                        <td className="px-4 py-4 font-mono text-slate-400 text-xs">{item.pe ? item.pe.toFixed(2) : '-'}</td>
                        <td className="px-4 py-4 font-mono text-slate-400 text-xs">{item.eps ? item.eps.toLocaleString() : '-'}</td>
                        <td className="px-4 py-4 font-mono text-slate-400 text-xs">{item.beta ? item.beta.toFixed(2) : '-'}</td>
                        <td className="px-4 py-4 font-mono text-slate-400 text-xs">{fmtCap(item.marketCap)}</td>
                        <td className="px-4 py-4 font-mono text-slate-400 text-xs">{item.bookValue ? item.bookValue.toLocaleString() : '-'}</td>
                        <td className="px-4 py-4 text-xs font-mono">{(() => { const { bbUpper, bbLower, price } = item; if (!bbUpper || !bbLower || bbUpper === bbLower) return <span className="text-slate-500">-</span>; const pct = (price - bbLower) / (bbUpper - bbLower); return <div className={`flex flex-col ${pct > 1 ? 'text-rose-400' : pct < 0 ? 'text-emerald-400' : 'text-slate-300'}`}><span>{(pct * 100).toFixed(0)}%</span><span className="text-[10px] opacity-70">{pct > 1 ? '↑ Above' : pct < 0 ? '↓ Below' : 'Inside'}</span></div>; })()}</td>
                        <td className="px-4 py-4">{item.rsi != null ? (<div className={`inline-flex flex-col items-center px-2 py-0.5 rounded-md font-mono text-xs font-bold tabular-nums ${zoneBadge(rsiZone)}`}><span>{item.rsi.toFixed(1)}</span>{rsiZone !== 'neutral' && <span className="text-[9px] font-normal opacity-80 leading-none mt-0.5">{rsiZone === 'oversold' ? 'OVERSOLD' : 'OVERBOUGHT'}</span>}</div>) : <span className="text-slate-500 text-xs">-</span>}</td>
                        <td className="px-4 py-4">{item.stochK != null && item.stochD != null ? (<div className={`inline-flex flex-col px-2 py-0.5 rounded-md font-mono text-xs tabular-nums ${zoneBadge(stochZone)}`}><span className="font-bold">K: {item.stochK.toFixed(1)}</span><span className="text-[9px] opacity-70 leading-none mt-0.5">D: {item.stochD.toFixed(1)}</span></div>) : <span className="text-slate-500 text-xs">-</span>}</td>
                        <td className="px-4 py-4">{item.macdHistogram != null ? (() => { const pos = item.macdHistogram! > 0; return <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold tabular-nums ${pos ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'}`}><span>{pos ? '▲' : '▼'}</span><span>{item.macdHistogram!.toFixed(1)}</span></div>; })() : <span className="text-slate-500 text-xs">-</span>}</td>
                        <td className="px-4 py-4 text-right"><div className="flex justify-end gap-2">
                          <button onClick={() => onOpenChart(item.ticker)} className={`p-1.5 rounded-md transition-colors border ${isExpanded ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{isExpanded ? <X size={16}/> : <BarChart2 size={16}/>}</button>
                          <button onClick={() => onOpenAi(item.ticker, item)} disabled={aiLoading && aiTicker !== item.ticker} className={`p-1.5 rounded-md transition-colors border ${aiTicker === item.ticker ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20'} disabled:opacity-40`}>{aiLoading && aiTicker === item.ticker ? <RefreshCw size={16} className="animate-spin"/> : <Brain size={16}/>}</button>
                          <button onClick={() => wl.removeTicker(item.ticker)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"><Trash2 size={16}/></button>
                        </div></td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
