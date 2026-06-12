import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 0;

export type FlowSignal = 'strong_accumulation' | 'accumulation' | 'neutral' | 'distribution' | 'strong_distribution';
export type PriceVsFlowDivergence = 'bullish_divergence' | 'bearish_divergence' | 'confirmed_up' | 'confirmed_down' | 'neutral';

export interface DayFlow {
  date: string;
  close: number;
  volume: number;
  high: number;
  low: number;
  // Money Flow components
  typicalPrice: number;
  rawMF: number;        // typical * volume (positive if up day, negative if down day)
  mfVolume: number;     // signed volume
  // Rolling indicators
  mfi14: number | null;       // Money Flow Index 0–100
  cmf20: number | null;       // Chaikin Money Flow -1..+1
  obv: number;                // On-Balance Volume
  vwap20: number | null;      // 20-day VWAP
  adLine: number;             // Accumulation/Distribution Line
}

export interface SmartMoneyResult {
  ticker: string;
  // Current snapshot
  price: number;
  change1d: number;
  foreignOwnershipPct: number | null;
  // Latest indicators
  mfi14: number | null;
  cmf20: number | null;
  obvTrend: 'up' | 'down' | 'flat';
  adTrend: 'up' | 'down' | 'flat';
  vwap20: number | null;
  priceVsVwap: 'above' | 'below' | null;
  // Signal
  signal: FlowSignal;
  signalScore: number;   // -4..+4
  divergence: PriceVsFlowDivergence;
  signalNote: string;
  // Chart data
  dailyFlow: DayFlow[];
  // Summary stats
  avgMFI: number | null;
  posFlowDays: number;
  negFlowDays: number;
  flowRatio: number | null;   // pos/(pos+neg) — breadth
  error?: string;
}

// ─── Calc helpers ──────────────────────────────────────────────────────────────

function calcMFI(typicals: number[], volumes: number[], period = 14): (number | null)[] {
  const n = typicals.length;
  const result: (number | null)[] = new Array(n).fill(null);
  for (let i = period; i < n; i++) {
    let posMF = 0, negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const mf = typicals[j] * volumes[j];
      if (typicals[j] > typicals[j - 1]) posMF += mf;
      else if (typicals[j] < typicals[j - 1]) negMF += mf;
    }
    if (negMF === 0) result[i] = 100;
    else if (posMF === 0) result[i] = 0;
    else result[i] = 100 - 100 / (1 + posMF / negMF);
  }
  return result;
}

function calcCMF(highs: number[], lows: number[], closes: number[], volumes: number[], period = 20): (number | null)[] {
  const n = closes.length;
  const result: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let mfvSum = 0, volSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const hl = highs[j] - lows[j];
      const mfc = hl === 0 ? 0 : ((closes[j] - lows[j]) - (highs[j] - closes[j])) / hl;
      mfvSum += mfc * volumes[j];
      volSum += volumes[j];
    }
    result[i] = volSum === 0 ? 0 : mfvSum / volSum;
  }
  return result;
}

function calcOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }
  return obv;
}

function calcADLine(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
  const ad: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const mfc = hl === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / hl;
    ad.push(ad[i - 1] + mfc * volumes[i]);
  }
  return ad;
}

function calcVWAP(closes: number[], volumes: number[], period = 20): (number | null)[] {
  const n = closes.length;
  const result: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let tvSum = 0, vSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      tvSum += closes[j] * volumes[j];
      vSum += volumes[j];
    }
    result[i] = vSum === 0 ? null : tvSum / vSum;
  }
  return result;
}

function trendOf(arr: (number | null)[], lookback = 10): 'up' | 'down' | 'flat' {
  const valid = arr.filter((v): v is number => v != null).slice(-lookback);
  if (valid.length < 3) return 'flat';
  const first = valid.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
  const last  = valid.slice(-3).reduce((s, v) => s + v, 0) / 3;
  const pct   = (last - first) / Math.abs(first) * 100;
  return pct > 1.5 ? 'up' : pct < -1.5 ? 'down' : 'flat';
}

function classifySignal(score: number): FlowSignal {
  if (score >= 3) return 'strong_accumulation';
  if (score >= 1) return 'accumulation';
  if (score <= -3) return 'strong_distribution';
  if (score <= -1) return 'distribution';
  return 'neutral';
}

