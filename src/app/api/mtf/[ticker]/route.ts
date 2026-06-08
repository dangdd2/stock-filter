import { NextResponse } from 'next/server';
import { RSI, MACD, StochasticRSI, BollingerBands } from 'technicalindicators';

export const revalidate = 0;

export type Timeframe = 'D' | 'W' | 'M';

export interface TimeframeData {
  timeframe: Timeframe;
  label: string;
  // Indicators
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  price: number | null;
  // Derived signals
  rsiZone: 'oversold' | 'neutral' | 'overbought' | null;
  macdTrend: 'bullish' | 'bearish' | null;
  stochZone: 'oversold' | 'neutral' | 'overbought' | null;
  bbPosition: 'below' | 'inside' | 'above' | null;
  // Overall signal score: -2..+2
  score: number;
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  closes: number[];
  error?: string;
}

export interface MultiTimeframeResult {
  ticker: string;
  daily: TimeframeData;
  weekly: TimeframeData;
  monthly: TimeframeData;
  alignment: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  alignmentScore: number; // -6..+6
}

async function fetchTimeframe(symbol: string, interval: string, range: string, tf: Timeframe): Promise<TimeframeData> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  const label = tf === 'D' ? 'Daily' : tf === 'W' ? 'Weekly' : 'Monthly';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('No data');

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators.quote[0];
    const closes: number[] = quote.close || [];
    const highs: number[] = quote.high || [];
    const lows: number[] = quote.low || [];
    const volumes: number[] = quote.volume || [];

    // filter nulls
    const valid: { close: number; high: number; low: number; volume: number }[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] != null && highs[i] != null && lows[i] != null) {
        valid.push({ close: closes[i], high: highs[i], low: lows[i], volume: volumes[i] ?? 0 });
      }
    }
    void timestamps;

    if (valid.length < 14) throw new Error('Not enough candles');

    const c = valid.map(d => d.close);

    const rsiArr = RSI.calculate({ values: c, period: 14 });
    const macdArr = MACD.calculate({ values: c, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    const stochArr = StochasticRSI.calculate({ values: c, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 });
    const bbArr = BollingerBands.calculate({ values: c, period: 20, stdDev: 2 });

    const rsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : null;
    const macdLast = macdArr.length > 0 ? macdArr[macdArr.length - 1] : null;
    const stochLast = stochArr.length > 0 ? stochArr[stochArr.length - 1] : null;
    const bbLast = bbArr.length > 0 ? bbArr[bbArr.length - 1] : null;

    const price = c[c.length - 1];

    // Derived signals
    const rsiZone: TimeframeData['rsiZone'] =
      rsi == null ? null : rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral';
    const macdTrend: TimeframeData['macdTrend'] =
      macdLast?.histogram == null ? null : macdLast.histogram > 0 ? 'bullish' : 'bearish';
    const stochZone: TimeframeData['stochZone'] =
      stochLast == null ? null : (stochLast as { k: number }).k < 20 ? 'oversold' : (stochLast as { k: number }).k > 80 ? 'overbought' : 'neutral';
    const bbPosition: TimeframeData['bbPosition'] =
      bbLast == null ? null : price > bbLast.upper ? 'above' : price < bbLast.lower ? 'below' : 'inside';

    // Score: each signal contributes -1..+1
    let score = 0;
    if (rsiZone === 'oversold') score += 1;
    else if (rsiZone === 'overbought') score -= 1;
    if (macdTrend === 'bullish') score += 1;
    else if (macdTrend === 'bearish') score -= 1;
    if (stochZone === 'oversold') score += 1;
    else if (stochZone === 'overbought') score -= 1;
    if (bbPosition === 'below') score += 1;
    else if (bbPosition === 'above') score -= 1;

    const signal: TimeframeData['signal'] =
      score >= 3 ? 'strong_buy' : score >= 1 ? 'buy' : score <= -3 ? 'strong_sell' : score <= -1 ? 'sell' : 'neutral';

    return {
      timeframe: tf, label,
      rsi, stochK: stochLast ? (stochLast as { k: number }).k : null,
      stochD: stochLast ? (stochLast as { d: number }).d : null,
      macd: macdLast?.MACD ?? null,
      macdSignal: macdLast?.signal ?? null,
      macdHistogram: macdLast?.histogram ?? null,
      bbUpper: bbLast?.upper ?? null, bbMiddle: bbLast?.middle ?? null, bbLower: bbLast?.lower ?? null,
      price, rsiZone, macdTrend, stochZone, bbPosition, score, signal,
      closes: c.slice(-30),
    };
  } catch (e) {
    return {
      timeframe: tf, label, rsi: null, stochK: null, stochD: null,
      macd: null, macdSignal: null, macdHistogram: null,
      bbUpper: null, bbMiddle: null, bbLower: null, price: null,
      rsiZone: null, macdTrend: null, stochZone: null, bbPosition: null,
      score: 0, signal: 'neutral', closes: [],
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const symbol = `${ticker.toUpperCase()}.VN`;

    const [daily, weekly, monthly] = await Promise.all([
      fetchTimeframe(symbol, '1d', '6mo', 'D'),
      fetchTimeframe(symbol, '1wk', '2y', 'W'),
      fetchTimeframe(symbol, '1mo', '5y', 'M'),
    ]);

    const alignmentScore = daily.score + weekly.score + monthly.score;
    const alignment: MultiTimeframeResult['alignment'] =
      alignmentScore >= 4 ? 'bullish' :
      alignmentScore <= -4 ? 'bearish' :
      Math.abs(alignmentScore) <= 1 ? 'neutral' : 'mixed';

    const result: MultiTimeframeResult = {
      ticker: ticker.toUpperCase(),
      daily, weekly, monthly,
      alignment, alignmentScore,
    };
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
