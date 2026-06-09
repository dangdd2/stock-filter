import { NextRequest, NextResponse } from 'next/server';
import { RSI, MACD, StochasticRSI, BollingerBands, SMA, EMA, ATR } from 'technicalindicators';

export const revalidate = 0;

export interface CompareTickerData {
  ticker: string;
  // Price summary
  price: number;
  change1d: number;   // %
  change1w: number;   // %
  change1m: number;   // %
  change3m: number;   // %
  change6m: number;   // %
  high52w: number;
  low52w: number;
  distFromHigh: number; // % from 52w high
  distFromLow: number;  // % from 52w low
  avgVolume20d: number;
  // Indicators (latest)
  rsi14: number | null;
  rsiZone: 'oversold' | 'neutral' | 'overbought' | null;
  macdHistogram: number | null;
  macdTrend: 'bullish' | 'bearish' | null;
  stochK: number | null;
  stochZone: 'oversold' | 'neutral' | 'overbought' | null;
  bbWidth: number | null;      // (upper-lower)/middle * 100 — volatility proxy
  bbPosition: number | null;   // 0=at lower, 1=at upper
  atr14: number | null;
  sma20: number | null;
  sma50: number | null;
  ema20: number | null;
  trendVsSma20: 'above' | 'below' | null;
  trendVsSma50: 'above' | 'below' | null;
  // Score
  score: number;   // -6..+6
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  // Chart data — normalized to 100 at start
  dates: number[];
  normalizedCloses: number[];  // indexed to 100
  rawCloses: number[];
  volumes: number[];
  error?: string;
}

export interface CompareResult {
  tickers: string[];
  data: CompareTickerData[];
  winner: string | null;   // ticker with highest score
  errors: Record<string, string>;
}

function pct(a: number, b: number) { return b === 0 ? 0 : ((a - b) / b) * 100; }

