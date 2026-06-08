'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { MultiTimeframeResult, TimeframeData } from '@/app/api/mtf/[ticker]/route';

// ─── Mini sparkline ────────────────────────────────────────────────────────────
function MiniSparkline({ closes, color }: { closes: number[]; color: string }) {
  if (!closes || closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const w = 80, h = 28, pad = 2;
  const pts = closes.map((v, i) => {
    const x = pad + (i / (closes.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-7" style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Signal badge ──────────────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: TimeframeData['signal'] }) {
  const cfg = {
    strong_buy:  { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: '● Mua mạnh' },
    buy:         { cls: 'bg-green-500/15 text-green-300 border-green-500/30',       label: '▲ Mua'     },
    neutral:     { cls: 'bg-slate-600/40 text-slate-300 border-slate-500/30',       label: '— Trung lập' },
    sell:        { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30',    label: '▼ Bán'    },
    strong_sell: { cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40',          label: '● Bán mạnh' },
  }[signal];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  // score: -4..+4
  const pct = ((score + 4) / 8) * 100;
  const color = score >= 2 ? '#10b981' : score <= -2 ? '#f43f5e' : '#94a3b8';
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
        <span>Bán</span>
        <span className="font-bold" style={{ color }}>{score > 0 ? `+${score}` : score}</span>
        <span>Mua</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Indicator cell ────────────────────────────────────────────────────────────
function IndicCell({ value, zone }: { value: number | null; zone?: string | null }) {
  if (value == null) return <span className="text-slate-500 text-xs">—</span>;
  const cls =
    zone === 'oversold'   ? 'text-emerald-400' :
    zone === 'overbought' ? 'text-rose-400' :
    zone === 'bullish'    ? 'text-emerald-400' :
    zone === 'bearish'    ? 'text-rose-400' :
    'text-slate-300';
  return <span className={`font-mono text-xs font-semibold ${cls}`}>{value.toFixed(1)}</span>;
}

// ─── Alignment banner ─────────────────────────────────────────────────────────
function AlignmentBanner({ result }: { result: MultiTimeframeResult }) {
  const cfg = {
    bullish:  { cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', icon: <TrendingUp size={16}/>, label: 'Ba khung đồng thuận TĂNG — tín hiệu tốt' },
    bearish:  { cls: 'bg-rose-500/15 border-rose-500/40 text-rose-300',           icon: <TrendingDown size={16}/>, label: 'Ba khung đồng thuận GIẢM — cẩn trọng' },
    mixed:    { cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300',         icon: <AlertCircle size={16}/>, label: 'Tín hiệu PHÂN KỲ giữa các khung — chờ xác nhận' },
    neutral:  { cls: 'bg-slate-700/60 border-slate-600/40 text-slate-300',         icon: <Minus size={16}/>, label: 'Tín hiệu TRUNG LẬP — chưa có xu hướng rõ ràng' },
  }[result.alignment];
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${cfg.cls}`}>
      {cfg.icon}
      <span className="text-sm font-semibold">{cfg.label}</span>
      <span className="ml-auto text-xs opacity-60">D({result.daily.score > 0 ? '+' : ''}{result.daily.score}) W({result.weekly.score > 0 ? '+' : ''}{result.weekly.score}) M({result.monthly.score > 0 ? '+' : ''}{result.monthly.score})</span>
    </div>
  );
}

// ─── Single timeframe card ─────────────────────────────────────────────────────
function TfCard({ data }: { data: TimeframeData }) {
  const sparkColor =
    data.signal === 'strong_buy' || data.signal === 'buy' ? '#10b981' :
    data.signal === 'sell' || data.signal === 'strong_sell' ? '#f43f5e' : '#64748b';

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-bold text-slate-100">{data.label}</span>
          <span className="ml-2 text-xs text-slate-500">({data.timeframe})</span>
        </div>
        {data.price != null && (
          <span className="font-mono text-sm text-slate-300">{data.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        )}
      </div>

      {/* Sparkline */}
      {data.closes.length > 2 && (
        <div className="flex justify-center">
          <MiniSparkline closes={data.closes} color={sparkColor} />
        </div>
      )}

      {/* Signal + score */}
      <div className="flex items-center gap-3">
        <SignalBadge signal={data.signal} />
        <div className="flex-1">
          <ScoreBar score={data.score} />
        </div>
      </div>

      {/* Indicators grid */}
      {data.error ? (
        <div className="text-xs text-rose-400">⚠ {data.error}</div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">RSI(14)</span>
            <IndicCell value={data.rsi} zone={data.rsiZone} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Stoch K</span>
            <IndicCell value={data.stochK} zone={data.stochZone} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">MACD</span>
            <IndicCell value={data.macdHistogram} zone={data.macdTrend} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">BB vị trí</span>
            <span className={`text-xs font-semibold ${data.bbPosition === 'below' ? 'text-emerald-400' : data.bbPosition === 'above' ? 'text-rose-400' : 'text-slate-400'}`}>
              {data.bbPosition === 'below' ? 'Dưới' : data.bbPosition === 'above' ? 'Trên' : data.bbPosition === 'inside' ? 'Trong' : '—'}
            </span>
          </div>
          {data.bbUpper != null && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">BB Upper</span>
                <span className="font-mono text-slate-300 text-xs">{data.bbUpper.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">BB Lower</span>
                <span className="font-mono text-slate-300 text-xs">{data.bbLower?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Comparison table row ──────────────────────────────────────────────────────
function CompareRow({ label, daily, weekly, monthly }: {
  label: string;
  daily: React.ReactNode;
  weekly: React.ReactNode;
  monthly: React.ReactNode;
}) {
  return (
    <tr className="border-t border-slate-700/50">
      <td className="py-2 pr-4 text-slate-500 text-xs whitespace-nowrap">{label}</td>
      <td className="py-2 px-3 text-center">{daily}</td>
      <td className="py-2 px-3 text-center">{weekly}</td>
      <td className="py-2 px-3 text-center">{monthly}</td>
    </tr>
  );
}

// ─── Main ticker MTF view ──────────────────────────────────────────────────────
function TickerMTF({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [data, setData] = useState<MultiTimeframeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/mtf/${ticker}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Ticker header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-700/30 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-100 text-base">{ticker}</span>
          <span className="text-xs text-slate-500">Multi-Timeframe</span>
          <div className="flex rounded-md overflow-hidden border border-slate-600 text-xs">
            {(['cards', 'table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 transition-colors ${view === v ? 'bg-blue-500/30 text-blue-300' : 'text-slate-400 hover:bg-slate-600'}`}>
                {v === 'cards' ? 'Cards' : 'Bảng'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-slate-200 transition-colors disabled:opacity-40">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-600 hover:text-slate-200 transition-colors text-lg leading-none">×</button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Đang tải dữ liệu D/W/M…</span>
          </div>
        )}
        {error && <div className="text-sm text-rose-400 py-2">⚠ {error}</div>}
        {data && !loading && (
          <>
            <AlignmentBanner result={data} />

            {view === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <TfCard data={data.daily} />
                <TfCard data={data.weekly} />
                <TfCard data={data.monthly} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs">
                      <th className="text-left py-2 pr-4 font-medium">Chỉ số</th>
                      <th className="text-center py-2 px-3 font-medium">Daily (D)</th>
                      <th className="text-center py-2 px-3 font-medium">Weekly (W)</th>
                      <th className="text-center py-2 px-3 font-medium">Monthly (M)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow label="Tín hiệu"
                      daily={<SignalBadge signal={data.daily.signal} />}
                      weekly={<SignalBadge signal={data.weekly.signal} />}
                      monthly={<SignalBadge signal={data.monthly.signal} />}
                    />
                    <CompareRow label="Điểm"
                      daily={<span className={`font-mono text-xs font-bold ${data.daily.score > 0 ? 'text-emerald-400' : data.daily.score < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{data.daily.score > 0 ? '+' : ''}{data.daily.score}</span>}
                      weekly={<span className={`font-mono text-xs font-bold ${data.weekly.score > 0 ? 'text-emerald-400' : data.weekly.score < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{data.weekly.score > 0 ? '+' : ''}{data.weekly.score}</span>}
                      monthly={<span className={`font-mono text-xs font-bold ${data.monthly.score > 0 ? 'text-emerald-400' : data.monthly.score < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{data.monthly.score > 0 ? '+' : ''}{data.monthly.score}</span>}
                    />
                    <CompareRow label="RSI(14)"
                      daily={<IndicCell value={data.daily.rsi} zone={data.daily.rsiZone} />}
                      weekly={<IndicCell value={data.weekly.rsi} zone={data.weekly.rsiZone} />}
                      monthly={<IndicCell value={data.monthly.rsi} zone={data.monthly.rsiZone} />}
                    />
                    <CompareRow label="Stoch K"
                      daily={<IndicCell value={data.daily.stochK} zone={data.daily.stochZone} />}
                      weekly={<IndicCell value={data.weekly.stochK} zone={data.weekly.stochZone} />}
                      monthly={<IndicCell value={data.monthly.stochK} zone={data.monthly.stochZone} />}
                    />
                    <CompareRow label="MACD Hist"
                      daily={<IndicCell value={data.daily.macdHistogram} zone={data.daily.macdTrend} />}
                      weekly={<IndicCell value={data.weekly.macdHistogram} zone={data.weekly.macdTrend} />}
                      monthly={<IndicCell value={data.monthly.macdHistogram} zone={data.monthly.macdTrend} />}
                    />
                    <CompareRow label="BB Vị trí"
                      daily={<span className={`text-xs font-semibold ${data.daily.bbPosition === 'below' ? 'text-emerald-400' : data.daily.bbPosition === 'above' ? 'text-rose-400' : 'text-slate-400'}`}>{data.daily.bbPosition === 'below' ? 'Dưới' : data.daily.bbPosition === 'above' ? 'Trên' : 'Trong'}</span>}
                      weekly={<span className={`text-xs font-semibold ${data.weekly.bbPosition === 'below' ? 'text-emerald-400' : data.weekly.bbPosition === 'above' ? 'text-rose-400' : 'text-slate-400'}`}>{data.weekly.bbPosition === 'below' ? 'Dưới' : data.weekly.bbPosition === 'above' ? 'Trên' : 'Trong'}</span>}
                      monthly={<span className={`text-xs font-semibold ${data.monthly.bbPosition === 'below' ? 'text-emerald-400' : data.monthly.bbPosition === 'above' ? 'text-rose-400' : 'text-slate-400'}`}>{data.monthly.bbPosition === 'below' ? 'Dưới' : data.monthly.bbPosition === 'above' ? 'Trên' : 'Trong'}</span>}
                    />
                    <CompareRow label="Giá"
                      daily={<span className="font-mono text-xs text-slate-300">{data.daily.price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</span>}
                      weekly={<span className="font-mono text-xs text-slate-300">{data.weekly.price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</span>}
                      monthly={<span className="font-mono text-xs text-slate-300">{data.monthly.price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</span>}
                    />
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────
interface Props {
  tickers: string[];
  onTickerClick?: (ticker: string) => void;
}

export default function MultiTimeframePanel({ tickers, onTickerClick }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [inputTicker, setInputTicker] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expand first few tickers from watchlist
  useEffect(() => {
    if (tickers.length > 0 && selected.length === 0) {
      setSelected(tickers.slice(0, 3));
      setExpanded(new Set(tickers.slice(0, 1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers]);

  const addTicker = (t: string) => {
    const clean = t.trim().toUpperCase();
    if (!clean || selected.includes(clean)) return;
    setSelected(prev => [...prev, clean]);
    setExpanded(prev => new Set([...prev, clean]));
    setInputTicker('');
  };

  const removeTicker = (t: string) => setSelected(prev => prev.filter(x => x !== t));
  const toggleExpand = (t: string) => setExpanded(prev => {
    const n = new Set(prev);
    n.has(t) ? n.delete(t) : n.add(t);
    return n;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100">Multi-Timeframe Analysis</h2>
          <p className="text-xs text-slate-500 mt-0.5">So sánh tín hiệu D / W / M — phân tích đa khung thời gian</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={inputTicker}
            onChange={e => setInputTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addTicker(inputTicker)}
            placeholder="Thêm mã (VD: VNM)"
            className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-40"
          />
          <button onClick={() => addTicker(inputTicker)}
            className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-lg text-sm hover:bg-blue-500/30 transition-colors">
            + Thêm
          </button>
        </div>
      </div>

      {/* Quick pick from watchlist */}
      {tickers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 self-center mr-1">Watchlist:</span>
          {tickers.map(t => (
            <button key={t} onClick={() => addTicker(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
                selected.includes(t)
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-600/60 hover:text-slate-200'
              }`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Selected tickers */}
      {selected.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          Chọn mã cổ phiếu từ watchlist hoặc nhập thủ công để xem phân tích đa khung
        </div>
      )}

      <div className="space-y-3">
        {selected.map(ticker => (
          <div key={ticker}>
            {/* Collapsible header row */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
              onClick={() => toggleExpand(ticker)}>
              <span className="font-mono font-bold text-slate-200 text-sm flex-1">{ticker}</span>
              <button onClick={e => { e.stopPropagation(); onTickerClick?.(ticker); }}
                className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded hover:bg-blue-500/10 transition-colors">
                Xem chart
              </button>
              <button onClick={e => { e.stopPropagation(); removeTicker(ticker); }}
                className="text-slate-500 hover:text-rose-400 transition-colors px-1">×</button>
              <span className="text-slate-500">
                {expanded.has(ticker) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </div>
            {expanded.has(ticker) && (
              <div className="mt-2">
                <TickerMTF ticker={ticker} onClose={() => toggleExpand(ticker)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
