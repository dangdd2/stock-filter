"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { type RsiFilter, type MacdFilter, type StochFilter, MASTER_ID } from '@/types';
export type { Watchlist, StockIndicatorResult } from '@/types';

import { useWatchlists } from '@/hooks/useWatchlists';
import { useStockData }  from '@/hooks/useStockData';
import { useAiAnalysis } from '@/hooks/useAiAnalysis';
import { useTickerSignals } from '@/hooks/useTickerSignals';

import { clearSignalHistory } from '@/lib/signalHistory';
import { saveAlerts, clearAlerts } from '@/lib/smartAlerts';

import Header, { type ActiveTab } from '@/components/layout/Header';
import WatchlistView from '@/components/watchlist/WatchlistView';
import SignalHistoryPanel from '@/components/SignalHistoryPanel';
import MarketHeatmap      from '@/components/MarketHeatmap';
import MarketStatusBar    from '@/components/MarketStatusBar';
import AdvancedScreener   from '@/components/AdvancedScreener';
import ManageModal        from '@/components/watchlist/ManageModal';
import AiPanel            from '@/components/AiPanel';
import SmartAlertsPanel         from '@/components/SmartAlertsPanel';
import MultiChart               from '@/components/MultiChart';
import PatternRecognitionPanel  from '@/components/PatternRecognitionPanel';
import MultiTimeframePanel      from '@/components/MultiTimeframePanel';
import CorrelationMatrix         from '@/components/CorrelationMatrix';
import ComparisonTool            from '@/components/ComparisonTool';
import SectorAnalysis            from '@/components/SectorAnalysis';
import AiChatPanel               from '@/components/AiChatPanel';
import InsiderTracker            from '@/components/InsiderTracker';
import SmartMoneyFlow           from '@/components/SmartMoneyFlow';
import EarningsCalendar         from '@/components/EarningsCalendar';
import { BarChart2, X } from 'lucide-react';

