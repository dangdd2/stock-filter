"use client";

import { useState, useCallback } from 'react';
import { type StockIndicatorResult } from '@/types';

export function useAiAnalysis() {
  const [aiTicker,  setAiTicker]  = useState<string | null>(null);
  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState<string | null>(null);

  const runAnalysis = useCallback(async (item: StockIndicatorResult) => {
    if (aiTicker === item.ticker) { setAiTicker(null); return; }
    setAiTicker(item.ticker); setAiContent(''); setAiError(null); setAiLoading(true);
    try {
      const res = await fetch(`/api/analyze/${item.ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: item.price, volume: item.volume,
          rsi: item.rsi, stochK: item.stochK, stochD: item.stochD,
          macd: item.macd, macdSignal: item.macdSignal, macdHistogram: item.macdHistogram,
          bbUpper: item.bbUpper ?? null, bbMiddle: item.bbMiddle ?? null, bbLower: item.bbLower ?? null,
        }),
      });
      if (!res.ok || !res.body) throw new Error('Analysis request failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const p = JSON.parse(payload) as { text?: string; error?: string };
            if (p.error) throw new Error(p.error);
            if (p.text) setAiContent(prev => prev + p.text);
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error');
    } finally { setAiLoading(false); }
  }, [aiTicker]);

  return { aiTicker, aiContent, aiLoading, aiError, runAnalysis, closeAi: () => setAiTicker(null) };
}