function detectDivergence(
  closes: number[],
  adLine: number[],
  obv: number[],
  lookback = 20,
): PriceVsFlowDivergence {
  const n = closes.length;
  if (n < lookback + 5) return 'neutral';
  const recentClose = closes.slice(-lookback);
  const recentAD    = adLine.slice(-lookback);
  const recentOBV   = obv.slice(-lookback);

  const priceSlope = (recentClose[recentClose.length - 1] - recentClose[0]) / recentClose[0];
  const adSlope    = (recentAD[recentAD.length - 1] - recentAD[0]) / Math.abs(recentAD[0] || 1);
  const obvSlope   = (recentOBV[recentOBV.length - 1] - recentOBV[0]) / Math.abs(recentOBV[0] || 1);
  const flowSlope  = (adSlope + obvSlope) / 2;

  const priceUp   = priceSlope > 0.02;
  const priceDown = priceSlope < -0.02;
  const flowUp    = flowSlope > 0.02;
  const flowDown  = flowSlope < -0.02;

  if (priceDown && flowUp)  return 'bullish_divergence';    // price down, flow up → reversal
  if (priceUp && flowDown)  return 'bearish_divergence';    // price up, flow down → weakness
  if (priceUp && flowUp)    return 'confirmed_up';
  if (priceDown && flowDown) return 'confirmed_down';
  return 'neutral';
}

function buildSignalNote(signal: FlowSignal, div: PriceVsFlowDivergence, mfi: number | null, cmf: number | null): string {
  const parts: string[] = [];
  if (signal === 'strong_accumulation')  parts.push('✅ Tích lũy mạnh — dòng tiền vào lớn');
  else if (signal === 'accumulation')    parts.push('🟢 Tích lũy — dòng tiền đang vào');
  else if (signal === 'distribution')    parts.push('🟠 Phân phối — dòng tiền đang ra');
  else if (signal === 'strong_distribution') parts.push('🔴 Phân phối mạnh — áp lực bán lớn');
  else                                   parts.push('⬜ Trung tính');

  if (div === 'bullish_divergence')  parts.push('📈 Phân kỳ tăng: giá giảm nhưng dòng tiền tăng');
  if (div === 'bearish_divergence')  parts.push('📉 Phân kỳ giảm: giá tăng nhưng dòng tiền yếu');
  if (div === 'confirmed_up')        parts.push('✅ Xu hướng tăng được xác nhận bởi dòng tiền');
  if (div === 'confirmed_down')      parts.push('❌ Xu hướng giảm được xác nhận bởi dòng tiền');

  if (mfi != null) {
    if (mfi < 20)      parts.push(`MFI ${mfi.toFixed(0)} — quá bán`);
    else if (mfi > 80) parts.push(`MFI ${mfi.toFixed(0)} — quá mua`);
  }
  if (cmf != null) {
    if (cmf > 0.15)      parts.push(`CMF ${cmf.toFixed(3)} — dòng tiền vào mạnh`);
    else if (cmf < -0.15) parts.push(`CMF ${cmf.toFixed(3)} — dòng tiền ra mạnh`);
  }
  return parts.join(' · ');
}

// ─── Yahoo Finance fetch ────────────────────────────────────────────────────────