export default function Home() {
  const wl = useWatchlists();
  const sd = useStockData(wl.activeWatchlist, wl.activeWatchlistId, wl.masterWatchlist, wl.preventFetch);
  const ai = useAiAnalysis();

  const [rsiFilter,    setRsiFilter]    = useState<RsiFilter>('ALL');
  const [macdFilter,   setMacdFilter]   = useState<MacdFilter>('ALL');
  const [stochFilter,  setStochFilter]  = useState<StochFilter>('ALL');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'chart' | 'analysis'>('chart');
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('watchlist');

  // Close ticker detail / AI modal on Escape
  useEffect(() => {
    if (!expandedTicker) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setExpandedTicker(null); ai.closeAi(); }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [expandedTicker, ai]);

  const [rowData,      setRowData]      = useState(sd.data);
  const [tableDragIdx, setTableDragIdx] = useState<number | null>(null);
  const [tableDragOverIdx, setTableDragOverIdx] = useState<number | null>(null);
  const pendingExpandTicker = useRef<string | null>(null);

  const { buySignals, sellSignals, setIgnoredSignalTickers } = useTickerSignals(sd.data);

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

  const handleSignalTickerClick = (ticker: string) => {
    if (sd.data.some(d => d.ticker === ticker)) {
      setModalInitialTab('chart');
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
  const unreadAlerts = (sd.smartAlerts ?? []).filter(a => !a.dismissed && !a.read).length;
  const onWatchlistTickerClick = (t: string) => { setActiveTab('watchlist'); handleSignalTickerClick(t); };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-10">
      <Header
        activeTab={activeTab} setActiveTab={setActiveTab}
        unreadAlerts={unreadAlerts} signalHistoryCount={sd.signalHistory.length}
      />

      <main className="w-full px-4 py-4 space-y-3">
        <MarketStatusBar loading={sd.loading} lastUpdated={sd.lastUpdated} onRefresh={sd.fetchData}/>

        {activeTab === 'patterns' && <PatternRecognitionPanel data={allData} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'mtf' && <MultiTimeframePanel tickers={wl.activeWatchlist?.tickers ?? []} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'correlation' && <CorrelationMatrix tickers={wl.activeWatchlist?.tickers ?? []} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'compare' && <ComparisonTool tickers={wl.activeWatchlist?.tickers ?? []} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'sector' && <SectorAnalysis onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'aichat' && <AiChatPanel watchlistTickers={wl.activeWatchlist?.tickers ?? []} activeTicker={expandedTicker ?? undefined} />}
        {activeTab === 'insider' && <InsiderTracker watchlistTickers={wl.activeWatchlist?.tickers ?? []} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'earnings' && <EarningsCalendar watchlistTickers={wl.activeWatchlist?.tickers ?? []} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'smartmoney' && <SmartMoneyFlow watchlistTickers={wl.activeWatchlist?.tickers ?? []} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'multicharts' && <MultiChart data={allData} watchlists={wl.watchlists} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'alerts' && (
          <SmartAlertsPanel
            alerts={sd.smartAlerts ?? []}
            onMarkAllRead={() => { const u = (sd.smartAlerts ?? []).map(a => ({ ...a, read: true })); sd.setSmartAlerts(u); saveAlerts(u); }}
            onDismiss={(id: string) => { const u = (sd.smartAlerts ?? []).map(a => a.id === id ? { ...a, dismissed: true } : a); sd.setSmartAlerts(u); saveAlerts(u); }}
            onClear={() => { clearAlerts(); sd.setSmartAlerts([]); }}
            onTickerClick={onWatchlistTickerClick}
          />
        )}
        {activeTab === 'history' && <SignalHistoryPanel logs={sd.signalHistory} onClear={() => { clearSignalHistory(); sd.setSignalHistory([]); }}/>}
        {activeTab === 'heatmap' && <MarketHeatmap data={allData} watchlists={wl.watchlists} onTickerClick={onWatchlistTickerClick} />}
        {activeTab === 'screener' && <AdvancedScreener data={allData} onTickerClick={onWatchlistTickerClick} />}

        {activeTab === 'watchlist' && (
          <WatchlistView
            wl={wl}
            rowData={rowData}
            loading={sd.loading}
            error={sd.error}
            filteredCount={filteredData.length}
            rsiFilter={rsiFilter} setRsiFilter={setRsiFilter}
            macdFilter={macdFilter} setMacdFilter={setMacdFilter}
            stochFilter={stochFilter} setStochFilter={setStochFilter}
            buySignals={buySignals}
            sellSignals={sellSignals}
            onIgnoreTicker={(t) => setIgnoredSignalTickers(p => [...p, t])}
            expandedTicker={expandedTicker}
            onOpenChart={(ticker) => { setModalInitialTab('chart'); setExpandedTicker(p => p === ticker ? null : ticker); }}
            onOpenAi={(ticker, item) => { setModalInitialTab('analysis'); setExpandedTicker(ticker); ai.runAnalysis(item); }}
            onTickerClick={handleSignalTickerClick}
            aiTicker={ai.aiTicker}
            aiLoading={ai.aiLoading}
            tableDragIdx={tableDragIdx}
            tableDragOverIdx={tableDragOverIdx}
            onTableDragStart={setTableDragIdx}
            onTableDragOver={setTableDragOverIdx}
            onTableDrop={handleTableDrop}
            onTableDragEnd={() => { setTableDragIdx(null); setTableDragOverIdx(null); }}
          />
        )}
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

      {/* Ticker Detail Modal — full-screen, tabs: Chart / AI Analysis / Entry-Exit / News */}
      {expandedTicker && (() => {
        const detailItem = rowData.find(d => d.ticker === expandedTicker) ?? sd.data.find(d => d.ticker === expandedTicker);
        const closeModal = () => { setExpandedTicker(null); ai.closeAi(); };
        if (!detailItem) return null;
        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-slate-950" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <BarChart2 size={16} className="text-blue-400" />
                <span className="font-bold text-slate-100">{expandedTicker}</span>
                <span className="text-xs text-slate-500">Chi tiết & Phân tích AI</span>
              </div>
              <button onClick={closeModal} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors border border-slate-700">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AiPanel
                key={expandedTicker}
                ticker={expandedTicker}
                content={ai.aiTicker === expandedTicker ? ai.aiContent : ''}
                loading={ai.aiLoading && ai.aiTicker === expandedTicker}
                error={ai.aiTicker === expandedTicker ? ai.aiError : null}
                onClose={closeModal}
                item={detailItem}
                onRunAnalysis={() => ai.runAnalysis(detailItem)}
                initialTab={modalInitialTab}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
