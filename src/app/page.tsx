"use client";

import { useEffect, useState, useMemo, Fragment, useRef } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Activity, TrendingUp, TrendingDown, Filter, AlertCircle, RefreshCw,
  BarChart2, X, Plus, Trash2, Brain, GripVertical, Settings2, EyeOff,
  History, Map as MapIcon, SlidersHorizontal, HelpCircle, MoreVertical,
  RefreshCcw, Bell, LayoutGrid, Layers, GitFork, Columns2, PieChart, MessageSquare, UserSearch, ChevronDown,
} from 'lucide-react';

import { type RsiFilter, type MacdFilter, type StochFilter, MASTER_ID } from '@/types';
export type { Watchlist, StockIndicatorResult } from '@/types';

import { useWatchlists } from '@/hooks/useWatchlists';
import { useStockData }  from '@/hooks/useStockData';
import { useAiAnalysis } from '@/hooks/useAiAnalysis';

import { clearSignalHistory } from '@/lib/signalHistory';
import { saveAlerts, clearAlerts } from '@/lib/smartAlerts';

import SignalHistoryPanel from '@/components/SignalHistoryPanel';
import MarketHeatmap      from '@/components/MarketHeatmap';
import MarketStatusBar    from '@/components/MarketStatusBar';
import AdvancedScreener   from '@/components/AdvancedScreener';
import ManageModal        from '@/components/watchlist/ManageModal';
import ChartView          from '@/components/ChartView';
import AiPanel            from '@/components/AiPanel';
import Sparkline          from '@/components/Sparkline';
import SmartAlertsPanel         from '@/components/SmartAlertsPanel';
import MultiChart               from '@/components/MultiChart';
import PatternRecognitionPanel  from '@/components/PatternRecognitionPanel';
import MultiTimeframePanel      from '@/components/MultiTimeframePanel';
import CorrelationMatrix         from '@/components/CorrelationMatrix';
import ComparisonTool            from '@/components/ComparisonTool';
import SectorAnalysis            from '@/components/SectorAnalysis';
import AiChatPanel               from '@/components/AiChatPanel';
import InsiderTracker            from '@/components/InsiderTracker';

type ActiveTab = 'watchlist' | 'history' | 'heatmap' | 'screener' | 'alerts' | 'multicharts' | 'patterns' | 'mtf' | 'correlation' | 'compare' | 'sector' | 'aichat' | 'insider';

