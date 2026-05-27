"use client";

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Trash2, ChevronDown, ChevronUp, BarChart2, Clock, Target, Award, AlertTriangle } from 'lucide-react';
import { SignalLog, BacktestStats, computeStats, clearSignalHistory } from '@/lib/signalHistory';

interface Props {
  logs: SignalLog[];
  onClear: () => void;
}

type DirectionFilter = 'ALL' | 'BUY' | 'SELL';
type SortKey = 'date' | 'ticker' | 'return7d' | 'conviction';

function ReturnBadge({ value, direction }: { value: number | null; direction: 'BUY' | 'SELL' }) {
  if (value === null) return <span className="text-slate-600 text-xs">—</span>;
  const isWin = direction === 'BUY' ? value > 0 : value < 0;
  const color = isWin ? 'text-emerald-400' : 'text-rose-400';
  const sign = value > 0 ? '+' : '';
  return <span className={`font-mono text-xs font-semibold ${color}`}>{sign}{value.toFixed(2)}%</span>;
}

function StatCard({ label, value, sub, color = 'text-slate-200' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50 flex flex-col gap-1">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

function WinRateBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-slate-600 text-xs">—</span>;
  const color = rate >= 60 ? 'bg-emerald-500' : rate >= 45 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden w-16">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${rate >= 60 ? 'text-emerald-400' : rate >= 45 ? 'text-amber-400' : 'text-rose-400'}`}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

export default function SignalHistoryPanel({ logs, onClear }: Props) {
  const [dirFilter, setDirFilter] = useState<DirectionFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const stats: BacktestStats = useMemo(() => computeStats(logs, dirFilter), [logs, dirFilter]);

  const filtered = useMemo(() => {
    let list = dirFilter === 'ALL' ? logs : logs.filter(l => l.direction === dirFilter);
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'ticker') cmp = a.ticker.localeCompare(b.ticker);
      else if (sortKey === 'return7d') cmp = (a.return7d ?? -999) - (b.return7d ?? -999);
      else if (sortKey === 'conviction') cmp = a.convictionScore - b.convictionScore;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [logs, dirFilter, sortKey, sortAsc]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortAsc ? <ChevronUp size={11} className="inline ml-0.5" /> : <ChevronDown size={11} className="inline ml-0.5" />)
      : null;

  if (logs.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
        <Clock size={32} className="mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400 font-medium mb-1">Chưa có lịch sử tín hiệu</p>
        <p className="text-slate-600 text-sm">Tín hiệu sẽ tự động được ghi lại mỗi khi bạn nhấn Refresh. Sau 3, 7, 14 ngày, kết quả sẽ được điền vào.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Stats Overview ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={15} className="text-violet-400" />
            <span className="text-sm font-bold text-slate-200">Thống Kê Hiệu Quả</span>
          </div>
          {/* Direction filter */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
            {(['ALL', 'BUY', 'SELL'] as DirectionFilter[]).map(d => (
              <button key={d} onClick={() => { setDirFilter(d); setPage(0); }}
                className={`px-3 py-1 transition-colors ${dirFilter === d ? (d === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : d === 'SELL' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300') : 'text-slate-400 hover:bg-slate-700'}`}>
                {d === 'ALL' ? 'Tất cả' : d === 'BUY' ? 'MUA' : 'BÁN'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          <StatCard label="Tổng tín hiệu" value={String(stats.total)} color="text-slate-200" />
          <StatCard
            label="Win Rate 3 ngày"
            value={stats.winRate3d !== null ? `${stats.winRate3d}%` : '—'}
            sub={stats.resolved3d > 0 ? `${stats.resolved3d} resolved` : 'chưa đủ dữ liệu'}
            color={stats.winRate3d !== null ? (stats.winRate3d >= 55 ? 'text-emerald-400' : stats.winRate3d >= 45 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-500'}
          />
          <StatCard
            label="Win Rate 7 ngày"
            value={stats.winRate7d !== null ? `${stats.winRate7d}%` : '—'}
            sub={stats.resolved7d > 0 ? `${stats.resolved7d} resolved` : 'chưa đủ dữ liệu'}
            color={stats.winRate7d !== null ? (stats.winRate7d >= 55 ? 'text-emerald-400' : stats.winRate7d >= 45 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-500'}
          />
          <StatCard
            label="Win Rate 14 ngày"
            value={stats.winRate14d !== null ? `${stats.winRate14d}%` : '—'}
            sub={stats.resolved14d > 0 ? `${stats.resolved14d} resolved` : 'chưa đủ dữ liệu'}
            color={stats.winRate14d !== null ? (stats.winRate14d >= 55 ? 'text-emerald-400' : stats.winRate14d >= 45 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-500'}
          />
          <StatCard
            label="Avg Return 7d"
            value={stats.avgReturn7d !== null ? `${stats.avgReturn7d > 0 ? '+' : ''}${stats.avgReturn7d}%` : '—'}
            color={stats.avgReturn7d !== null ? (stats.avgReturn7d > 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}
          />
          <StatCard
            label="Tốt nhất (7d)"
            value={stats.bestTicker ? stats.bestTicker.ticker : '—'}
            sub={stats.bestTicker ? `${stats.bestTicker.return7d > 0 ? '+' : ''}${stats.bestTicker.return7d}%` : undefined}
            color="text-emerald-400"
          />
          <StatCard
            label="Tệ nhất (7d)"
            value={stats.worstTicker ? stats.worstTicker.ticker : '—'}
            sub={stats.worstTicker ? `${stats.worstTicker.return7d > 0 ? '+' : ''}${stats.worstTicker.return7d}%` : undefined}
            color="text-rose-400"
          />
        </div>

        {/* Conviction breakdown */}
        <div className="border-t border-slate-700/50 pt-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Award size={11} /> Win Rate 7d theo mức độ conviction
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(score => {
              const c = stats.byConviction[score];
              return (
                <div key={score} className="bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-400 font-medium">{score}/3 conviction</span>
                    <span className="text-[10px] text-slate-600">{c.total} tín hiệu</span>
                  </div>
                  <WinRateBar rate={c.winRate7d} />
                  {c.resolved7d > 0 && (
                    <p className="text-[10px] text-slate-600 mt-1">{c.wins7d}/{c.resolved7d} thắng</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Log Table ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Clock size={14} className="text-slate-500" />
            Lịch Sử Tín Hiệu
            <span className="text-xs text-slate-600 font-normal">({filtered.length} entries)</span>
          </span>
          <div className="flex items-center gap-2">
            {showConfirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-400">Xóa tất cả?</span>
                <button onClick={() => { onClear(); setShowConfirmClear(false); }}
                  className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-xs hover:bg-rose-500/30">
                  Xác nhận
                </button>
                <button onClick={() => setShowConfirmClear(false)}
                  className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600">
                  Hủy
                </button>
              </div>
            ) : (
              <button onClick={() => setShowConfirmClear(true)}
                className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-rose-400 text-xs rounded hover:bg-rose-500/10 transition-colors">
                <Trash2 size={12} /> Xóa lịch sử
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50 bg-slate-900/30">
                <th className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-slate-300" onClick={() => toggleSort('date')}>
                  Ngày <SortIcon k="date" />
                </th>
                <th className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-slate-300" onClick={() => toggleSort('ticker')}>
                  Ticker <SortIcon k="ticker" />
                </th>
                <th className="text-left px-4 py-2.5 font-medium">Loại</th>
                <th className="text-left px-4 py-2.5 font-medium">Tín hiệu</th>
                <th className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-slate-300" onClick={() => toggleSort('conviction')}>
                  Conv. <SortIcon k="conviction" />
                </th>
                <th className="text-right px-4 py-2.5 font-medium">Giá vào</th>
                <th className="text-right px-4 py-2.5 font-medium">Target</th>
                <th className="text-right px-4 py-2.5 font-medium">3 ngày</th>
                <th className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-slate-300" onClick={() => toggleSort('return7d')}>
                  7 ngày <SortIcon k="return7d" />
                </th>
                <th className="text-right px-4 py-2.5 font-medium">14 ngày</th>
                <th className="text-right px-4 py-2.5 font-medium">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {paged.map(log => {
                const isResolved14d = log.return14d !== null;
                const latestReturn = log.return14d ?? log.return7d ?? log.return3d;
                const isWin = latestReturn !== null && (log.direction === 'BUY' ? latestReturn > 0 : latestReturn < 0);
                const isPending = log.return3d === null;

                return (
                  <tr key={log.id} className={`hover:bg-slate-700/20 transition-colors ${isResolved14d ? '' : 'opacity-90'}`}>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{log.date}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-200">{log.ticker}</td>
                    <td className="px-4 py-2.5">
                      {log.direction === 'BUY'
                        ? <span className="flex items-center gap-1 text-emerald-400 font-semibold"><TrendingUp size={11} /> MUA</span>
                        : <span className="flex items-center gap-1 text-rose-400 font-semibold"><TrendingDown size={11} /> BÁN</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {log.reasons.map(r => (
                          <span key={r} className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded text-[10px]">{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono font-bold ${log.convictionScore === 3 ? 'text-emerald-400' : log.convictionScore === 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {log.convictionScore}/3
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">{log.priceAtSignal.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                      {log.target ? Math.round(log.target).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ReturnBadge value={log.return3d} direction={log.direction} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ReturnBadge value={log.return7d} direction={log.direction} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ReturnBadge value={log.return14d} direction={log.direction} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isPending
                        ? <span className="text-slate-600 text-[10px] flex items-center justify-end gap-1"><Clock size={10} /> Chờ</span>
                        : isWin
                        ? <span className="text-emerald-400 font-bold text-[10px]">✓ Thắng</span>
                        : <span className="text-rose-400 font-bold text-[10px]">✗ Thua</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <span className="text-xs text-slate-500">
              Trang {page + 1} / {totalPages} ({filtered.length} entries)
            </span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 bg-slate-700 rounded text-xs disabled:opacity-30 hover:bg-slate-600 transition-colors">
                ← Trước
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-slate-700 rounded text-xs disabled:opacity-30 hover:bg-slate-600 transition-colors">
                Sau →
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="px-4 py-2.5 border-t border-slate-700/30 bg-slate-900/20">
          <div className="flex items-center gap-4 text-[10px] text-slate-600">
            <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-amber-500/60" /> Kết quả điền tự động mỗi lần Refresh sau 3, 7, 14 ngày kể từ ngày tín hiệu</span>
            <span className="flex items-center gap-1"><Target size={10} /> Target = BB Middle tại thời điểm tín hiệu</span>
          </div>
        </div>
      </div>
    </div>
  );
}
