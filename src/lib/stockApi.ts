import { RSI, MACD, StochasticRSI, BollingerBands, MFI, OBV } from 'technicalindicators';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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
  // Fundamental data
  pe?: number | null;
  eps?: number | null;
  beta?: number | null;
  marketCap?: number | null;
  bookValue?: number | null;
  // Bollinger Bands (20, 2)
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  // Last 7 daily closes for sparkline
  closes7d?: number[];
  closes60d?: number[];
  closes6m?: number[];
  // Day change
  change?: number | null;
  changePct?: number | null;
  // Price stats (computed from 6mo history)
  change1w?: number | null;   // % vs 5 sessions ago
  change1m?: number | null;   // % vs ~21 sessions ago
  change3m?: number | null;   // % vs ~63 sessions ago
  change6m?: number | null;   // % vs first session in 6mo data
  high52w?: number | null;    // 6mo high (proxy)
  low52w?: number | null;     // 6mo low (proxy)
  distFromHigh?: number | null; // % below 6mo high
  distFromLow?: number | null;  // % above 6mo low
  consecutiveUp?: number | null;   // consecutive sessions closing up
  consecutiveDown?: number | null; // consecutive sessions closing down
  avgVolume20d?: number | null;    // 20-day avg volume
  relVolume?: number | null;       // today volume / avgVolume20d
  // MFI & OBV
  mfi?: number | null;
  mfiPrev?: number | null;
  obvTrend?: number | null;
  // Crossover / event flags
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

