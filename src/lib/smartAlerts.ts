// ─────────────────────────────────────────────────────────────
// Smart Signal Alerts — pure logic layer
// No manual config — auto-detects patterns on each Refresh
// ─────────────────────────────────────────────────────────────

import type { StockIndicatorResult } from '@/types';

export type AlertType =
  | 'CONVICTION_3'       // RSI + Stoch + BB all oversold/overbought
  | 'MACD_BULL_CROSS'    // MACD just crossed above signal
  | 'MACD_BEAR_CROSS'    // MACD just crossed below signal
  | 'VOLUME_SPIKE'       // Rel Volume > 2.5x
  | 'MFI_EXIT_OVERSOLD'  // MFI crossed above 20 from below
  | 'MFI_EXIT_OVERBOUGHT'// MFI crossed below 80 from above
  | 'NEAR_6M_LOW'        // Price within 3% of 6-month low
  | 'NEAR_6M_HIGH'       // Price within 3% of 6-month high
  | 'BIG_MOVE_UP'        // Price up > 5% today
  | 'BIG_MOVE_DOWN'      // Price down > 5% today
  | 'BB_LOWER_BREAKOUT'  // Price just broke below BB lower
  | 'BB_UPPER_BREAKOUT'  // Price just broke above BB upper
  | 'RSI_EXIT_OVERSOLD'  // RSI crossed above 30
  | 'RSI_EXIT_OVERBOUGHT';// RSI crossed below 70

export interface AlertConfig {
  type: AlertType;
  label: string;
  emoji: string;
  description: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  priority: 'high' | 'medium' | 'low';
}

export const ALERT_CONFIG: Record<AlertType, AlertConfig> = {
  CONVICTION_3:        { type: 'CONVICTION_3',        label: 'Tín hiệu 3/3',          emoji: '🔥', description: 'RSI + Stoch + BB cùng lúc oversold/overbought', direction: 'bullish', priority: 'high' },
  MACD_BULL_CROSS:     { type: 'MACD_BULL_CROSS',     label: 'MACD Cắt Lên',           emoji: '🚀', description: 'MACD vừa cắt lên đường Signal — xu hướng tăng',  direction: 'bullish', priority: 'high' },
  MACD_BEAR_CROSS:     { type: 'MACD_BEAR_CROSS',     label: 'MACD Cắt Xuống',         emoji: '📉', description: 'MACD vừa cắt xuống đường Signal — xu hướng giảm', direction: 'bearish', priority: 'high' },
  VOLUME_SPIKE:        { type: 'VOLUME_SPIKE',         label: 'Volume Đột Biến',        emoji: '📊', description: 'Volume > 2.5x trung bình 20 ngày — dòng tiền lớn', direction: 'neutral', priority: 'high' },
  MFI_EXIT_OVERSOLD:   { type: 'MFI_EXIT_OVERSOLD',   label: 'MFI Thoát Quá Bán',      emoji: '💧', description: 'MFI vừa vượt 20 — dòng tiền quay lại',            direction: 'bullish', priority: 'medium' },
  MFI_EXIT_OVERBOUGHT: { type: 'MFI_EXIT_OVERBOUGHT', label: 'MFI Thoát Quá Mua',      emoji: '⚡', description: 'MFI vừa xuống 80 — dòng tiền rút lui',            direction: 'bearish', priority: 'medium' },
  NEAR_6M_LOW:         { type: 'NEAR_6M_LOW',         label: 'Gần Đáy 6 Tháng',        emoji: '🎯', description: 'Giá trong vòng 3% đáy 6 tháng — vùng hỗ trợ',    direction: 'bullish', priority: 'medium' },
  NEAR_6M_HIGH:        { type: 'NEAR_6M_HIGH',        label: 'Gần Đỉnh 6 Tháng',       emoji: '🏔️', description: 'Giá trong vòng 3% đỉnh 6 tháng — vùng kháng cự',  direction: 'bearish', priority: 'medium' },
  BIG_MOVE_UP:         { type: 'BIG_MOVE_UP',         label: 'Tăng Mạnh +5%',          emoji: '⬆️', description: 'Giá tăng hơn 5% trong ngày hôm nay',               direction: 'bullish', priority: 'medium' },
  BIG_MOVE_DOWN:       { type: 'BIG_MOVE_DOWN',       label: 'Giảm Mạnh -5%',          emoji: '⬇️', description: 'Giá giảm hơn 5% trong ngày hôm nay',               direction: 'bearish', priority: 'medium' },
  BB_LOWER_BREAKOUT:   { type: 'BB_LOWER_BREAKOUT',   label: 'BB Phá Dải Dưới',        emoji: '🔻', description: 'Giá vừa phá xuống dưới Bollinger Band lower',      direction: 'bearish', priority: 'medium' },
  BB_UPPER_BREAKOUT:   { type: 'BB_UPPER_BREAKOUT',   label: 'BB Phá Dải Trên',        emoji: '🔺', description: 'Giá vừa phá lên trên Bollinger Band upper',         direction: 'bullish', priority: 'medium' },
  RSI_EXIT_OVERSOLD:   { type: 'RSI_EXIT_OVERSOLD',   label: 'RSI Thoát Oversold',     emoji: '🌱', description: 'RSI vừa vượt 30 — thoát vùng quá bán',            direction: 'bullish', priority: 'low' },
  RSI_EXIT_OVERBOUGHT: { type: 'RSI_EXIT_OVERBOUGHT', label: 'RSI Thoát Overbought',   emoji: '🍂', description: 'RSI vừa xuống 70 — thoát vùng quá mua',           direction: 'bearish', priority: 'low' },
};

