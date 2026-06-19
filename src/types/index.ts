export interface Watchlist {
  id: string;
  name: string;
  tickers: string[];
}

export interface StockIndicatorResult {
  ticker: string;
  price: number;
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  volume: number;
  timestamp: number;
  pe?: number | null;
  eps?: number | null;
  beta?: number | null;
  marketCap?: number | null;
  bookValue?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  closes7d?: number[];
  closes60d?: number[];
  closes6m?: number[];
  highs6m?: number[];
  lows6m?: number[];
  change?: number | null;
  changePct?: number | null;
  change1w?: number | null;
  change1m?: number | null;
  change3m?: number | null;
  change6m?: number | null;
  high52w?: number | null;
  low52w?: number | null;
  distFromHigh?: number | null;
  distFromLow?: number | null;
  consecutiveUp?: number | null;
  consecutiveDown?: number | null;
  avgVolume20d?: number | null;
  relVolume?: number | null;
  mfi?: number | null;
  mfiPrev?: number | null;
  obvTrend?: number | null;
  macdBullishCross?: boolean;
  macdBearishCross?: boolean;
  macdAboveZero?: boolean;
  bbUpperBreakout?: boolean;
  bbLowerBreakout?: boolean;
  bbUpperReentry?: boolean;
  bbLowerReentry?: boolean;
  rsiBullishCross30?: boolean;
  rsiBearishCross70?: boolean;
  error?: string;
}

export type RsiFilter   = 'ALL' | 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
export type MacdFilter  = 'ALL' | 'BULLISH' | 'BEARISH';
export type StochFilter = 'ALL' | 'OVERSOLD' | 'OVERBOUGHT' | 'BULLISH_CROSS' | 'BEARISH_CROSS';
// ActiveTab moved to @/components/layout/Header (single source of truth for tab list)

export const MASTER_ID = 'master';