async function fetchTicker(ticker: string): Promise<CompareTickerData> {
  const symbol = `${ticker.toUpperCase()}.VN`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error('No data');

    const rawTs: number[] = result.timestamp || [];
    const q = result.indicators.quote[0];
    const rawC: (number | null)[] = q.close || [];
    const rawH: (number | null)[] = q.high || [];
    const rawL: (number | null)[] = q.low || [];
    const rawV: (number | null)[] = q.volume || [];

    const closes: number[] = [], highs: number[] = [], lows: number[] = [],
      volumes: number[] = [], dates: number[] = [];

    for (let i = 0; i < rawC.length; i++) {
      if (rawC[i] != null && rawH[i] != null && rawL[i] != null) {
        closes.push(rawC[i]!); highs.push(rawH[i]!); lows.push(rawL[i]!);
        volumes.push(rawV[i] ?? 0); dates.push(rawTs[i]);
      }
    }
    if (closes.length < 20) throw new Error('Not enough data');

    const price = closes[closes.length - 1];
    const n = closes.length;
    const ago = (d: number) => closes[Math.max(0, n - d - 1)];

    // price changes
    const change1d = pct(price, ago(1));
    const change1w = pct(price, ago(5));
    const change1m = pct(price, ago(21));
    const change3m = pct(price, ago(63));
    const change6m = pct(price, ago(126));

    // 52w high/low
    const high52w = Math.max(...highs);
    const low52w  = Math.min(...lows);
    const distFromHigh = pct(price, high52w);
    const distFromLow  = pct(price, low52w);

    const avgVolume20d = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;

    // Indicators
    const rsiArr  = RSI.calculate({ values: closes, period: 14 });
    const macdArr = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    const stochArr = StochasticRSI.calculate({ values: closes, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 });
    const bbArr   = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
    const sma20Arr = SMA.calculate({ values: closes, period: 20 });
    const sma50Arr = SMA.calculate({ values: closes, period: 50 });
    const ema20Arr = EMA.calculate({ values: closes, period: 20 });
    const atrArr  = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

    const rsi14 = rsiArr.at(-1) ?? null;
    const macdLast = macdArr.at(-1);
    const stochLast = stochArr.at(-1) as { k: number; d: number } | undefined;
    const bbLast  = bbArr.at(-1);
    const sma20   = sma20Arr.at(-1) ?? null;
    const sma50   = sma50Arr.at(-1) ?? null;
    const ema20   = ema20Arr.at(-1) ?? null;
    const atr14   = atrArr.at(-1) ?? null;

    const bbWidth = bbLast ? ((bbLast.upper - bbLast.lower) / bbLast.middle) * 100 : null;
    const bbPosition = bbLast ? Math.max(0, Math.min(1, (price - bbLast.lower) / (bbLast.upper - bbLast.lower))) : null;

    const rsiZone: CompareTickerData['rsiZone'] = rsi14 == null ? null : rsi14 < 30 ? 'oversold' : rsi14 > 70 ? 'overbought' : 'neutral';
    const macdTrend: CompareTickerData['macdTrend'] = macdLast?.histogram == null ? null : macdLast.histogram > 0 ? 'bullish' : 'bearish';
    const stochZone: CompareTickerData['stochZone'] = !stochLast ? null : stochLast.k < 20 ? 'oversold' : stochLast.k > 80 ? 'overbought' : 'neutral';
    const trendVsSma20: CompareTickerData['trendVsSma20'] = sma20 == null ? null : price > sma20 ? 'above' : 'below';
    const trendVsSma50: CompareTickerData['trendVsSma50'] = sma50 == null ? null : price > sma50 ? 'above' : 'below';

    let score = 0;
    if (rsiZone === 'oversold') score += 1; else if (rsiZone === 'overbought') score -= 1;
    if (macdTrend === 'bullish') score += 1; else if (macdTrend === 'bearish') score -= 1;
    if (stochZone === 'oversold') score += 1; else if (stochZone === 'overbought') score -= 1;
    if (trendVsSma20 === 'above') score += 1; else if (trendVsSma20 === 'below') score -= 1;
    if (trendVsSma50 === 'above') score += 1; else if (trendVsSma50 === 'below') score -= 1;
    if (change1m > 5) score += 1; else if (change1m < -5) score -= 1;

    const signal: CompareTickerData['signal'] =
      score >= 4 ? 'strong_buy' : score >= 2 ? 'buy' : score <= -4 ? 'strong_sell' : score <= -2 ? 'sell' : 'neutral';

    // Normalized closes (base 100 at first close)
    const base = closes[0];
    const normalizedCloses = closes.map(c => (c / base) * 100);

    return {
      ticker: ticker.toUpperCase(), price, change1d, change1w, change1m, change3m, change6m,
      high52w, low52w, distFromHigh, distFromLow, avgVolume20d,
      rsi14, rsiZone, macdHistogram: macdLast?.histogram ?? null, macdTrend,
      stochK: stochLast?.k ?? null, stochZone, bbWidth, bbPosition,
      atr14, sma20, sma50, ema20, trendVsSma20, trendVsSma50,
      score, signal, dates, normalizedCloses, rawCloses: closes, volumes,
    };
  } catch (e) {
    return {
      ticker: ticker.toUpperCase(), price: 0, change1d: 0, change1w: 0, change1m: 0, change3m: 0, change6m: 0,
      high52w: 0, low52w: 0, distFromHigh: 0, distFromLow: 0, avgVolume20d: 0,
      rsi14: null, rsiZone: null, macdHistogram: null, macdTrend: null,
      stochK: null, stochZone: null, bbWidth: null, bbPosition: null,
      atr14: null, sma20: null, sma50: null, ema20: null, trendVsSma20: null, trendVsSma50: null,
      score: 0, signal: 'neutral', dates: [], normalizedCloses: [], rawCloses: [], volumes: [],
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTickers: string[] = body.tickers ?? [];
    if (rawTickers.length < 2 || rawTickers.length > 3) {
      return NextResponse.json({ error: 'Cần 2 hoặc 3 mã cổ phiếu' }, { status: 400 });
    }
    const tickers = rawTickers.map((t: string) => t.trim().toUpperCase());
    const results = await Promise.all(tickers.map(t => fetchTicker(t)));
    const errors: Record<string, string> = {};
    results.forEach(r => { if (r.error) errors[r.ticker] = r.error; });
    const best = results.reduce((a, b) => a.score > b.score ? a : b);
    const winner = results.filter(r => !r.error).length > 1 ? best.ticker : null;
    return NextResponse.json({ tickers, data: results, winner, errors } satisfies CompareResult);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