export async function fetchStockData(ticker: string): Promise<StockIndicatorResult> {
  const symbol = `${ticker}.VN`;
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`;

  try {
    // Fetch chart data (essential)
    const chartRes = await fetch(chartUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!chartRes.ok) throw new Error(`Failed to fetch chart for ${ticker}`);
    const chartData = await chartRes.json();
    const result = chartData.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${ticker}`);

    // Fetch fundamental data (optional)
    let pe: number | null = null;
    let eps: number | null = null;
    let beta: number | null = null;
    let marketCap: number | null = null;
    let bookValue: number | null = null;
    try {
      const summary = await yf.quoteSummary(symbol, { modules: ['defaultKeyStatistics', 'summaryDetail'] });
      pe = summary.summaryDetail?.trailingPE ?? summary.summaryDetail?.forwardPE ?? null;
      eps = summary.defaultKeyStatistics?.trailingEps ?? summary.defaultKeyStatistics?.forwardEps ?? null;
      beta = summary.defaultKeyStatistics?.beta ?? summary.summaryDetail?.beta ?? null;
      marketCap = summary.summaryDetail?.marketCap ?? null;
      bookValue = summary.defaultKeyStatistics?.bookValue ?? null;
    } catch (e) {
      console.warn(`Fundamental data fetch failed for ${ticker}`, e);
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0];
    const closes: number[] = quote.close || [];
    const highs:  number[] = quote.high  || [];
    const lows:   number[] = quote.low   || [];
    const volumes: number[] = quote.volume || [];

    // Filter out nulls
    const validData = [];
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined &&
          highs[i]  !== null && highs[i]  !== undefined &&
          lows[i]   !== null && lows[i]   !== undefined) {
        validData.push({
          close:  closes[i],
          high:   highs[i],
          low:    lows[i],
          volume: volumes[i] ?? 0,
          time:   timestamps[i],
        });
      }
    }

    if (validData.length < 30) {
      throw new Error(`Not enough data for ${ticker}`);
    }

    const closePrices  = validData.map(d => d.close);
    const highPrices   = validData.map(d => d.high);
    const lowPrices    = validData.map(d => d.low);
    const volumeSeries = validData.map(d => d.volume);
    const lastData = validData[validData.length - 1];

    const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
    const macdValues = MACD.calculate({
      values: closePrices,
      fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
      SimpleMAOscillator: false, SimpleMASignal: false,
    });
    const stochRsiValues = StochasticRSI.calculate({
      values: closePrices, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3,
    });
    const lastStoch = stochRsiValues.length > 0 ? stochRsiValues[stochRsiValues.length - 1] : null;
    const bbValues  = BollingerBands.calculate({ values: closePrices, period: 20, stdDev: 2 });
    const lastBb    = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null;

    // ── MFI (Money Flow Index, period 14) ────────────────────
    const mfiValues = MFI.calculate({
      high: highPrices, low: lowPrices, close: closePrices,
      volume: volumeSeries, period: 14,
    });
    const lastMfi  = mfiValues.length > 0 ? mfiValues[mfiValues.length - 1] : null;
    const prevMfi  = mfiValues.length > 1 ? mfiValues[mfiValues.length - 2] : null;

    // ── OBV (On-Balance Volume) ───────────────────────────────
    const obvValues = OBV.calculate({ close: closePrices, volume: volumeSeries });
    const lastObv  = obvValues.length > 0 ? obvValues[obvValues.length - 1] : null;
    // OBV trend: compare last 5 vs last 10 avg (rising = positive)
    const obvTrend = obvValues.length >= 10
      ? (obvValues.slice(-5).reduce((s,v)=>s+v,0)/5) - (obvValues.slice(-10,-5).reduce((s,v)=>s+v,0)/5)
      : null;

    // ── Previous candle data for crossover detection ──────────
    const prevMacd      = macdValues.length > 1 ? macdValues[macdValues.length - 2] : null;
    const prevBb        = bbValues.length    > 1 ? bbValues[bbValues.length - 2]     : null;
    const prevRsi       = rsiValues.length   > 1 ? rsiValues[rsiValues.length - 2]   : null;
    const lastMacdVal   = macdValues.length  > 0 ? macdValues[macdValues.length - 1] : null;

    // ── Price stats from 6mo history ─────────────────────────
    const last   = closePrices[closePrices.length - 1];
    const pctChg = (base: number | undefined) =>
      base && base > 0 ? ((last - base) / base) * 100 : null;

    const change1w = pctChg(closePrices[closePrices.length - 6]);   // ~5 sessions
    const change1m = pctChg(closePrices[closePrices.length - 22]);  // ~21 sessions
    const change3m = pctChg(closePrices[closePrices.length - 64]);  // ~63 sessions
    const change6m = pctChg(closePrices[0]);

    const high52w = Math.max(...closePrices);
    const low52w  = Math.min(...closePrices);
    const distFromHigh = ((last - high52w) / high52w) * 100; // negative = below high
    const distFromLow  = ((last - low52w)  / low52w)  * 100; // positive = above low

    // Consecutive up/down sessions
    let consecutiveUp = 0;
    let consecutiveDown = 0;
    for (let i = closePrices.length - 1; i > 0; i--) {
      if (closePrices[i] > closePrices[i - 1]) {
        if (consecutiveDown > 0) break;
        consecutiveUp++;
      } else if (closePrices[i] < closePrices[i - 1]) {
        if (consecutiveUp > 0) break;
        consecutiveDown++;
      } else break;
    }

    // 20-day avg volume + relative volume
    const volSeries = validData.map(d => d.volume);
    const avgVolume20d = volSeries.length >= 20
      ? volSeries.slice(-20).reduce((s, v) => s + v, 0) / 20
      : null;
    const relVolume = avgVolume20d && avgVolume20d > 0
      ? lastData.volume / avgVolume20d
      : null;

    return {
      ticker,
      price: lastData.close,
      volume: lastData.volume,
      timestamp: lastData.time,
      rsi: rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null,
      stochK: lastStoch ? (lastStoch as { k: number }).k : null,
      stochD: lastStoch ? (lastStoch as { d: number }).d : null,
      macd: macdValues.length > 0 ? macdValues[macdValues.length - 1].MACD || null : null,
      macdSignal: macdValues.length > 0 ? macdValues[macdValues.length - 1].signal || null : null,
      macdHistogram: macdValues.length > 0 ? macdValues[macdValues.length - 1].histogram || null : null,
      bbUpper: lastBb?.upper ?? null,
      bbMiddle: lastBb?.middle ?? null,
      bbLower: lastBb?.lower ?? null,
      closes7d: closePrices.slice(-7),
      closes60d: closePrices.slice(-60),
      closes6m: closePrices,
      change: closePrices.length >= 2 ? closePrices[closePrices.length - 1] - closePrices[closePrices.length - 2] : null,
      changePct: closePrices.length >= 2 ? ((closePrices[closePrices.length - 1] - closePrices[closePrices.length - 2]) / closePrices[closePrices.length - 2]) * 100 : null,
      change1w, change1m, change3m, change6m,
      high52w, low52w, distFromHigh, distFromLow,
      consecutiveUp, consecutiveDown,
      avgVolume20d, relVolume,
      // MFI & OBV
      mfi: lastMfi, mfiPrev: prevMfi, obvTrend,
      // Crossover flags
      macdBullishCross: !!(prevMacd && lastMacdVal &&
        prevMacd.MACD != null && prevMacd.signal != null &&
        lastMacdVal.MACD != null && lastMacdVal.signal != null &&
        prevMacd.MACD <= prevMacd.signal && lastMacdVal.MACD > lastMacdVal.signal),
      macdBearishCross: !!(prevMacd && lastMacdVal &&
        prevMacd.MACD != null && prevMacd.signal != null &&
        lastMacdVal.MACD != null && lastMacdVal.signal != null &&
        prevMacd.MACD >= prevMacd.signal && lastMacdVal.MACD < lastMacdVal.signal),
      macdAboveZero: !!(lastMacdVal?.histogram != null && lastMacdVal.histogram > 0),
      bbUpperBreakout: !!(prevBb && lastBb &&
        closePrices[closePrices.length - 2] <= prevBb.upper &&
        lastData.close > lastBb.upper),
      bbLowerBreakout: !!(prevBb && lastBb &&
        closePrices[closePrices.length - 2] >= prevBb.lower &&
        lastData.close < lastBb.lower),
      bbUpperReentry: !!(prevBb && lastBb &&
        closePrices[closePrices.length - 2] > prevBb.upper &&
        lastData.close <= lastBb.upper),
      bbLowerReentry: !!(prevBb && lastBb &&
        closePrices[closePrices.length - 2] < prevBb.lower &&
        lastData.close >= lastBb.lower),
      rsiBullishCross30: !!(prevRsi != null && rsiValues.length > 0 &&
        prevRsi <= 30 && rsiValues[rsiValues.length - 1] > 30),
      rsiBearishCross70: !!(prevRsi != null && rsiValues.length > 0 &&
        prevRsi >= 70 && rsiValues[rsiValues.length - 1] < 70),
      pe, eps, beta, marketCap, bookValue,
    };
  } catch (error: unknown) {
    return {
      ticker,
      price: 0,
      volume: 0,
      timestamp: 0,
      rsi: null,
      stochK: null,
      stochD: null,
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      bbUpper: null,
      bbMiddle: null,
      bbLower: null,
      pe: null,
      eps: null,
      beta: null,
      marketCap: null,
      bookValue: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function fetchTickersIndicators(tickers: string[]): Promise<StockIndicatorResult[]> {
  const promises = tickers.map(ticker => fetchStockData(ticker.toUpperCase()));
  return await Promise.all(promises);
}

export interface StockChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
}

export async function fetchStockChartData(ticker: string): Promise<StockChartData[]> {
  const symbol = `${ticker}.VN`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    
    if (!res.ok) throw new Error(`Failed to fetch ${ticker}`);

    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${ticker}`);

    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0];
    const closes: number[] = quote.close || [];
    const opens: number[] = quote.open || [];
    const highs: number[] = quote.high || [];
    const lows: number[] = quote.low || [];
    const volumes: number[] = quote.volume || [];

    const validData = [];
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined &&
          opens[i] !== null && opens[i] !== undefined &&
          highs[i] !== null && highs[i] !== undefined &&
          lows[i] !== null && lows[i] !== undefined) {
        validData.push({
          close: closes[i],
          open: opens[i],
          high: highs[i],
          low: lows[i],
          volume: volumes[i] ?? 0,
          time: timestamps[i]
        });
      }
    }

    if (validData.length < 30) throw new Error(`Not enough data for ${ticker}`);

    const closePrices = validData.map(d => d.close);

    const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
    const macdValues = MACD.calculate({
      values: closePrices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });

    const stochRsiValues = StochasticRSI.calculate({
      values: closePrices,
      rsiPeriod: 14,
      stochasticPeriod: 14,
      kPeriod: 3,
      dPeriod: 3,
    });

    const bbValuesChart = BollingerBands.calculate({ values: closePrices, period: 20, stdDev: 2 });

    const rsiOffset = validData.length - rsiValues.length;
    const macdOffset = validData.length - macdValues.length;
    const stochOffset = validData.length - stochRsiValues.length;
    const bbOffset = validData.length - bbValuesChart.length;

    return validData.map((d, index) => {
      const rsi = index >= rsiOffset ? rsiValues[index - rsiOffset] : null;
      const macd = index >= macdOffset ? macdValues[index - macdOffset] : null;
      const stoch = index >= stochOffset ? stochRsiValues[index - stochOffset] : null;
      const bb = index >= bbOffset ? bbValuesChart[index - bbOffset] : null;

      return {
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        rsi: rsi,
        stochK: stoch ? (stoch as { k: number }).k : null,
        stochD: stoch ? (stoch as { d: number }).d : null,
        macd: macd?.MACD ?? null,
        macdSignal: macd?.signal ?? null,
        macdHistogram: macd?.histogram ?? null,
        bbUpper: bb?.upper ?? null,
        bbMiddle: bb?.middle ?? null,
        bbLower: bb?.lower ?? null,
      };
    });
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Unknown error');
  }
}
