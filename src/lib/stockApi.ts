import { RSI, MACD, StochasticRSI, BollingerBands } from 'technicalindicators';
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
    const volumes: number[] = quote.volume || [];

    // Filter out nulls
    const validData = [];
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        validData.push({
          close: closes[i],
          volume: volumes[i],
          time: timestamps[i]
        });
      }
    }

    if (validData.length < 30) {
      throw new Error(`Not enough data for ${ticker}`);
    }

    const closePrices = validData.map(d => d.close);
    const lastData = validData[validData.length - 1];

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

    const lastStoch = stochRsiValues.length > 0 ? stochRsiValues[stochRsiValues.length - 1] : null;

    const bbValues = BollingerBands.calculate({ values: closePrices, period: 20, stdDev: 2 });
    const lastBb = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null;

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
      pe,
      eps,
      beta,
      marketCap,
      bookValue,
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
