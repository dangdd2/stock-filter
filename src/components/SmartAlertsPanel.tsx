"use client";

import { useMemo, useState } from 'react';
import { Bell, BellOff, Trash2, CheckCheck, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';
import { type SmartAlert, type AlertType, ALERT_CONFIG, clearAlerts } from '@/lib/smartAlerts';

interface Props {
  alerts: SmartAlert[];
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onClear: () => void;
  onTickerClick: (ticker: string) => void;
}

type DirectionFilter = 'ALL' | 'bullish' | 'bearish' | 'neutral';
type PriorityFilter  = 'ALL' | 'high' | 'medium' | 'low';

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'vừa xong';
  if (diffMin < 60) return `${diffMin}p trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h trước`;
  return d.toLocaleDateString('vi-VN');
}

export default function SmartAlertsPanel({ alerts, onMarkAllRead, onDismiss, onClear, onTickerClick }: Props) {
  const [dirFilter,  setDirFilter]  = useState<DirectionFilter>('ALL');
  const [priFilter,  setPriFilter]  = useState<PriorityFilter>('ALL');
  const [showRead,   setShowRead]   = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const visible = useMemo(() => {
    return alerts
      .filter(a => !a.dismissed)
      .filter(a => showRead || !a.read)
      .filter(a => dirFilter === 'ALL' || ALERT_CONFIG[a.type].direction === dirFilter)
      .filter(a => priFilter === 'ALL' || ALERT_CONFIG[a.type].priority === priFilter)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [alerts, dirFilter, priFilter, showRead]);

  const unread = alerts.filter(a => !a.dismissed && !a.read).length;

  // Stats
  const stats = useMemo(() => {
    const active = alerts.filter(a => !a.dismissed);
    const byType: Record<string, number> = {};
    active.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
    const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { total: active.length, unread: active.filter(a => !a.read).length, topTypes };
  }, [alerts]);

  if (alerts.filter(a => !a.dismissed).length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <BellOff size={36} className="mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400 font-medium mb-1">Chưa có alerts nào</p>
        <p className="text-slate-600 text-sm">Alerts sẽ tự động xuất hiện mỗi lần Refresh khi phát hiện pattern đặc biệt.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-amber-400" />
          <span className="text-sm font-bold text-slate-200">Smart Alerts</span>
          {unread > 0 && (
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-xs font-bold">
              {unread} chưa đọc
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          {stats.topTypes.map(([type, count]) => (
            <span key={type} className="flex items-center gap-1">
              <span>{ALERT_CONFIG[type as AlertType]?.emoji}</span>
              <span className="text-slate-400">{ALERT_CONFIG[type as AlertType]?.label}</span>
              <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">{count}</span>
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {unread > 0 && (
            <button onClick={onMarkAllRead}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-400 hover:text-slate-200 bg-slate-700/50 hover:bg-slate-700 rounded-md text-xs transition-colors">
              <CheckCheck size={12} /> Đọc tất cả
            </button>
          )}
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400">Xóa tất cả?</span>
              <button onClick={() => { onClear(); setConfirmClear(false); }}
                className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-xs hover:bg-rose-500/30">Xác nhận</button>
              <button onClick={() => setConfirmClear(false)}
                className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600">Hủy</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md text-xs transition-colors">
              <Trash2 size={12} /> Xóa hết
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3">
        <Filter size={13} className="text-slate-500" />

        {/* Direction */}
        <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs">
          {(['ALL', 'bullish', 'bearish', 'neutral'] as DirectionFilter[]).map(d => (
            <button key={d} onClick={() => setDirFilter(d)}
              className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${dirFilter === d
                ? d === 'bullish' ? 'bg-emerald-500/20 text-emerald-300'
                : d === 'bearish' ? 'bg-rose-500/20 text-rose-300'
                : d === 'neutral' ? 'bg-slate-600 text-slate-200'
                : 'bg-blue-500/20 text-blue-300'
                : 'text-slate-400 hover:bg-slate-700'}`}>
              {d === 'bullish' ? <TrendingUp size={11} /> : d === 'bearish' ? <TrendingDown size={11} /> : d === 'neutral' ? <Minus size={11} /> : null}
              {d === 'ALL' ? 'Tất cả' : d === 'bullish' ? 'Tăng' : d === 'bearish' ? 'Giảm' : 'Trung lập'}
            </button>
          ))}
        </div>

        {/* Priority */}
        <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs">
          {(['ALL', 'high', 'medium', 'low'] as PriorityFilter[]).map(p => (
            <button key={p} onClick={() => setPriFilter(p)}
              className={`px-2.5 py-1.5 transition-colors ${priFilter === p
                ? p === 'high' ? 'bg-rose-500/20 text-rose-300'
                : p === 'medium' ? 'bg-amber-500/20 text-amber-300'
                : p === 'low' ? 'bg-slate-600 text-slate-300'
                : 'bg-blue-500/20 text-blue-300'
                : 'text-slate-400 hover:bg-slate-700'}`}>
              {p === 'ALL' ? 'Mọi mức' : p === 'high' ? '🔴 Cao' : p === 'medium' ? '🟡 TB' : '🔵 Thấp'}
            </button>
          ))}
        </div>

        {/* Show read toggle */}
        <button onClick={() => setShowRead(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors border ${showRead ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>
          {showRead ? <Bell size={11} /> : <BellOff size={11} />}
          {showRead ? 'Ẩn đã đọc' : 'Hiện đã đọc'}
        </button>

        <span className="ml-auto text-xs text-slate-500">{visible.length} alerts</span>
      </div>

      {/* Alert list */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">Không có alerts khớp bộ lọc</div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {visible.map(alert => {
              const cfg = ALERT_CONFIG[alert.type];
              const dirColor = cfg.direction === 'bullish' ? 'border-l-emerald-500' : cfg.direction === 'bearish' ? 'border-l-rose-500' : 'border-l-slate-500';
              const priDot = cfg.priority === 'high' ? 'bg-rose-400' : cfg.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-500';

              return (
                <div key={alert.id}
                  className={`flex items-center gap-3 px-4 py-3 border-l-2 ${dirColor} ${alert.read ? 'opacity-60' : ''} hover:bg-slate-700/20 transition-colors`}>
                  {/* Priority dot */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${priDot}`} />

                  {/* Emoji */}
                  <span className="text-lg shrink-0">{cfg.emoji}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => onTickerClick(alert.ticker)}
                        className="font-bold text-slate-100 hover:text-blue-300 transition-colors text-sm">
                        {alert.ticker}
                      </button>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        cfg.direction === 'bullish' ? 'bg-emerald-500/15 text-emerald-400' :
                        cfg.direction === 'bearish' ? 'bg-rose-500/15 text-rose-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>{cfg.label}</span>
                      {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{cfg.description}</p>
                  </div>

                  {/* Price + time */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-slate-300">{alert.price.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{fmtTime(alert.timestamp)}</p>
                  </div>

                  {/* Dismiss */}
                  <button onClick={() => onDismiss(alert.id)}
                    className="p-1 text-slate-600 hover:text-slate-300 transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