export interface SmartAlert {
  id: string;
  ticker: string;
  type: AlertType;
  price: number;
  timestamp: number;    // unix ms
  read: boolean;
  dismissed: boolean;
}

const STORAGE_KEY = 'vn_stock_smart_alerts';
const MAX_ALERTS  = 200;

// ── localStorage helpers ──────────────────────────────────────

export function loadAlerts(): SmartAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SmartAlert[]) : [];
  } catch { return []; }
}

export function saveAlerts(alerts: SmartAlert[]): void {
  if (typeof window === 'undefined') return;
  const trimmed = alerts.length > MAX_ALERTS ? alerts.slice(-MAX_ALERTS) : alerts;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function clearAlerts(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// ── Detection engine ──────────────────────────────────────────

/**
 * Scan a list of stocks and return new alerts not already in existing.
 * Deduplication: one alert per ticker+type per calendar day.
 */
export function detectAlerts(
  stocks: StockIndicatorResult[],
  existing: SmartAlert[],
): SmartAlert[] {
  const today = new Date().toDateString();
  // Build a set of already-fired keys today
  const firedToday = new Set(
    existing
      .filter(a => new Date(a.timestamp).toDateString() === today)
      .map(a => `${a.ticker}|${a.type}`),
  );

  const newAlerts: SmartAlert[] = [];

  for (const item of stocks) {
    if (item.error || !item.price) continue;

    const fire = (type: AlertType) => {
      const key = `${item.ticker}|${type}`;
      if (firedToday.has(key)) return;
      firedToday.add(key);
      newAlerts.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ticker: item.ticker,
        type,
        price: item.price,
        timestamp: Date.now(),
        read: false,
        dismissed: false,
      });
    };

    // ── Conviction 3/3 ─────────────────────────────────────
    const buySignals = [
      item.rsi    != null && item.rsi    < 30,
      item.stochK != null && item.stochK < 20,
      item.bbLower != null && item.price  < item.bbLower,
    ].filter(Boolean).length;
    const sellSignals = [
      item.rsi    != null && item.rsi    > 70,
      item.stochK != null && item.stochK > 80,
      item.bbUpper != null && item.price  > item.bbUpper,
    ].filter(Boolean).length;
    if (buySignals === 3 || sellSignals === 3) fire('CONVICTION_3');

    // ── MACD crossover ─────────────────────────────────────
    if (item.macdBullishCross) fire('MACD_BULL_CROSS');
    if (item.macdBearishCross) fire('MACD_BEAR_CROSS');

    // ── Volume spike ───────────────────────────────────────
    if (item.relVolume != null && item.relVolume > 2.5) fire('VOLUME_SPIKE');

    // ── MFI crossovers ─────────────────────────────────────
    if (item.mfi != null && item.mfiPrev != null) {
      if (item.mfiPrev <= 20 && item.mfi > 20) fire('MFI_EXIT_OVERSOLD');
      if (item.mfiPrev >= 80 && item.mfi < 80) fire('MFI_EXIT_OVERBOUGHT');
    }

    // ── Near 6-month extreme ───────────────────────────────
    if (item.distFromLow  != null && item.distFromLow  < 3)  fire('NEAR_6M_LOW');
    if (item.distFromHigh != null && item.distFromHigh > -3) fire('NEAR_6M_HIGH');

    // ── Big intraday move ──────────────────────────────────
    if (item.changePct != null && item.changePct >  5) fire('BIG_MOVE_UP');
    if (item.changePct != null && item.changePct < -5) fire('BIG_MOVE_DOWN');

    // ── BB breakouts ───────────────────────────────────────
    if (item.bbLowerBreakout) fire('BB_LOWER_BREAKOUT');
    if (item.bbUpperBreakout) fire('BB_UPPER_BREAKOUT');

    // ── RSI exits ──────────────────────────────────────────
    if (item.rsiBullishCross30) fire('RSI_EXIT_OVERSOLD');
    if (item.rsiBearishCross70) fire('RSI_EXIT_OVERBOUGHT');
  }

  return newAlerts;
}
