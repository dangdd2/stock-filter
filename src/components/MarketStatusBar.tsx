"use client";

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Clock, Zap, ZapOff } from 'lucide-react';
import { getMarketStatus, type MarketStatus } from '@/lib/marketStatus';

const INTERVAL_OPTIONS = [
  { label: '5m',  value: 5  },
  { label: '10m', value: 10 },
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
];

interface Props {
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export default function MarketStatusBar({ loading, lastUpdated, onRefresh }: Props) {
  const [status,       setStatus]       = useState<MarketStatus>(getMarketStatus());
  const [autoInterval, setAutoInterval] = useState<number | null>(null); // minutes, null = off
  const [countdown,    setCountdown]    = useState<number>(0);           // seconds until next auto-refresh
  const [nowStr,       setNowStr]       = useState('');

  // Tick every second — update market status, countdown, clock
  useEffect(() => {
    const tick = () => {
      setStatus(getMarketStatus());
      setNowStr(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh countdown
  useEffect(() => {
    if (autoInterval === null) { setCountdown(0); return; }
    setCountdown(autoInterval * 60);
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onRefresh();
          return autoInterval * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [autoInterval, onRefresh]);

  const toggleAuto = useCallback((mins: number) => {
    setAutoInterval(prev => prev === mins ? null : mins);
  }, []);

  const fmtCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const fmtLastUpdate = (d: Date | null) => {
    if (!d) return null;
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  };

  const dotPulse = status.isTrading ? 'animate-pulse' : '';

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs">

      {/* ── Market status indicator ── */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot} ${dotPulse}`} />
        <span className={`font-semibold ${
          status.color === 'green'  ? 'text-emerald-400' :
          status.color === 'yellow' ? 'text-yellow-400'  :
          status.color === 'orange' ? 'text-orange-400'  :
                                      'text-rose-400'
        }`}>
          {status.label}
        </span>
        {status.minutesUntilNext !== null && status.minutesUntilNext > 0 && (
          <span className="text-slate-500">
            · {status.nextEvent} ({status.minutesUntilNext}p nữa)
          </span>
        )}
        {status.minutesUntilNext === null && (
          <span className="text-slate-600">· {status.nextEvent}</span>
        )}
      </div>

      <div className="w-px h-4 bg-slate-700 hidden sm:block" />

      {/* ── Live clock (VN time) ── */}
      <div className="flex items-center gap-1.5 text-slate-400 font-mono">
        <Clock size={11} className="text-slate-500" />
        {nowStr}
        <span className="text-slate-600 font-sans">ICT</span>
      </div>

      {/* ── Last updated ── */}
      {lastUpdated && (
        <>
          <div className="w-px h-4 bg-slate-700 hidden sm:block" />
          <span className="text-slate-500">
            Cập nhật lúc <span className="text-slate-300 font-mono">{fmtLastUpdate(lastUpdated)}</span>
          </span>
        </>
      )}

      {/* ── Auto-refresh controls ── */}
      <div className="ml-auto flex items-center gap-2">
        {/* Countdown badge */}
        {autoInterval !== null && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-300">
            <Zap size={10} className="animate-pulse" />
            <span className="font-mono text-[11px]">{fmtCountdown(countdown)}</span>
          </div>
        )}

        {/* Interval selector */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 mr-1 hidden sm:inline">Auto:</span>
          {INTERVAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggleAuto(opt.value)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
                autoInterval === opt.value
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : 'text-slate-500 border-slate-700 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {autoInterval !== null && (
            <button
              onClick={() => setAutoInterval(null)}
              className="p-1 text-slate-500 hover:text-rose-400 transition-colors ml-0.5"
              title="Tắt auto-refresh"
            >
              <ZapOff size={13} />
            </button>
          )}
        </div>

        {/* Manual refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50 text-slate-300"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
}
