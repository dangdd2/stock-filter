"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import React from 'react';
import { type StockIndicatorResult, type Watchlist, MASTER_ID } from '@/types';
import { loadSignalHistory, saveSignalHistory, addNewSignals, fillSignalPrices, type SignalLog, type SignalInput } from '@/lib/signalHistory';
import { loadAlerts, saveAlerts, detectAlerts, type SmartAlert } from '@/lib/smartAlerts';

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
  const [smartAlerts,   setSmartAlerts]   = useState<SmartAlert[]>([]);
  // Keep a ref to always have latest masterData prices for fillSignalPrices
  const masterPriceMapRef = React.useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setSignalHistory(loadSignalHistory());
    setSmartAlerts(loadAlerts());
  }, []);

  // Update master price map whenever masterData changes
  useEffect(() => {
    const entries: [string, number][] = masterData
      .filter(d => !d.error && d.price > 0)
      .map(d => [d.ticker, d.price]);
    masterPriceMapRef.current = new Map(entries);
  }, [masterData]);

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

      // Build price map: merge current watchlist prices INTO master price map
      // so fillSignalPrices can resolve signals for ALL tickers, not just active watchlist
      const combinedMap = new Map(masterPriceMapRef.current);
      json.filter(d => !d.error && d.price > 0).forEach(d => combinedMap.set(d.ticker, d.price));

      setSignalHistory(prev => {
        let updated = fillSignalPrices(prev, combinedMap);
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

      // ── Smart Alert detection ──────────────────────────────
      setSmartAlerts(prev => {
        const newAlerts = detectAlerts(json, prev);
        if (!newAlerts.length) return prev;
        const merged = [...prev, ...newAlerts];
        saveAlerts(merged);
        // Browser notification for high-priority alerts
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          newAlerts
            .filter(a => {
              const cfg = (smartAlerts: typeof prev) => import('@/lib/smartAlerts').then(m => m.ALERT_CONFIG[a.type]);
              return true; // fire all for now, config checked in component
            })
            .slice(0, 3) // max 3 notifications per refresh
            .forEach(a => {
              const { ALERT_CONFIG: cfg } = require('@/lib/smartAlerts');
              const c = cfg[a.type];
              new Notification(`${c.emoji} ${a.ticker} — ${c.label}`, {
                body: `${c.description}\nGiá: ${a.price.toLocaleString()} VND`,
                icon: '/favicon.ico',
              });
            });
        }
        return merged;
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
      const json: StockIndicatorResult[] = await res.json();
      setMasterData(json);

      // Also fill signal prices using master data prices right after fetch
      const masterEntries: [string, number][] = json
        .filter(d => !d.error && d.price > 0)
        .map(d => [d.ticker, d.price]);
      const masterMap = new Map(masterEntries);
      setSignalHistory(prev => {
        const updated = fillSignalPrices(prev, masterMap);
        saveSignalHistory(updated);
        return updated;
      });
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
    smartAlerts, setSmartAlerts,
    fetchData,
  };
}
