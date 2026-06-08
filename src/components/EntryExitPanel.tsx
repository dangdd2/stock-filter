"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  Target, TrendingUp, TrendingDown, Minus, RefreshCw,
  ArrowDownToLine, ArrowUpFromLine, ShieldAlert, AlertTriangle,
  BarChart2, History, Zap, ChevronRight,
} from 'lucide-react';
import type { StockIndicatorResult } from '@/types';
import type { EntryExitResult } from '@/app/api/entry-exit/[ticker]/route';
import { loadSignalHistory } from '@/lib/signalHistory';

interface Props {
  item: StockIndicatorResult;
}

function PriceBadge({
  price, current, label, colorClass,
}: { price: number; current: number; label: string; colorClass: string }) {
  const pct = ((price - current) / current) * 100;
  const sign = pct >= 0 ? '+' : '';
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${colorClass}`}>
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-bold text-slate-200">{price.toLocaleString()}</span>
        <span className={`text-xs font-mono ${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {sign}{pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' }) {
  if (trend === 'BULLISH') return <TrendingUp size={15} className="text-emerald-400" />;
  if (trend === 'BEARISH') return <TrendingDown size={15} className="text-rose-400" />;
  return <Minus size={15} className="text-amber-400" />;
}

const TREND_LABELS: Record<EntryExitResult['trend'], string> = {
  BULLISH: 'Xu hướng tăng',
  BEARISH: 'Xu hướng giảm',
  SIDEWAYS: 'Đi ngang',
};

const CONFIDENCE_COLORS: Record<EntryExitResult['confidence'], string> = {
  'CAO': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'TRUNG BÌNH': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  'THẤP': 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  AGGRESSIVE: 'border-violet-500/40 bg-violet-500/5',
  CONSERVATIVE: 'border-blue-500/40 bg-blue-500/5',
  BREAKOUT: 'border-emerald-500/40 bg-emerald-500/5',
};
const ENTRY_TYPE_LABELS: Record<string, string> = {
  AGGRESSIVE: 'Tích Cực',
  CONSERVATIVE: 'Thận Trọng',
  BREAKOUT: 'Breakout',
};
const ENTRY_TYPE_DOT: Record<string, string> = {
  AGGRESSIVE: 'bg-violet-400',
  CONSERVATIVE: 'bg-blue-400',
  BREAKOUT: 'bg-emerald-400',
};

function RRBar({ rr }: { rr: number }) {
  const pct = Math.min((rr / 5) * 100, 100);
  const color = rr >= 3 ? 'bg-emerald-500' : rr >= 2 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold font-mono ${rr >= 3 ? 'text-emerald-400' : rr >= 2 ? 'text-amber-400' : 'text-rose-400'}`}>
        {rr.toFixed(2)}x
      </span>
    </div>
  );
}

export default function EntryExitPanel({ item }: Props) {
  const [result, setResult] = useState<EntryExitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const fetchEntryExit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get signal history for this ticker only
      const allHistory = loadSignalHistory();
      const tickerHistory = allHistory
        .filter(s => s.ticker === item.ticker)
        .slice(0, 30)
        .map(s => ({
          direction: s.direction,
          priceAtSignal: s.priceAtSignal,
          return7d: s.return7d,
          return14d: s.return14d,
          convictionScore: s.convictionScore,
        }));

      const body = {
        price: item.price,
        closes6m: item.closes6m ?? [],
        highs6m: item.highs6m ?? [],
        lows6m: item.lows6m ?? [],
        rsi: item.rsi,
        stochK: item.stochK,
        stochD: item.stochD,
        macd: item.macd,
        macdSignal: item.macdSignal,
        macdHistogram: item.macdHistogram,
        bbUpper: item.bbUpper ?? null,
        bbMiddle: item.bbMiddle ?? null,
        bbLower: item.bbLower ?? null,
        volume: item.volume,
        avgVolume20d: item.avgVolume20d ?? null,
        mfi: item.mfi ?? null,
        obvTrend: item.obvTrend ?? null,
        change1m: item.change1m ?? null,
        change3m: item.change3m ?? null,
        signalHistory: tickerHistory,
      };

      const res = await fetch(`/api/entry-exit/${item.ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Request failed');
      }
      const data: EntryExitResult = await res.json();
      setResult(data);
      setLastFetched(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    fetchEntryExit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.ticker]);

  const targets = result?.exitZones.filter(z => z.type.startsWith('TARGET')) ?? [];
  const stopZone = result?.exitZones.find(z => z.type === 'STOP_LOSS');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-orange-400" />
          <h4 className="text-sm font-semibold text-slate-300">Điểm Vào / Ra — {item.ticker}</h4>
          {result && (
            <div className="flex items-center gap-1.5">
              <TrendIcon trend={result.trend} />
              <span className="text-xs text-slate-400">{TREND_LABELS[result.trend]}</span>
              <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${CONFIDENCE_COLORS[result.confidence]}`}>
                Tin cậy: {result.confidence}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={fetchEntryExit}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang tính...' : 'Làm mới'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !result && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-lg bg-slate-800/60" />
          ))}
        </div>
      )}

      {result && (
        <>
          {/* Summary */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
            {lastFetched && (
              <p className="text-[10px] text-slate-600 mt-2">
                Cập nhật: {new Date(lastFetched).toLocaleTimeString('vi-VN')}
              </p>
            )}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1.5">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Risk/Reward */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap size={11} /> Tỷ lệ Rủi ro / Lợi nhuận
            </p>
            <RRBar rr={result.riskReward} />
          </div>

          {/* Entry Zones */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ArrowDownToLine size={12} className="text-emerald-400" /> Vùng Vào Lệnh
            </p>
            <div className="space-y-2">
              {result.entryZones
                .sort((a, b) => a.priority - b.priority)
                .map((zone, i) => (
                  <div key={i} className={`rounded-xl border p-3.5 ${ENTRY_TYPE_COLORS[zone.type] ?? 'border-slate-700 bg-slate-800/40'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${ENTRY_TYPE_DOT[zone.type] ?? 'bg-slate-400'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200">{zone.label}</span>
                            <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
                              {ENTRY_TYPE_LABELS[zone.type] ?? zone.type}
                            </span>
                            <span className="text-[10px] text-slate-600">#{zone.priority}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{zone.reason}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold font-mono text-slate-200">
                          {zone.priceFrom.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          → {zone.priceTo.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Exit Targets */}
          {targets.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowUpFromLine size={12} className="text-blue-400" /> Mục Tiêu Thoát Lệnh
              </p>
              <div className="space-y-1.5">
                {targets.map((zone, i) => (
                  <PriceBadge
                    key={i}
                    price={zone.price}
                    current={result.currentPrice}
                    label={`${zone.label} — ${zone.reason}`}
                    colorClass="border-blue-500/20 bg-blue-500/5"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Stop Loss */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-rose-400" /> Dừng Lỗ
            </p>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-300">
                    {result.stopLoss.price.toLocaleString()} VND
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{result.stopLoss.reason}</p>
                </div>
                <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  -{Math.abs(result.stopLoss.pctFromEntry).toFixed(2)}%
                </span>
              </div>
              {stopZone && (
                <p className="text-[10px] text-slate-500">{stopZone.reason}</p>
              )}
            </div>
          </div>

          {/* Key Levels */}
          {(result.keyLevels.support.length > 0 || result.keyLevels.resistance.length > 0) && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart2 size={11} /> Vùng Hỗ Trợ / Kháng Cự Chính
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider mb-1.5">Kháng cự</p>
                  <div className="space-y-1">
                    {result.keyLevels.resistance.map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <ChevronRight size={10} className="text-rose-500" />
                        <span className="font-mono text-xs text-slate-300">{r.toLocaleString()}</span>
                        <span className="text-[10px] text-rose-500">
                          +{(((r - result.currentPrice) / result.currentPrice) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                    {result.keyLevels.resistance.length === 0 && (
                      <span className="text-xs text-slate-600">Không xác định</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1.5">Hỗ trợ</p>
                  <div className="space-y-1">
                    {result.keyLevels.support.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <ChevronRight size={10} className="text-emerald-500" />
                        <span className="font-mono text-xs text-slate-300">{s.toLocaleString()}</span>
                        <span className="text-[10px] text-emerald-500">
                          {(((s - result.currentPrice) / result.currentPrice) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                    {result.keyLevels.support.length === 0 && (
                      <span className="text-xs text-slate-600">Không xác định</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historical Accuracy */}
          {result.historicalAccuracy.totalSignals > 0 && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <History size={11} /> Hiệu Quả Tín Hiệu Lịch Sử ({item.ticker})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    label: 'Tổng tín hiệu',
                    value: result.historicalAccuracy.totalSignals,
                    fmt: (v: number) => v.toString(),
                    color: 'text-slate-200',
                  },
                  {
                    label: 'Win Rate 7N',
                    value: result.historicalAccuracy.winRate,
                    fmt: (v: number) => v.toFixed(1) + '%',
                    color: (result.historicalAccuracy.winRate ?? 0) >= 55 ? 'text-emerald-400' : (result.historicalAccuracy.winRate ?? 0) >= 45 ? 'text-amber-400' : 'text-rose-400',
                  },
                  {
                    label: 'Return TB 7N',
                    value: result.historicalAccuracy.avgReturn7d,
                    fmt: (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%',
                    color: (result.historicalAccuracy.avgReturn7d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400',
                  },
                  {
                    label: 'Return TB 14N',
                    value: result.historicalAccuracy.avgReturn14d,
                    fmt: (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%',
                    color: (result.historicalAccuracy.avgReturn14d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400',
                  },
                ].map(({ label, value, fmt, color }) => (
                  <div key={label} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/40">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-sm font-bold font-mono ${color}`}>
                      {value !== null && value !== undefined ? fmt(value as number) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.historicalAccuracy.totalSignals === 0 && (
            <div className="text-xs text-slate-500 bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2">
              Chưa có lịch sử tín hiệu cho {item.ticker}. Kết quả backtesting sẽ hiện ra sau khi AI tạo tín hiệu.
            </div>
          )}
        </>
      )}
    </div>
  );
}
