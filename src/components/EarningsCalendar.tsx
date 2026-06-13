'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Calendar, TrendingUp, TrendingDown, Minus,
  Clock, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';
import type { EarningsEntry, EarningsResult } from '@/app/api/earnings/route';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtEps = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

const fmtRevenue = (v: number | null) => {
  if (v == null) return '—';
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `${(v / 1e6).toFixed(2)}M`;
  return v.toLocaleString();
};

const surpriseCls = (v: number | null): { badge: string; text: string } => {
  if (v == null) return { badge: 'bg-slate-700/60 border border-slate-600/40 text-slate-400', text: 'text-slate-400' };
  if (v > 0)     return { badge: 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300', text: 'text-emerald-300' };
  return              { badge: 'bg-rose-500/20 border border-rose-500/30 text-rose-300', text: 'text-rose-300' };
};

const timingLabel = (t: EarningsEntry['timing']) => {
  if (t === 'amc') return 'Sau đóng cửa';
  if (t === 'bmo') return 'Trước mở cửa';
  return null;
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color }: { label: string; value: string | null; color: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg px-3 py-2 min-w-[90px]">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold font-mono mt-0.5 ${color}`}>
        {value ?? <span className="text-slate-600 text-sm">—</span>}
      </div>
    </div>
  );
}