async function fetchYahooData(ticker: string): Promise<SmartMoneyResult> {
  const symbol = `${ticker}.VN`;
  const empty = (err: string): SmartMoneyResult => ({
    ticker, price: 0, change1d: 0, foreignOwnershipPct: null,
    mfi14: null, cmf20: null, obvTrend: 'flat', adTrend: 'flat',
    vwap20: null, priceVsVwap: null,
    signal: 'neutral', signalScore: 0, divergence: 'neutral', signalNote: '',
    dailyFlow: [], avgMFI: null, posFlowDays: 0, negFlowDays: 0, flowRatio: null,
    error: err,
  });

  try {
    // Fetch OHLCV (6 months daily)
    const [chartRes, quoteRes] = await Promise.allSettled([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store',
      }),
      fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=defaultKeyStatistics,summaryDetail`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store',
      }),
    ]);

    if (chartRes.status !== 'fulfilled' || !chartRes.value.ok) return empty('Yahoo Finance error');
    const chartJson = await chartRes.value.json();
    const result = chartJson.chart?.result?.[0];
    if (!result) return empty('No chart data');

    const rawTs: number[]           = result.timestamp || [];
    const q                         = result.indicators.quote[0];
    const rawC: (number|null)[]     = q.close  || [];
    const rawH: (number|null)[]     = q.high   || [];
    const rawL: (number|null)[]     = q.low    || [];
    const rawV: (number|null)[]     = q.volume || [];

    const closes: number[] = [], highs: number[] = [], lows: number[] = [],
      volumes: number[] = [], dates: string[] = [];
    for (let i = 0; i < rawC.length; i++) {
      if (rawC[i] != null && rawH[i] != null && rawL[i] != null) {
        closes.push(rawC[i]!); highs.push(rawH[i]!); lows.push(rawL[i]!);
        volumes.push(rawV[i] ?? 0);
        dates.push(new Date(rawTs[i] * 1000).toISOString().slice(0, 10));
      }
    }
    if (closes.length < 21) return empty('Not enough data');

    const n = closes.length;
    const typicals = closes.map((c, i) => (c + highs[i] + lows[i]) / 3);

    // Calculate all indicators
    const mfiArr  = calcMFI(typicals, volumes, 14);
    const cmfArr  = calcCMF(highs, lows, closes, volumes, 20);
    const obvArr  = calcOBV(closes, volumes);
    const adArr   = calcADLine(highs, lows, closes, volumes);
    const vwapArr = calcVWAP(closes, volumes, 20);

    // Foreign ownership from quoteSummary
    let foreignOwnershipPct: number | null = null;
    if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
      const qj = await quoteRes.value.json();
      const stats = qj.quoteSummary?.result?.[0];
      const held = stats?.defaultKeyStatistics?.heldPercentInstitutions?.raw
                ?? stats?.defaultKeyStatistics?.heldPercentInsiders?.raw;
      if (held != null) foreignOwnershipPct = +(held * 100).toFixed(2);
    }

    // Build daily flow series (last 60 days for chart)
    const dailyFlow: DayFlow[] = closes.slice(-60).map((close, idx) => {
      const i = n - 60 + idx;
      const prev = i > 0 ? closes[i - 1] : close;
      const mfVol = close >= prev ? volumes[i] : -volumes[i];
      return {
        date: dates[i],
        close,
        volume: volumes[i],
        high: highs[i],
        low: lows[i],
        typicalPrice: typicals[i],
        rawMF: typicals[i] * volumes[i] * (close >= prev ? 1 : -1),
        mfVolume: mfVol,
        mfi14: mfiArr[i] != null ? +mfiArr[i]!.toFixed(1) : null,
        cmf20: cmfArr[i] != null ? +cmfArr[i]!.toFixed(4) : null,
        obv: obvArr[i],
        vwap20: vwapArr[i] != null ? +vwapArr[i]!.toFixed(0) : null,
        adLine: adArr[i],
      };
    });

    // Latest values
    const mfi14 = mfiArr[n - 1] != null ? +mfiArr[n - 1]!.toFixed(1) : null;
    const cmf20 = cmfArr[n - 1] != null ? +cmfArr[n - 1]!.toFixed(4) : null;
    const vwap20 = vwapArr[n - 1] != null ? +vwapArr[n - 1]!.toFixed(0) : null;
    const price = closes[n - 1];
    const change1d = closes.length > 1 ? (price - closes[n - 2]) / closes[n - 2] * 100 : 0;

    const obvTrend = trendOf(obvArr.map(v => v));
    const adTrend  = trendOf(adArr.map(v => v));
    const priceVsVwap = vwap20 == null ? null : price > vwap20 ? 'above' : 'below';
    const divergence  = detectDivergence(closes, adArr, obvArr);

    // Score: MFI zone, CMF sign, OBV trend, AD trend, price vs VWAP
    let score = 0;
    if (mfi14 != null) { if (mfi14 < 30) score += 1; else if (mfi14 > 70) score -= 1; }
    if (cmf20 != null) { if (cmf20 > 0.05) score += 1; else if (cmf20 < -0.05) score -= 1; }
    if (obvTrend === 'up') score += 1; else if (obvTrend === 'down') score -= 1;
    if (adTrend  === 'up') score += 1; else if (adTrend  === 'down') score -= 1;
    if (priceVsVwap === 'above') score += 1; else if (priceVsVwap === 'below') score -= 1;

    const signal = classifySignal(score);
    const signalNote = buildSignalNote(signal, divergence, mfi14, cmf20);

    const recentVols = dailyFlow.slice(-30);
    const posFlowDays = recentVols.filter(d => d.mfVolume > 0).length;
    const negFlowDays = recentVols.filter(d => d.mfVolume < 0).length;
    const flowRatio   = posFlowDays + negFlowDays > 0 ? posFlowDays / (posFlowDays + negFlowDays) : null;
    const mfiVals = dailyFlow.map(d => d.mfi14).filter((v): v is number => v != null);
    const avgMFI  = mfiVals.length ? +(mfiVals.reduce((s, v) => s + v, 0) / mfiVals.length).toFixed(1) : null;

    return {
      ticker, price, change1d: +change1d.toFixed(2), foreignOwnershipPct,
      mfi14, cmf20, obvTrend, adTrend, vwap20, priceVsVwap,
      signal, signalScore: score, divergence, signalNote,
      dailyFlow, avgMFI, posFlowDays, negFlowDays, flowRatio,
    };
  } catch (e) {
    return empty(e instanceof Error ? e.message : 'Unknown error');
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────────

// Simple in-memory cache
const cache = new Map<string, { data: SmartMoneyResult; exp: number }>();

export async function GET(req: NextRequest) {
  const ticker = new URL(req.url).searchParams.get('ticker')?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const hit = cache.get(ticker);
  if (hit && hit.exp > Date.now()) return NextResponse.json(hit.data);

  const data = await fetchYahooData(ticker);
  cache.set(ticker, { data, exp: Date.now() + 10 * 60 * 1000 }); // 10min
  return NextResponse.json(data);
}
