'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, ExternalLink, Filter, ChevronDown } from 'lucide-react';
import type { InsiderResult, InsiderTransaction, TransactionType, PersonType, SignalStrength } from '@/app/api/insider/route';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const TX_CFG: Record<TransactionType, { label: string; cls: string; isBuy: boolean }> = {
  result_buy:    { label: '✅ Đã mua',        cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', isBuy: true  },
  buy:           { label: '↑ Mua vào',        cls: 'bg-green-500/15 text-green-300 border-green-500/30',      isBuy: true  },
  register_buy:  { label: '📋 Đăng ký mua',   cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',         isBuy: true  },
  result_sell:   { label: '🔴 Đã bán',        cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40',         isBuy: false },
  sell:          { label: '↓ Bán ra',         cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30',   isBuy: false },
  register_sell: { label: '📋 Đăng ký bán',   cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',     isBuy: false },
  unknown:       { label: '— Thông báo',      cls: 'bg-slate-600/40 text-slate-400 border-slate-600/30',      isBuy: false },
};

const PERSON_CFG: Record<PersonType, { label: string; rank: number }> = {
  chairman:         { label: 'Chủ tịch HĐQT', rank: 1 },
  director:         { label: 'Tổng Giám đốc',  rank: 2 },
  cfo:              { label: 'Giám đốc TC',     rank: 3 },
  board:            { label: 'TV HĐQT',         rank: 4 },
  major_shareholder:{ label: 'Cổ đông lớn',    rank: 5 },
  related:          { label: 'Người liên quan', rank: 6 },
  unknown:          { label: 'Lãnh đạo',        rank: 7 },
};

const SIGNAL_CFG: Record<SignalStrength, { dot: string; label: string }> = {
  strong: { dot: 'bg-red-400',    label: 'Tín hiệu mạnh' },
  medium: { dot: 'bg-amber-400',  label: 'Tín hiệu vừa'  },
  weak:   { dot: 'bg-slate-500',  label: 'Theo dõi'      },
};

function fmtQty(n: number | null) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Hôm nay';
  if (d === 1) return 'Hôm qua';
  if (d < 7)  return `${d} ngày trước`;
  if (d < 30) return `${Math.floor(d / 7)} tuần trước`;
  return `${Math.floor(d / 30)} tháng trước`;
}

// ─── Transaction card ──────────────────────────────────────────────────────────
function TxCard({ tx, onTickerClick }: { tx: InsiderTransaction; onTickerClick?: (t: string) => void }) {
  const txCfg = TX_CFG[tx.transactionType];
  const sigCfg = SIGNAL_CFG[tx.signalStrength];
  const personCfg = PERSON_CFG[tx.personType];

  return (
    <div className={`bg-slate-800/50 border rounded-xl p-4 space-y-3 transition-all hover:border-slate-600/60 ${tx.isLargeDeal ? 'border-amber-500/30' : 'border-slate-700/50'}`}>
      {/* Row 1: ticker + tx type + signal + large deal */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onTickerClick?.(tx.ticker)}
            className="font-mono font-black text-base text-blue-400 hover:text-blue-300 transition-colors"
          >
            {tx.ticker}
          </button>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${txCfg.cls}`}>
            {txCfg.label}
          </span>
          {tx.isLargeDeal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <AlertTriangle size={9} /> Lớn
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${sigCfg.dot}`} />
          <span className="text-[10px] text-slate-500">{sigCfg.label}</span>
        </div>
      </div>

      {/* Row 2: person info */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-200">{tx.personName}</span>
        <span className="text-[11px] px-1.5 py-0.5 bg-slate-700/60 border border-slate-600/40 text-slate-400 rounded-md">
          {personCfg.label}
        </span>
      </div>

      {/* Row 3: quantities + price */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-700/30 rounded-lg px-2.5 py-1.5">
          <div className="text-[9px] text-slate-500 mb-0.5">Đăng ký</div>
          <div className="font-mono font-bold text-slate-200">{fmtQty(tx.plannedQty)}</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg px-2.5 py-1.5">
          <div className="text-[9px] text-slate-500 mb-0.5">Thực hiện</div>
          <div className={`font-mono font-bold ${tx.executedQty != null ? (txCfg.isBuy ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
            {fmtQty(tx.executedQty)}
          </div>
        </div>
        <div className="bg-slate-700/30 rounded-lg px-2.5 py-1.5">
          <div className="text-[9px] text-slate-500 mb-0.5">Giá hiện tại</div>
          <div className="font-mono font-bold text-slate-200">
            {tx.priceNow ? tx.priceNow.toLocaleString('vi-VN') : '—'}
          </div>
        </div>
        <div className="bg-slate-700/30 rounded-lg px-2.5 py-1.5">
          <div className="text-[9px] text-slate-500 mb-0.5">Ngày CBTT</div>
          <div className="font-mono text-slate-300">{fmtDate(tx.disclosureDate)}</div>
        </div>
      </div>

      {/* Row 4: signal note */}
      <div className="text-xs text-slate-400 bg-slate-900/40 rounded-lg px-3 py-1.5 leading-relaxed">
        {tx.signalNote}
      </div>

      {/* Row 5: footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-600">
        <span>{timeAgo(tx.disclosureDate)} · {tx.source}</span>
        {tx.sourceUrl && (
          <a href={tx.sourceUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-slate-400 transition-colors">
            <ExternalLink size={10} /> Nguồn
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Sentiment summary bar ─────────────────────────────────────────────────────
function SentimentBar({ buyQty, sellQty }: { buyQty: number; sellQty: number }) {
  const total = buyQty + sellQty;
  if (total === 0) return null;
  const buyPct = (buyQty / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-slate-500">
        <span className="text-emerald-400">Mua {fmtQty(buyQty)}</span>
        <span className="text-rose-400">Bán {fmtQty(sellQty)}</span>
      </div>
      <div className="h-2 bg-rose-500/30 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500/70 rounded-full transition-all" style={{ width: `${buyPct}%` }} />
      </div>
    </div>
  );
}

// ─── Ticker summary card ───────────────────────────────────────────────────────
function TickerSummaryCard({ ticker, data, onSelect, isSelected }: {
  ticker: string;
  data: InsiderResult['summaries'][string];
  onSelect: () => void;
  isSelected: boolean;
}) {
  const sentIcon = data.netSentiment === 'bullish'
    ? <TrendingUp size={12} className="text-emerald-400" />
    : data.netSentiment === 'bearish'
    ? <TrendingDown size={12} className="text-rose-400" />
    : <Minus size={12} className="text-slate-400" />;

  return (
    <button onClick={onSelect}
      className={`text-left p-3 rounded-xl border transition-all ${isSelected ? 'bg-blue-500/15 border-blue-500/40' : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-black text-sm text-blue-400">{ticker}</span>
        <div className="flex items-center gap-1">{sentIcon}</div>
      </div>
      <SentimentBar buyQty={data.recentBuyQty} sellQty={data.recentSellQty} />
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
        {data.largeDealCount > 0 && (
          <span className="text-amber-400">⚡ {data.largeDealCount} giao dịch lớn</span>
        )}
        {data.lastActivity && <span>{timeAgo(data.lastActivity)}</span>}
      </div>
    </button>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
      <AlertTriangle size={32} className="opacity-30" />
      <p className="text-sm text-center">
        {hasFilter
          ? 'Không tìm thấy giao dịch nội bộ phù hợp với bộ lọc'
          : 'Chưa có dữ liệu giao dịch nội bộ.\nThử nhấn làm mới hoặc bỏ bộ lọc.'}
      </p>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────
interface Props {
  watchlistTickers: string[];
  onTickerClick?: (ticker: string) => void;
}

type FilterType = 'all' | 'buy' | 'sell' | 'large' | 'result';

export default function InsiderTracker({ watchlistTickers, onTickerClick }: Props) {
  const [data, setData] = useState<InsiderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStrength, setFilterStrength] = useState<SignalStrength | 'all'>('all');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = showWatchlistOnly && watchlistTickers.length > 0
        ? `?tickers=${watchlistTickers.slice(0, 8).join(',')}`
        : '';
      const res = await fetch(`/api/insider${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, [showWatchlistOnly, watchlistTickers]);

  useEffect(() => { load(); }, [load]);

  // Filter transactions
  const filtered = (data?.transactions ?? []).filter(tx => {
    if (selectedTicker && tx.ticker !== selectedTicker) return false;
    if (showWatchlistOnly && watchlistTickers.length > 0 && !watchlistTickers.includes(tx.ticker)) return false;
    if (filterType === 'buy'    && !['buy', 'result_buy', 'register_buy'].includes(tx.transactionType)) return false;
    if (filterType === 'sell'   && !['sell', 'result_sell', 'register_sell'].includes(tx.transactionType)) return false;
    if (filterType === 'large'  && !tx.isLargeDeal) return false;
    if (filterType === 'result' && !['result_buy', 'result_sell'].includes(tx.transactionType)) return false;
    if (filterStrength !== 'all' && tx.signalStrength !== filterStrength) return false;
    return true;
  });

  const summaryTickers = Object.keys(data?.summaries ?? {});
  const totalBuy  = filtered.filter(t => TX_CFG[t.transactionType].isBuy).length;
  const totalSell = filtered.filter(t => !TX_CFG[t.transactionType].isBuy && t.transactionType !== 'unknown').length;
  const totalLarge = filtered.filter(t => t.isLargeDeal).length;

  const FILTER_TABS: { id: FilterType; label: string }[] = [
    { id: 'all',    label: 'Tất cả' },
    { id: 'buy',    label: '↑ Mua'  },
    { id: 'sell',   label: '↓ Bán'  },
    { id: 'result', label: '✅ Kết quả' },
    { id: 'large',  label: '⚡ Lớn' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-100">Insider Trading Tracker</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Giao dịch cổ phiếu của người nội bộ — lãnh đạo, cổ đông lớn (nguồn: HOSE/HNX CBTT)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {watchlistTickers.length > 0 && (
            <button
              onClick={() => setShowWatchlistOnly(p => !p)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${showWatchlistOnly ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-700/60 text-slate-400 border-slate-600 hover:bg-slate-600'}`}
            >
              Watchlist only
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 text-slate-300 border border-slate-600 rounded-lg text-xs hover:bg-slate-600 transition-colors disabled:opacity-40">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      {data && !loading && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            { label: 'Tổng CBTT',  value: filtered.length,      cls: 'text-slate-200' },
            { label: 'Giao dịch mua', value: totalBuy,          cls: 'text-emerald-400' },
            { label: 'Giao dịch bán', value: totalSell,         cls: 'text-rose-400' },
            { label: 'Giao dịch lớn', value: totalLarge,        cls: 'text-amber-400' },
            { label: 'Mã theo dõi',   value: summaryTickers.length, cls: 'text-blue-400' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-slate-800/50 border border-slate-700/40 rounded-xl px-3 py-2 text-center">
              <div className={`text-lg font-black font-mono ${cls}`}>{value}</div>
              <div className="text-[10px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ticker summaries */}
      {data && summaryTickers.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2">Tổng hợp theo mã</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {summaryTickers.map(t => (
              <TickerSummaryCard key={t} ticker={t} data={data.summaries[t]}
                isSelected={selectedTicker === t}
                onSelect={() => setSelectedTicker(p => p === t ? null : t)} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-slate-500" />
        {/* Type filter */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
          {FILTER_TABS.map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)}
              className={`px-2.5 py-1.5 transition-colors ${filterType === f.id ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {/* Strength filter */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
          {(['all', 'strong', 'medium', 'weak'] as const).map(s => (
            <button key={s} onClick={() => setFilterStrength(s)}
              className={`px-2.5 py-1.5 transition-colors ${filterStrength === s ? 'bg-slate-600 text-slate-200' : 'text-slate-500 hover:bg-slate-700'}`}>
              {s === 'all' ? 'Mọi tín hiệu' : s === 'strong' ? '🔴 Mạnh' : s === 'medium' ? '🟡 Vừa' : '⬜ Yếu'}
            </button>
          ))}
        </div>
        {selectedTicker && (
          <button onClick={() => setSelectedTicker(null)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-lg text-xs hover:bg-blue-500/20 transition-colors">
            {selectedTicker} <ChevronDown size={11} />
          </button>
        )}
        {data && (
          <span className="text-[10px] text-slate-600 ml-auto">
            Cập nhật {new Date(data.fetchedAt).toLocaleTimeString('vi-VN')}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
          ⚠ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Đang thu thập thông báo giao dịch nội bộ…</span>
          <span className="text-xs text-slate-600">Phân tích CBTT từ Google News RSS</span>
        </div>
      )}

      {/* Transactions */}
      {!loading && data && (
        filtered.length === 0
          ? <EmptyState hasFilter={filterType !== 'all' || filterStrength !== 'all' || !!selectedTicker} />
          : (
            <div className="space-y-3">
              {filtered.map(tx => (
                <TxCard key={tx.id} tx={tx} onTickerClick={t => { onTickerClick?.(t); }} />
              ))}
            </div>
          )
      )}
    </div>
  );
}