function EarningsRow({
  entry,
  expanded,
  onToggle,
  onTickerClick,
}: {
  entry: EarningsEntry;
  expanded: boolean;
  onToggle: () => void;
  onTickerClick?: (t: string) => void;
}) {
  const days = daysUntil(entry.reportDate);
  const sc = surpriseCls(entry.surprisePct);
  const tl = timingLabel(entry.timing);

  return (
    <>
      <tr
        className={`transition-colors cursor-pointer ${
          entry.isUpcoming
            ? 'border-l-2 border-l-blue-500 hover:bg-slate-700/20'
            : 'hover:bg-slate-700/20'
        }`}
        onClick={onToggle}
      >
        {/* Ticker */}
        <td className="px-4 py-3">
          <button
            className="font-bold text-slate-200 hover:text-blue-300 transition-colors text-sm"
            onClick={e => { e.stopPropagation(); onTickerClick?.(entry.ticker); }}
          >
            {entry.ticker}
          </button>
          {entry.companyName && (
            <div className="text-[10px] text-slate-500 truncate max-w-[80px]">{entry.companyName}</div>
          )}
        </td>

        {/* Date */}
        <td className="px-4 py-3">
          <div className="text-xs font-mono text-slate-300">{fmtDate(entry.reportDate)}</div>
          {entry.isUpcoming && days != null && (
            <div className={`text-[10px] mt-0.5 font-medium ${days <= 3 ? 'text-amber-400' : 'text-blue-400'}`}>
              {days === 0 ? 'Hôm nay' : days === 1 ? 'Ngày mai' : `${days} ngày`}
            </div>
          )}
          {tl && (
            <div className="text-[10px] text-slate-600 mt-0.5">{tl}</div>
          )}
        </td>

        {/* EPS Estimate */}
        <td className="px-4 py-3 text-right">
          <div className="text-xs font-mono text-slate-400">{fmtEps(entry.epsEstimate)}</div>
        </td>

        {/* EPS Actual */}
        <td className="px-4 py-3 text-right">
          {entry.isUpcoming ? (
            <span className="text-slate-600 text-xs">—</span>
          ) : (
            <div className={`text-xs font-mono font-bold ${
              entry.epsActual != null && entry.epsEstimate != null
                ? entry.epsActual >= entry.epsEstimate ? 'text-emerald-300' : 'text-rose-300'
                : 'text-slate-400'
            }`}>
              {fmtEps(entry.epsActual)}
            </div>
          )}
        </td>

        {/* Surprise */}
        <td className="px-4 py-3 text-right">
          {entry.isUpcoming ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600/40 text-slate-500">Chờ</span>
          ) : entry.surprisePct != null ? (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${sc.badge}`}>
              {entry.surprisePct >= 0 ? '+' : ''}{entry.surprisePct.toFixed(1)}%
            </span>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}
        </td>

        {/* Expand toggle */}
        <td className="px-3 py-3 text-right">
          {expanded ? (
            <ChevronUp size={13} className="text-slate-500 inline" />
          ) : (
            <ChevronDown size={13} className="text-slate-500 inline" />
          )}
        </td>
      </tr>

      {/* Expanded row: revenue + no-data notice */}
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 pb-3 pt-0">
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 flex flex-wrap gap-6 items-start">
              {!entry.hasData ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <AlertCircle size={13} className="text-slate-600" />
                  Yahoo Finance chưa có dữ liệu earnings cho mã này
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Doanh thu estimate</div>
                    <div className="text-sm font-mono text-slate-300">{fmtRevenue(entry.revenueEstimate)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Doanh thu actual</div>
                    <div className={`text-sm font-mono font-bold ${
                      entry.revenueActual != null && entry.revenueEstimate != null
                        ? entry.revenueActual >= entry.revenueEstimate ? 'text-emerald-300' : 'text-rose-300'
                        : 'text-slate-300'
                    }`}>
                      {fmtRevenue(entry.revenueActual)}
                    </div>
                  </div>
                  {entry.revenueEstimate != null && entry.revenueActual != null && (
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Revenue surprise</div>
                      {(() => {
                        const pct = entry.revenueEstimate && Math.abs(entry.revenueEstimate) > 0
                          ? ((entry.revenueActual - entry.revenueEstimate) / Math.abs(entry.revenueEstimate)) * 100
                          : null;
                        if (pct == null) return <span className="text-slate-400 text-xs">—</span>;
                        const cls = pct >= 0 ? 'text-emerald-300' : 'text-rose-300';
                        return <div className={`text-sm font-mono font-bold ${cls}`}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</div>;
                      })()}
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Thời điểm</div>
                    <div className="text-xs text-slate-400">{timingLabel(entry.timing) ?? 'Không rõ'}</div>
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
interface Props {
  watchlistTickers: string[];
  onTickerClick?: (ticker: string) => void;
}

type FilterType = 'all' | 'upcoming' | 'beat' | 'miss';

export default function EarningsCalendar({ watchlistTickers, onTickerClick }: Props) {
  const [result, setResult]   = useState<EarningsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<FilterType>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!watchlistTickers.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/earnings?tickers=${watchlistTickers.join(',')}`);
      if (!res.ok) throw new Error('Fetch failed');
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [watchlistTickers]);

  useEffect(() => { load(); }, [load]);

  const entries = result?.entries ?? [];

  // Summary stats
  const upcomingCount = entries.filter(e => e.isUpcoming).length;
  const reported = entries.filter(e => !e.isUpcoming && e.surprisePct != null);
  const beatCount = reported.filter(e => (e.surprisePct ?? 0) > 0).length;
  const beatRate = reported.length ? Math.round(beatCount / reported.length * 100) : null;
  const avgSurprise = reported.length
    ? reported.reduce((s, e) => s + (e.surprisePct ?? 0), 0) / reported.length
    : null;

  const filtered = entries.filter(e => {
    if (filter === 'upcoming') return e.isUpcoming;
    if (filter === 'beat')     return !e.isUpcoming && (e.surprisePct ?? 0) > 0;
    if (filter === 'miss')     return !e.isUpcoming && e.surprisePct != null && e.surprisePct < 0;
    return true;
  });

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: 'all',      label: 'Tất cả' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'beat',     label: 'Beat' },
    { id: 'miss',     label: 'Miss' },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-teal-400 shrink-0" />
          <span className="text-sm font-bold text-slate-200">Earnings Calendar</span>
          {loading && <RefreshCw size={12} className="animate-spin text-slate-400" />}
        </div>

        {/* Summary cards */}
        <div className="flex gap-2 flex-wrap">
          <SummaryCard
            label="Upcoming (30d)"
            value={upcomingCount > 0 ? String(upcomingCount) : '0'}
            color="text-blue-300"
          />
          <SummaryCard
            label="Beat rate"
            value={beatRate != null ? `${beatRate}%` : null}
            color="text-emerald-300"
          />
          <SummaryCard
            label="Avg surprise"
            value={avgSurprise != null ? `${avgSurprise >= 0 ? '+' : ''}${avgSurprise.toFixed(1)}%` : null}
            color={avgSurprise != null ? (avgSurprise >= 0 ? 'text-emerald-300' : 'text-rose-300') : 'text-slate-400'}
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-1 ml-auto">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-xs transition-colors border ${
                filter === f.id
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-700 border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-md transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      {!error && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-[10px] uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Ticker</th>
                  <th className="px-4 py-3 font-medium">Ngày công bố</th>
                  <th className="px-4 py-3 font-medium text-right">EPS estimate</th>
                  <th className="px-4 py-3 font-medium text-right">EPS actual</th>
                  <th className="px-4 py-3 font-medium text-right">Surprise</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading && entries.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-slate-700 rounded w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.length === 0
                  ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-sm">
                          {watchlistTickers.length === 0
                            ? 'Watchlist trống — thêm ticker để xem earnings'
                            : 'Không có dữ liệu phù hợp'}
                        </td>
                      </tr>
                    )
                  : filtered.map(entry => (
                      <EarningsRow
                        key={entry.ticker}
                        entry={entry}
                        expanded={expanded === entry.ticker}
                        onToggle={() => setExpanded(p => p === entry.ticker ? null : entry.ticker)}
                        onTickerClick={onTickerClick}
                      />
                    ))
                }
              </tbody>
            </table>
          </div>

          {result && (
            <div className="px-4 py-2 border-t border-slate-700/50 text-[10px] text-slate-600 flex items-center gap-1">
              <Clock size={10} />
              Cập nhật: {new Date(result.fetchedAt).toLocaleTimeString('vi-VN')} · Cache 30 phút · EPS tính bằng VND/cổ phiếu
            </div>
          )}
        </div>
      )}
    </div>
  );
}