export default function Home() {
  const wl = useWatchlists();
  const sd = useStockData(wl.activeWatchlist, wl.activeWatchlistId, wl.masterWatchlist, wl.preventFetch);
  const ai = useAiAnalysis();

  const [rsiFilter,    setRsiFilter]    = useState<RsiFilter>('ALL');
  const [macdFilter,   setMacdFilter]   = useState<MacdFilter>('ALL');
  const [stochFilter,  setStochFilter]  = useState<StochFilter>('ALL');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('watchlist');
  const [rowData,      setRowData]      = useState(sd.data);
  const [tableDragIdx, setTableDragIdx] = useState<number | null>(null);
  const [tableDragOverIdx, setTableDragOverIdx] = useState<number | null>(null);
  const [ignoredSignalTickers, setIgnoredSignalTickers] = useState<string[]>([]);
  const pendingExpandTicker = useRef<string | null>(null);

  useEffect(() => {
    const s = localStorage.getItem('vn_stock_ignored_signals');
    if (s) { try { setIgnoredSignalTickers(JSON.parse(s)); } catch { /* ignore */ } }
  }, []);
  useEffect(() => { localStorage.setItem('vn_stock_ignored_signals', JSON.stringify(ignoredSignalTickers)); }, [ignoredSignalTickers]);

  const filteredData = useMemo(() => sd.data.filter(item => {
    if (item.error) return false;
    const passRsi =
      rsiFilter === 'OVERSOLD'   ? (item.rsi != null && item.rsi < 30) :
      rsiFilter === 'OVERBOUGHT' ? (item.rsi != null && item.rsi > 70) :
      rsiFilter === 'NEUTRAL'    ? (item.rsi != null && item.rsi >= 30 && item.rsi <= 70) : true;
    const passMacd =
      macdFilter === 'BULLISH' ? (item.macd != null && item.macdSignal != null && item.macd > item.macdSignal) :
      macdFilter === 'BEARISH' ? (item.macd != null && item.macdSignal != null && item.macd < item.macdSignal) : true;
    const passStoch =
      stochFilter === 'OVERSOLD'      ? (item.stochK != null && item.stochK < 20) :
      stochFilter === 'OVERBOUGHT'    ? (item.stochK != null && item.stochK > 80) :
      stochFilter === 'BULLISH_CROSS' ? (item.stochK != null && item.stochD != null && item.stochK > item.stochD) :
      stochFilter === 'BEARISH_CROSS' ? (item.stochK != null && item.stochD != null && item.stochK < item.stochD) : true;
    return passRsi && passMacd && passStoch;
  }), [sd.data, rsiFilter, macdFilter, stochFilter]);

  useEffect(() => {
    setRowData(filteredData);
    if (pendingExpandTicker.current) {
      const t = pendingExpandTicker.current;
      if (filteredData.some(d => d.ticker === t)) {
        pendingExpandTicker.current = null;
        setExpandedTicker(t);
        setTimeout(() => document.getElementById(`row-${t}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    }
  }, [filteredData]);

  const { buySignals, sellSignals } = useMemo(() => {
    const buy: { ticker: string; reasons: string[]; entry: number; target: number | null }[] = [];
    const sell: typeof buy = [];
    sd.data.forEach(item => {
      if (item.error || ignoredSignalTickers.includes(item.ticker)) return;
      const br: string[] = []; const sr: string[] = [];
      if (item.rsi != null && item.rsi < 30)  br.push(`RSI ${item.rsi.toFixed(0)}`);
      if (item.rsi != null && item.rsi > 70)  sr.push(`RSI ${item.rsi.toFixed(0)}`);
      if (item.stochK != null && item.stochK < 20) br.push(`Stoch ${item.stochK.toFixed(0)}`);
      if (item.stochK != null && item.stochK > 80) sr.push(`Stoch ${item.stochK.toFixed(0)}`);
      if (item.bbLower != null && item.price < item.bbLower) br.push('BB↓');
      if (item.bbUpper != null && item.price > item.bbUpper) sr.push('BB↑');
      if (br.length) buy.push({ ticker: item.ticker, reasons: br, entry: item.price, target: item.bbMiddle ?? null });
      if (sr.length) sell.push({ ticker: item.ticker, reasons: sr, entry: item.price, target: item.bbMiddle ?? null });
    });
    const byConviction = (a: typeof buy[0], b: typeof buy[0]) => b.reasons.length - a.reasons.length;
    return { buySignals: buy.sort(byConviction), sellSignals: sell.sort(byConviction) };
  }, [sd.data, ignoredSignalTickers]);

  const handleSignalTickerClick = (ticker: string) => {
    if (sd.data.some(d => d.ticker === ticker)) {
      setExpandedTicker(p => p === ticker ? null : ticker);
      setTimeout(() => document.getElementById(`row-${ticker}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } else {
      pendingExpandTicker.current = ticker;
      wl.setActiveWatchlistId(MASTER_ID);
    }
  };

  const handleTableDrop = (toIdx: number) => {
    if (tableDragIdx === null || tableDragIdx === toIdx) { setTableDragIdx(null); setTableDragOverIdx(null); return; }
    const reordered = [...rowData];
    const [moved] = reordered.splice(tableDragIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setRowData(reordered);
    wl.reorderTickers(tableDragIdx, toIdx, reordered.map(r => r.ticker));
    setTableDragIdx(null); setTableDragOverIdx(null);
  };

  const allData = sd.masterData.length > 0 ? sd.masterData : sd.data;
  const fmtCap = (v?: number | null) => !v ? '-' : v >= 1e12 ? `${(v/1e12).toFixed(2)}T` : v >= 1e9 ? `${(v/1e9).toFixed(2)}B` : v >= 1e6 ? `${(v/1e6).toFixed(2)}M` : v.toLocaleString();
  const unreadAlerts = (sd.smartAlerts ?? []).filter(a => !a.dismissed && !a.read).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-10">
      <header className="bg-slate-800 border-b border-slate-700 py-4 px-6 sticky top-0 z-10 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><Activity size={24}/></div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Stock AI</h1>
            <p className="text-xs text-slate-400">Custom Watchlists & Technical Indicators</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {/* ── Primary tabs ── */}
          {([
            { id: 'watchlist'   as ActiveTab, label: 'Watchlist',  icon: <BarChart2 size={13}/>,      cls: 'blue'    },
            { id: 'aichat'      as ActiveTab, label: 'AI Chat',    icon: <MessageSquare size={13}/>,  cls: 'emerald' },
            { id: 'sector'      as ActiveTab, label: 'Ngành',      icon: <PieChart size={13}/>,       cls: 'orange'  },
            { id: 'insider'     as ActiveTab, label: 'Insider',    icon: <UserSearch size={13}/>,     cls: 'rose'    },
            { id: 'compare'     as ActiveTab, label: 'So sánh',    icon: <Columns2 size={13}/>,       cls: 'sky'     },
            { id: 'screener'    as ActiveTab, label: 'Screener',   icon: <SlidersHorizontal size={13}/>, cls: 'amber' },
            { id: 'heatmap'     as ActiveTab, label: 'Heatmap',    icon: <MapIcon size={13}/>,        cls: 'emerald' },
            { id: 'alerts'      as ActiveTab, label: 'Alerts',     icon: <Bell size={13}/>,           cls: 'amber',  badge: unreadAlerts || undefined },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap border ${
                activeTab === tab.id
                  ? `bg-${tab.cls}-500/20 text-${tab.cls}-300 border-${tab.cls}-500/30 font-semibold`
                  : 'text-slate-400 hover:bg-slate-700 border-transparent'
              }`}>
              {tab.icon} {tab.label}
              {tab.badge ? <span className={`px-1.5 py-0.5 bg-${tab.cls}-500/30 text-${tab.cls}-300 rounded-full text-[10px] font-bold leading-none`}>{tab.badge}</span> : null}
            </button>
          ))}

          {/* ── More dropdown ── */}
          {(() => {
            const moreTabs = [
              { id: 'mtf'         as ActiveTab, label: 'MTF',          icon: <Layers size={13}/>,            cls: 'indigo'  },
              { id: 'correlation' as ActiveTab, label: 'Correlation',  icon: <GitFork size={13}/>,           cls: 'teal'    },
              { id: 'multicharts' as ActiveTab, label: 'Multi Chart',  icon: <LayoutGrid size={13}/>,        cls: 'cyan'    },
              { id: 'patterns'    as ActiveTab, label: 'Patterns',     icon: <SlidersHorizontal size={13}/>, cls: 'violet'  },
              { id: 'history'     as ActiveTab, label: 'Lịch sử',      icon: <History size={13}/>,           cls: 'violet', badge: sd.signalHistory.length },
            ];
            const activeInMore = moreTabs.find(t => t.id === activeTab);
            return (
              <div className="relative group">
                <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap border ${
                  activeInMore
                    ? `bg-${activeInMore.cls}-500/20 text-${activeInMore.cls}-300 border-${activeInMore.cls}-500/30 font-semibold`
                    : 'text-slate-400 hover:bg-slate-700 border-transparent'
                }`}>
                  {activeInMore ? <>{activeInMore.icon} {activeInMore.label}</> : <><MoreVertical size={13}/> Thêm</>}
                  <ChevronDown size={11} />
                </button>
                <div className="absolute right-0 top-full mt-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 py-1 hidden group-hover:block">
                  {moreTabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        activeTab === tab.id
                          ? `bg-${tab.cls}-500/20 text-${tab.cls}-300 font-semibold`
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}>
                      {tab.icon} {tab.label}
                      {tab.badge ? <span className="ml-auto px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded-full text-[10px] font-bold">{tab.badge}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <Link href="/guide" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors border border-transparent whitespace-nowrap">
            <HelpCircle size={13}/> Guide
          </Link>
        </div>
      </header>

      <main className="w-full px-4 py-4 space-y-3">
        <MarketStatusBar loading={sd.loading} lastUpdated={sd.lastUpdated} onRefresh={sd.fetchData}/>

        {/* Patterns */}
        {activeTab === 'patterns' && (
          <PatternRecognitionPanel
            data={allData}
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}
          />
        )}

        {/* Multi-Timeframe */}
        {activeTab === 'mtf' && (
          <MultiTimeframePanel
            tickers={wl.activeWatchlist?.tickers ?? []}
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}
          />
        )}

        {/* Correlation Matrix */}
        {activeTab === 'correlation' && (
          <CorrelationMatrix
            tickers={wl.activeWatchlist?.tickers ?? []}
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}
          />
        )}

        {/* Comparison Tool */}
        {activeTab === 'compare' && (
          <ComparisonTool
            tickers={wl.activeWatchlist?.tickers ?? []}
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}
          />
        )}

        {/* Sector Analysis */}
        {activeTab === 'sector' && (
          <SectorAnalysis
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}
          />
        )}

        {/* AI Chat with live context */}
        {activeTab === 'aichat' && (
          <AiChatPanel
            watchlistTickers={wl.activeWatchlist?.tickers ?? []}
            activeTicker={expandedTicker ?? undefined}
          />
        )}

        {/* Insider Trading Tracker */}
        {activeTab === 'insider' && (
          <InsiderTracker
            watchlistTickers={wl.activeWatchlist?.tickers ?? []}
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}
          />
        )}

        {/* Multi Chart */}
        {activeTab === 'multicharts' && (
          <MultiChart data={allData} watchlists={wl.watchlists}
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}/>
        )}

        {/* Alerts */}
        {activeTab === 'alerts' && (
          <SmartAlertsPanel
            alerts={sd.smartAlerts ?? []}
            onMarkAllRead={() => { const u = (sd.smartAlerts ?? []).map(a => ({ ...a, read: true })); sd.setSmartAlerts(u); saveAlerts(u); }}
            onDismiss={(id: string) => { const u = (sd.smartAlerts ?? []).map(a => a.id === id ? { ...a, dismissed: true } : a); sd.setSmartAlerts(u); saveAlerts(u); }}
            onClear={() => { clearAlerts(); sd.setSmartAlerts([]); }}
            onTickerClick={(t: string) => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}
          />
        )}

        {/* History */}
        {activeTab === 'history' && (
          <SignalHistoryPanel logs={sd.signalHistory} onClear={() => { clearSignalHistory(); sd.setSignalHistory([]); }}/>
        )}

        {/* Heatmap */}
        {activeTab === 'heatmap' && (
          <MarketHeatmap data={allData} watchlists={wl.watchlists}
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}/>
        )}

        {/* Screener */}
        {activeTab === 'screener' && (
          <AdvancedScreener data={allData}
            onTickerClick={t => { setActiveTab('watchlist'); handleSignalTickerClick(t); }}/>
        )}

        {/* Watchlist */}
        {activeTab === 'watchlist' && <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <BarChart2 size={15} className="text-blue-400 shrink-0"/>
              <div className="relative">
                <select value={wl.activeWatchlistId} onChange={e => wl.setActiveWatchlistId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-md pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none">
                  {wl.watchlists.map(w => <option key={w.id} value={w.id}>{w.id === MASTER_ID ? `★ ${w.name}` : w.name}</option>)}
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
            <form onSubmit={wl.addTicker} className="flex gap-2">
              <input type="text" placeholder="Add ticker (e.g. VCB)" value={wl.newTicker} onChange={e => wl.setNewTicker(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"/>
              <button type="submit" className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors"><Plus size={15}/></button>
            </form>
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
              <span className="font-bold text-slate-200">{filteredData.length}</span> / {wl.activeWatchlist?.tickers.length || 0} tickers
            </div>
          </div>

          {(buySignals.length > 0 || sellSignals.length > 0) && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Activity size={13} className="text-blue-400"/>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Khuyến Nghị Cổ Phiếu</span>
                {sd.loading && <RefreshCw size={11} className="animate-spin text-slate-400 ml-1"/>}
                <span className="text-xs text-slate-500">— {wl.activeWatchlist?.name ?? 'All Tickers'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-400 tracking-wide">sorted by conviction</span>
              </div>
              {[{ signals: buySignals, dir: 'buy' as const }, { signals: sellSignals, dir: 'sell' as const }].map(({ signals, dir }) =>
                signals.length > 0 ? (
                  <div key={dir} className="flex flex-wrap items-start gap-2">
                    <span className={`flex items-center gap-1 text-xs font-semibold shrink-0 pt-0.5 min-w-[70px] ${dir==='buy'?'text-emerald-400':'text-rose-400'}`}>
                      {dir==='buy'?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {dir==='buy'?'MUA':'BÁN'} ({signals.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {signals.map(({ ticker, reasons, entry, target }) => {
                        const score = reasons.length; const c = dir==='buy'?'emerald':'rose';
                        return (
                          <div key={ticker} onClick={() => handleSignalTickerClick(ticker)}
                            className={`relative flex flex-col px-2.5 py-1.5 border rounded-lg text-xs cursor-pointer hover:brightness-110 transition-all group ${score===3?`bg-${c}-500/25 border-${c}-500/50 ring-1 ring-${c}-500/30`:score===2?`bg-${c}-500/15 border-${c}-500/35`:`bg-${c}-500/10 border-${c}-500/20`}`}>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold text-${c}-300`}>{ticker}</span>
                              <span className={`text-${c}-500/70`}>{reasons.join(' · ')}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono leading-none ${score===3?`bg-${c}-400/20 text-${c}-300 font-bold`:score===2?`bg-${c}-500/15 text-${c}-400`:`bg-slate-700 text-${c}-600`}`}>{score}/3</span>
                              <button onClick={e=>{e.stopPropagation();setIgnoredSignalTickers(p=>[...p,ticker]);}} className="ml-auto p-0.5 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"><EyeOff size={11}/></button>
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                              {target!=null?(<>
                                <span className={`text-${c}-400 font-medium`}>{entry.toLocaleString()}</span>
                                <span className="text-slate-500">-</span>
                                <span className={`text-${c}-300 font-medium`}>{Math.round(target).toLocaleString()}</span>
                                <span className="text-slate-500">(</span>
                                <span className={`text-${c}-300 font-semibold`}>{dir==='buy'?'+':''}{(((target-entry)/entry)*100).toFixed(1)}%</span>
                                <span className="text-slate-500">)</span>
                              </>):<span className={`text-${c}-400 font-medium`}>{entry.toLocaleString()}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}

          <section>
            {sd.error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start gap-3 mb-6">
                <AlertCircle className="shrink-0 mt-0.5"/>
                <div><h3 className="font-semibold">Error Loading Data</h3><p className="text-sm opacity-90">{sd.error}</p></div>
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
                    {sd.loading ? Array.from({length:6}).map((_,i)=>(
                      <tr key={i} className="animate-pulse">
                        <td className="pl-3 pr-1 py-4"><div className="w-3 h-3 bg-slate-700 rounded"/></td>
                        <td className="px-4 py-4"><div className="h-3.5 w-10 bg-slate-700 rounded mb-1.5"/><div className="h-2 w-8 bg-slate-800 rounded"/></td>
                        <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-6 w-16 bg-slate-700 rounded"/><div className="h-3 w-14 bg-slate-700 rounded"/></div></td>
                        <td className="px-4 py-4"><div className="h-7 w-16 bg-slate-700 rounded-md"/></td>
                        {Array.from({length:9}).map((_,j)=><td key={j} className="px-4 py-4"><div className="h-3 w-10 bg-slate-700 rounded"/></td>)}
                        <td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><div className="h-7 w-7 bg-slate-700 rounded-md"/><div className="h-7 w-7 bg-slate-700 rounded-md"/><div className="h-7 w-7 bg-slate-700 rounded-md"/></div></td>
                      </tr>
                    )) : rowData.length===0 ? (
                      <tr><td colSpan={14} className="px-6 py-12 text-center text-slate-500">
                        {wl.activeWatchlist?.tickers.length===0?'Your watchlist is empty. Add some tickers to get started!':'No stocks match the selected filters.'}
                      </td></tr>
                    ) : rowData.map((item,rowIdx)=>{
                      const rsiZone  = item.rsi==null?null:item.rsi>70?'overbought':item.rsi<30?'oversold':'neutral';
                      const stochZone= item.stochK==null?null:item.stochK>80?'overbought':item.stochK<20?'oversold':'neutral';
                      const zoneBadge= (z:typeof rsiZone)=>z==='oversold'?'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300':z==='overbought'?'bg-rose-500/15 border border-rose-500/30 text-rose-300':z==='neutral'?'bg-slate-700/60 border border-slate-600/40 text-slate-300':'text-slate-500';
                      const isExpanded=expandedTicker===item.ticker;
                      return (
                        <Fragment key={item.ticker}>
                          <tr id={`row-${item.ticker}`} draggable
                            onDragStart={()=>setTableDragIdx(rowIdx)} onDragOver={e=>{e.preventDefault();setTableDragOverIdx(rowIdx);}}
                            onDrop={()=>handleTableDrop(rowIdx)} onDragEnd={()=>{setTableDragIdx(null);setTableDragOverIdx(null);}}
                            className={`transition-colors ${tableDragOverIdx===rowIdx&&tableDragIdx!==rowIdx?'bg-blue-500/10 border-t-2 border-t-blue-500':tableDragIdx===rowIdx?'opacity-40 bg-slate-700/20':isExpanded?'bg-slate-700/20':'hover:bg-slate-700/20'}`}>
                            <td className="pl-3 pr-1 py-4 cursor-grab text-slate-600 hover:text-slate-400 transition-colors"><GripVertical size={14}/></td>
                            <td className="px-4 py-4"><div className="font-bold text-slate-200">{item.ticker}</div>{item.timestamp&&<div className="text-[10px] text-slate-500 whitespace-nowrap">{format(new Date(item.timestamp*1000),'MMM dd')}</div>}</td>
                            <td className="px-4 py-4"><div className="flex items-center gap-2"><Sparkline values={item.closes7d??[]}/><span className="font-mono text-slate-300 text-sm tabular-nums">{item.price?item.price.toLocaleString():'-'}</span></div></td>
                            <td className="px-4 py-4">{item.changePct!=null&&item.change!=null?(<div className={`inline-flex flex-col px-2 py-0.5 rounded-md font-mono text-xs tabular-nums font-bold ${item.changePct>0?'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300':item.changePct<0?'bg-rose-500/15 border border-rose-500/30 text-rose-300':'bg-slate-700/60 border border-slate-600/40 text-slate-400'}`}><span>{item.changePct>0?'+':''}{item.changePct.toFixed(2)}%</span><span className="text-[9px] font-normal opacity-75 leading-none mt-0.5">{item.change>0?'+':''}{item.change.toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>):<span className="text-slate-500 text-xs">-</span>}</td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">{item.pe?item.pe.toFixed(2):'-'}</td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">{item.eps?item.eps.toLocaleString():'-'}</td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">{item.beta?item.beta.toFixed(2):'-'}</td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">{fmtCap(item.marketCap)}</td>
                            <td className="px-4 py-4 font-mono text-slate-400 text-xs">{item.bookValue?item.bookValue.toLocaleString():'-'}</td>
                            <td className="px-4 py-4 text-xs font-mono">{(()=>{const{bbUpper,bbLower,price}=item;if(!bbUpper||!bbLower||bbUpper===bbLower)return<span className="text-slate-500">-</span>;const pct=(price-bbLower)/(bbUpper-bbLower);return<div className={`flex flex-col ${pct>1?'text-rose-400':pct<0?'text-emerald-400':'text-slate-300'}`}><span>{(pct*100).toFixed(0)}%</span><span className="text-[10px] opacity-70">{pct>1?'↑ Above':pct<0?'↓ Below':'Inside'}</span></div>;})()}</td>
                            <td className="px-4 py-4">{item.rsi!=null?(<div className={`inline-flex flex-col items-center px-2 py-0.5 rounded-md font-mono text-xs font-bold tabular-nums ${zoneBadge(rsiZone)}`}><span>{item.rsi.toFixed(1)}</span>{rsiZone!=='neutral'&&<span className="text-[9px] font-normal opacity-80 leading-none mt-0.5">{rsiZone==='oversold'?'OVERSOLD':'OVERBOUGHT'}</span>}</div>):<span className="text-slate-500 text-xs">-</span>}</td>
                            <td className="px-4 py-4">{item.stochK!=null&&item.stochD!=null?(<div className={`inline-flex flex-col px-2 py-0.5 rounded-md font-mono text-xs tabular-nums ${zoneBadge(stochZone)}`}><span className="font-bold">K: {item.stochK.toFixed(1)}</span><span className="text-[9px] opacity-70 leading-none mt-0.5">D: {item.stochD.toFixed(1)}</span></div>):<span className="text-slate-500 text-xs">-</span>}</td>
                            <td className="px-4 py-4">{item.macdHistogram!=null?(()=>{const pos=item.macdHistogram>0;return<div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold tabular-nums ${pos?'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300':'bg-rose-500/15 border border-rose-500/30 text-rose-300'}`}><span>{pos?'▲':'▼'}</span><span>{item.macdHistogram.toFixed(1)}</span></div>;})():<span className="text-slate-500 text-xs">-</span>}</td>
                            <td className="px-4 py-4 text-right"><div className="flex justify-end gap-2">
                              <button onClick={()=>setExpandedTicker(p=>p===item.ticker?null:item.ticker)} className={`p-1.5 rounded-md transition-colors border ${isExpanded?'bg-slate-700 text-slate-200 border-slate-600':'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{isExpanded?<X size={16}/>:<BarChart2 size={16}/>}</button>
                              <button onClick={()=>ai.runAnalysis(item)} disabled={ai.aiLoading&&ai.aiTicker!==item.ticker} className={`p-1.5 rounded-md transition-colors border ${ai.aiTicker===item.ticker?'bg-violet-500/20 text-violet-300 border-violet-500/30':'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20'} disabled:opacity-40`}>{ai.aiLoading&&ai.aiTicker===item.ticker?<RefreshCw size={16} className="animate-spin"/>:<Brain size={16}/>}</button>
                              <button onClick={()=>wl.removeTicker(item.ticker)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"><Trash2 size={16}/></button>
                            </div></td>
                          </tr>
                          {isExpanded&&<tr><td colSpan={14} className="p-0"><ChartView ticker={item.ticker}/></td></tr>}
                          {ai.aiTicker===item.ticker&&<tr><td colSpan={14} className="p-0"><AiPanel ticker={item.ticker} content={ai.aiContent} loading={ai.aiLoading} error={ai.aiError} onClose={ai.closeAi} item={item}/></td></tr>}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>}
      </main>

      <ManageModal
        show={wl.showManageModal} manageWatchlists={wl.manageWatchlists} setManageWatchlists={wl.setManageWatchlists}
        activeWatchlistId={wl.activeWatchlistId} setActiveWatchlistId={wl.setActiveWatchlistId}
        renamingId={wl.renamingId} setRenamingId={wl.setRenamingId}
        renamingValue={wl.renamingValue} setRenamingValue={wl.setRenamingValue}
        dragIndex={wl.dragIndex} dragOverIndex={wl.dragOverIndex}
        commitRename={wl.commitRename} saveManageModal={wl.saveManageModal}
        handleModalDragStart={wl.handleModalDragStart} handleModalDragOver={wl.handleModalDragOver}
        handleModalDrop={wl.handleModalDrop} handleModalDragEnd={wl.handleModalDragEnd}
      />
    </div>
  );
}
