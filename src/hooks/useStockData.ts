"use client";

import { useState, useCallback, useEffect } from 'react';
import { type StockIndicatorResult, type Watchlist, MASTER_ID } from '@/types';
import { loadSignalHistory, saveSignalHistory, addNewSignals, fillSignalPrices, type SignalLog, type SignalInput } from '@/lib/signalHistory';

export function useStockData(
  activeWatchlist: Watchlist | undefined,
  activeWatchlistId: string,
  masterWatchlist: Watchlist | undefined,
  preventFetch: React.MutableRefObject<boolean>,
) {
  const [data,          setData]          = useState<StockIndicatorResult[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [masterData,    setMasterData]    = useState<StockIndicatorResult[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null);
  const [signalHistory, setSignalHistory] = useState<SignalLog[]>([]);

  useEffect(() => { setSignalHistory(loadSignalHistory()); }, []);

  const fetchData = useCallback(async () => {
    if (!activeWatchlist || activeWatchlist.tickers.length === 0) { setData([]); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/stocks?tickers=${activeWatchlist.tickers.join(',')}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json: StockIndicatorResult[] = await res.json();
      setData(json);
      setLastUpdated(new Date());

      const today = new Date().toISOString().split('T')[0];
      const priceEntries: [string, number][] = json.filter(d => !d.error).map(d => [d.ticker, d.price]);
      const priceMap = new Map(priceEntries) as Map<string, number>;

      setSignalHistory(prev => {
        let updated = fillSignalPrices(prev, priceMap);
        const newInputs: SignalInput[] = [];
        json.forEach(item => {
          if (item.error) return;
          const buy: string[] = []; const sell: string[] = [];
          if (item.rsi != null && item.rsi < 30)  buy.push(`RSI ${item.rsi.toFixed(0)}`);
          if (item.rsi != null && item.rsi > 70)  sell.push(`RSI ${item.rsi.toFixed(0)}`);
          if (item.stochK != null && item.stochK < 20) buy.push(`Stoch ${item.stochK.toFixed(0)}`);
          if (item.stochK != null && item.stochK > 80) sell.push(`Stoch ${item.stochK.toFixed(0)}`);
          if (item.bbLower != null && item.price < item.bbLower) buy.push('BB↓');
          if (item.bbUpper != null && item.price > item.bbUpper) sell.push('BB↑');
          if (buy.length)  newInputs.push({ ticker: item.ticker, direction: 'BUY',  reasons: buy,  entry: item.price, target: item.bbMiddle ?? null });
          if (sell.length) newInputs.push({ ticker: item.ticker, direction: 'SELL', reasons: sell, entry: item.price, target: item.bbMiddle ?? null });
        });
        updated = addNewSignals(updated, newInputs, today);
        saveSignalHistory(updated);
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally { setLoading(false); }
  }, [activeWatchlist]);

  const fetchMasterData = useCallback(async () => {
    const tickers = masterWatchlist?.tickers ?? [];
    if (!tickers.length) { setMasterData([]); return; }
    setMasterLoading(true);
    try {
      const res = await fetch(`/api/stocks?tickers=${tickers.join(',')}`);
      if (!res.ok) throw new Error('Failed');
      setMasterData(await res.json());
    } catch { /* silent */ } finally { setMasterLoading(false); }
  }, [masterWatchlist]);

  useEffect(() => {
    if (preventFetch.current) { preventFetch.current = false; return; }
    if (activeWatchlistId) fetchData();
  }, [activeWatchlistId, fetchData, preventFetch]);

  useEffect(() => { if (activeWatchlistId === MASTER_ID) setMasterData(data); }, [data, activeWatchlistId]);
  useEffect(() => { if (activeWatchlistId !== MASTER_ID) fetchMasterData(); }, [fetchMasterData, activeWatchlistId]);

  return {
    data, loading, error,
    masterData, masterLoading,
    lastUpdated, signalHistory, setSignalHistory,
    fetchData,
  };
}
