import { useState, useEffect, useMemo } from 'react';
import type { StockIndicatorResult } from '@/types';

export interface SignalEntry {
  ticker: string;
  reasons: string[];
  entry: number;
  target: number | null;
}

export function useTickerSignals(data: StockIndicatorResult[]) {
  const [ignoredSignalTickers, setIgnoredSignalTickers] = useState<string[]>([]);

  useEffect(() => {
    const s = localStorage.getItem('vn_stock_ignored_signals');
    if (s) { try { setIgnoredSignalTickers(JSON.parse(s)); } catch { /* ignore */ } }
  }, []);
  useEffect(() => {
    localStorage.setItem('vn_stock_ignored_signals', JSON.stringify(ignoredSignalTickers));
  }, [ignoredSignalTickers]);

  const { buySignals, sellSignals } = useMemo(() => {
    const buy: SignalEntry[] = [];
    const sell: SignalEntry[] = [];
    data.forEach(item => {
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
    const byConviction = (a: SignalEntry, b: SignalEntry) => b.reasons.length - a.reasons.length;
    return { buySignals: buy.sort(byConviction), sellSignals: sell.sort(byConviction) };
  }, [data, ignoredSignalTickers]);

  return { buySignals, sellSignals, ignoredSignalTickers, setIgnoredSignalTickers };
}
