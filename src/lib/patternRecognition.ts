// ─────────────────────────────────────────────────────────────
// Pattern Recognition Engine
// Detects classic chart patterns from OHLC data
// ─────────────────────────────────────────────────────────────

export type PatternType =
  | 'HEAD_AND_SHOULDERS'
  | 'INV_HEAD_AND_SHOULDERS'
  | 'DOUBLE_TOP'
  | 'DOUBLE_BOTTOM'
  | 'RISING_WEDGE'
  | 'FALLING_WEDGE'
  | 'ASCENDING_TRIANGLE'
  | 'DESCENDING_TRIANGLE'
  | 'SYMMETRICAL_TRIANGLE'
  | 'CUP_AND_HANDLE'
  | 'BULL_FLAG'
  | 'BEAR_FLAG';

export type PatternDirection = 'bullish' | 'bearish' | 'neutral';

export interface PatternResult {
  type: PatternType;
  label: string;
  emoji: string;
  direction: PatternDirection;
  confidence: number;       // 0–100
  description: string;
  keyLevels: {
    neckline?: number;
    resistance?: number;
    support?: number;
    target?: number;
  };
  barStart: number;         // index in closes array where pattern starts
  barEnd: number;           // index where pattern ends (usually last bar)
}

export interface PatternConfig {
  label: string;
  emoji: string;
  direction: PatternDirection;
  interpretation: string;
}

export const PATTERN_CONFIG: Record<PatternType, PatternConfig> = {
  HEAD_AND_SHOULDERS:     { label: 'Head & Shoulders',       emoji: '👤', direction: 'bearish', interpretation: 'Đảo chiều giảm — phá vỡ neckline xác nhận tín hiệu' },
  INV_HEAD_AND_SHOULDERS: { label: 'Inverse H&S',            emoji: '🙃', direction: 'bullish', interpretation: 'Đảo chiều tăng — phá vỡ neckline xác nhận tín hiệu' },
  DOUBLE_TOP:             { label: 'Double Top',              emoji: '🔝', direction: 'bearish', interpretation: 'Kháng cự kép — giá thất bại 2 lần, khả năng đảo chiều giảm' },
  DOUBLE_BOTTOM:          { label: 'Double Bottom',           emoji: '🔛', direction: 'bullish', interpretation: 'Hỗ trợ kép — giá bật 2 lần, khả năng đảo chiều tăng' },
  RISING_WEDGE:           { label: 'Rising Wedge',            emoji: '📐', direction: 'bearish', interpretation: 'Hình nêm tăng — thường là tín hiệu phân phối, kỳ vọng giảm' },
  FALLING_WEDGE:          { label: 'Falling Wedge',           emoji: '📏', direction: 'bullish', interpretation: 'Hình nêm giảm — co lại rồi bật, kỳ vọng breakout tăng' },
  ASCENDING_TRIANGLE:     { label: 'Ascending Triangle',      emoji: '🔺', direction: 'bullish', interpretation: 'Tam giác tăng — kháng cự phẳng + đáy cao hơn → breakout tăng' },
  DESCENDING_TRIANGLE:    { label: 'Descending Triangle',     emoji: '🔻', direction: 'bearish', interpretation: 'Tam giác giảm — hỗ trợ phẳng + đỉnh thấp hơn → breakdown' },
  SYMMETRICAL_TRIANGLE:   { label: 'Symmetrical Triangle',    emoji: '🔷', direction: 'neutral', interpretation: 'Tam giác đối xứng — tích lũy, breakout theo hướng xu hướng chính' },
  CUP_AND_HANDLE:         { label: 'Cup & Handle',            emoji: '☕', direction: 'bullish', interpretation: 'Cốc và tay cầm — giai đoạn tích lũy dài, breakout mạnh' },
  BULL_FLAG:              { label: 'Bull Flag',               emoji: '🚩', direction: 'bullish', interpretation: 'Cờ tăng — nghỉ ngắn sau đà tăng mạnh, tiếp tục tăng' },
  BEAR_FLAG:              { label: 'Bear Flag',               emoji: '🏴', direction: 'bearish', interpretation: 'Cờ giảm — phục hồi ngắn sau đà giảm mạnh, tiếp tục giảm' },
};

// ── Pivot point detection ─────────────────────────────────────

export interface Pivot {
  index: number;
  price: number;
  type: 'high' | 'low';
}

export function findPivots(
  highs: number[],
  lows:  number[],
  lookback = 5,
): Pivot[] {
  const pivots: Pivot[] = [];
  const n = Math.min(highs.length, lows.length);

  for (let i = lookback; i < n - lookback; i++) {
    // Check for local high
    let isHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && highs[j] >= highs[i]) { isHigh = false; break; }
    }
    if (isHigh) pivots.push({ index: i, price: highs[i], type: 'high' });

    // Check for local low
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && lows[j] <= lows[i]) { isLow = false; break; }
    }
    if (isLow) pivots.push({ index: i, price: lows[i], type: 'low' });
  }

  // Sort by index and remove overlapping pivots (keep most extreme)
  return pivots.sort((a, b) => a.index - b.index);
}

// ── Utility ───────────────────────────────────────────────────

const pct = (a: number, b: number) => Math.abs((a - b) / b) * 100;
const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

function linRegSlope(values: number[]): number {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = avg(values);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ── Pattern detectors ─────────────────────────────────────────

function detectHeadAndShoulders(
  pivots: Pivot[],
  closes: number[],
  inverted = false,
): PatternResult | null {
  const type = inverted ? 'low' : 'high';
  const peaks = pivots.filter(p => p.type === type);
  if (peaks.length < 3) return null;

  for (let i = 0; i < peaks.length - 2; i++) {
    const ls = peaks[i];
    const hd = peaks[i + 1];
    const rs = peaks[i + 2];

    const headHigher = inverted
      ? hd.price < ls.price && hd.price < rs.price
      : hd.price > ls.price && hd.price > rs.price;
    if (!headHigher) continue;

    const shoulderSym = pct(ls.price, rs.price) < 15;
    if (!shoulderSym) continue;

    // Find neckline (avg of troughs between shoulders)
    const troughsBetween = pivots.filter(p =>
      p.type === (inverted ? 'high' : 'low') &&
      p.index > ls.index && p.index < rs.index,
    );
    if (troughsBetween.length < 1) continue;

    const neckline = avg(troughsBetween.map(t => t.price));
    const heightDiff = inverted
      ? neckline - hd.price
      : hd.price - neckline;
    const target = inverted
      ? neckline + heightDiff
      : neckline - heightDiff;

    // Confidence based on symmetry + recent position
    const symScore = 100 - pct(ls.price, rs.price) * 3;
    const recentScore = rs.index > closes.length * 0.6 ? 20 : 0;
    const confidence = Math.min(95, Math.max(40, symScore + recentScore));

    return {
      type: inverted ? 'INV_HEAD_AND_SHOULDERS' : 'HEAD_AND_SHOULDERS',
      label: PATTERN_CONFIG[inverted ? 'INV_HEAD_AND_SHOULDERS' : 'HEAD_AND_SHOULDERS'].label,
      emoji: PATTERN_CONFIG[inverted ? 'INV_HEAD_AND_SHOULDERS' : 'HEAD_AND_SHOULDERS'].emoji,
      direction: inverted ? 'bullish' : 'bearish',
      confidence: Math.round(confidence),
      description: `LS@${Math.round(ls.price).toLocaleString()} · HD@${Math.round(hd.price).toLocaleString()} · RS@${Math.round(rs.price).toLocaleString()}`,
      keyLevels: { neckline: Math.round(neckline), target: Math.round(target) },
      barStart: ls.index,
      barEnd: closes.length - 1,
    };
  }
  return null;
}

function detectDoubleTopBottom(
  pivots: Pivot[],
  closes: number[],
  isTop = true,
): PatternResult | null {
  const type = isTop ? 'high' : 'low';
  const peaks = pivots.filter(p => p.type === type);
  if (peaks.length < 2) return null;

  // Check last two peaks
  for (let i = peaks.length - 2; i >= Math.max(0, peaks.length - 5); i--) {
    const p1 = peaks[i];
    const p2 = peaks[i + 1];

    const priceClose = pct(p1.price, p2.price) < 3;
    if (!priceClose) continue;

    const minBarsApart = 8;
    if (p2.index - p1.index < minBarsApart) continue;

    const midTroughs = pivots.filter(p =>
      p.type === (isTop ? 'low' : 'high') &&
      p.index > p1.index && p.index < p2.index,
    );
    if (!midTroughs.length) continue;

    const neckline = avg(midTroughs.map(t => t.price));
    const height   = Math.abs(p1.price - neckline);
    const target   = isTop ? neckline - height : neckline + height;
    const confidence = Math.round(Math.min(90, 70 + (3 - pct(p1.price, p2.price)) * 5));

    return {
      type: isTop ? 'DOUBLE_TOP' : 'DOUBLE_BOTTOM',
      label: PATTERN_CONFIG[isTop ? 'DOUBLE_TOP' : 'DOUBLE_BOTTOM'].label,
      emoji: PATTERN_CONFIG[isTop ? 'DOUBLE_TOP' : 'DOUBLE_BOTTOM'].emoji,
      direction: isTop ? 'bearish' : 'bullish',
      confidence,
      description: `Đỉnh 1@${Math.round(p1.price).toLocaleString()} · Đỉnh 2@${Math.round(p2.price).toLocaleString()}`,
      keyLevels: { neckline: Math.round(neckline), target: Math.round(target), ...(isTop ? { resistance: Math.round(p1.price) } : { support: Math.round(p1.price) }) },
      barStart: p1.index,
      barEnd: closes.length - 1,
    };
  }
  return null;
}

function detectWedge(
  pivots: Pivot[],
  closes: number[],
): PatternResult | null {
  const recentHighs = pivots.filter(p => p.type === 'high' && p.index > closes.length * 0.4).slice(-4);
  const recentLows  = pivots.filter(p => p.type === 'low'  && p.index > closes.length * 0.4).slice(-4);
  if (recentHighs.length < 3 || recentLows.length < 3) return null;

  const highSlope = linRegSlope(recentHighs.map(p => p.price));
  const lowSlope  = linRegSlope(recentLows.map(p => p.price));

  // Rising wedge: both slopes positive but converging (highs slope < lows slope)
  if (highSlope > 0 && lowSlope > 0 && highSlope < lowSlope) {
    const support    = recentLows[recentLows.length - 1].price;
    const resistance = recentHighs[recentHighs.length - 1].price;
    const height     = resistance - support;
    return {
      type: 'RISING_WEDGE', label: PATTERN_CONFIG.RISING_WEDGE.label,
      emoji: PATTERN_CONFIG.RISING_WEDGE.emoji, direction: 'bearish',
      confidence: 65,
      description: `Đỉnh và đáy đều tăng nhưng đang hội tụ — kỳ vọng breakdown`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support), target: Math.round(support - height * 0.7) },
      barStart: recentHighs[0].index, barEnd: closes.length - 1,
    };
  }

  // Falling wedge: both slopes negative but converging (highs slope > lows slope)
  if (highSlope < 0 && lowSlope < 0 && highSlope > lowSlope) {
    const support    = recentLows[recentLows.length - 1].price;
    const resistance = recentHighs[recentHighs.length - 1].price;
    const height     = resistance - support;
    return {
      type: 'FALLING_WEDGE', label: PATTERN_CONFIG.FALLING_WEDGE.label,
      emoji: PATTERN_CONFIG.FALLING_WEDGE.emoji, direction: 'bullish',
      confidence: 65,
      description: `Đỉnh và đáy đều giảm nhưng đang hội tụ — kỳ vọng breakout`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support), target: Math.round(resistance + height * 0.7) },
      barStart: recentHighs[0].index, barEnd: closes.length - 1,
    };
  }
  return null;
}

function detectTriangle(
  pivots: Pivot[],
  closes: number[],
): PatternResult | null {
  const recentHighs = pivots.filter(p => p.type === 'high' && p.index > closes.length * 0.4).slice(-4);
  const recentLows  = pivots.filter(p => p.type === 'low'  && p.index > closes.length * 0.4).slice(-4);
  if (recentHighs.length < 3 || recentLows.length < 3) return null;

  const highSlope = linRegSlope(recentHighs.map(p => p.price));
  const lowSlope  = linRegSlope(recentLows.map(p => p.price));

  const resistance = avg(recentHighs.map(p => p.price));
  const support    = avg(recentLows.map(p => p.price));

  // Ascending: flat resistance + rising lows
  if (Math.abs(highSlope) < 0.5 && lowSlope > 0.3) {
    return {
      type: 'ASCENDING_TRIANGLE', label: PATTERN_CONFIG.ASCENDING_TRIANGLE.label,
      emoji: PATTERN_CONFIG.ASCENDING_TRIANGLE.emoji, direction: 'bullish',
      confidence: 70,
      description: `Đáy cao dần + kháng cự phẳng@${Math.round(resistance).toLocaleString()} — chuẩn bị breakout`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support), target: Math.round(resistance + (resistance - support)) },
      barStart: recentHighs[0].index, barEnd: closes.length - 1,
    };
  }

  // Descending: falling highs + flat support
  if (highSlope < -0.3 && Math.abs(lowSlope) < 0.5) {
    return {
      type: 'DESCENDING_TRIANGLE', label: PATTERN_CONFIG.DESCENDING_TRIANGLE.label,
      emoji: PATTERN_CONFIG.DESCENDING_TRIANGLE.emoji, direction: 'bearish',
      confidence: 70,
      description: `Đỉnh thấp dần + hỗ trợ phẳng@${Math.round(support).toLocaleString()} — nguy cơ breakdown`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support), target: Math.round(support - (resistance - support)) },
      barStart: recentHighs[0].index, barEnd: closes.length - 1,
    };
  }

  // Symmetrical: both converging
  if (highSlope < -0.2 && lowSlope > 0.2) {
    return {
      type: 'SYMMETRICAL_TRIANGLE', label: PATTERN_CONFIG.SYMMETRICAL_TRIANGLE.label,
      emoji: PATTERN_CONFIG.SYMMETRICAL_TRIANGLE.emoji, direction: 'neutral',
      confidence: 60,
      description: `Đỉnh thấp dần + đáy cao dần — tích lũy trước breakout`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support) },
      barStart: recentHighs[0].index, barEnd: closes.length - 1,
    };
  }
  return null;
}

function detectCupAndHandle(
  pivots: Pivot[],
  closes: number[],
): PatternResult | null {
  if (closes.length < 40) return null;
  const n = closes.length;
  const leftRim  = closes.slice(0, Math.floor(n * 0.15));
  const bottom   = closes.slice(Math.floor(n * 0.2), Math.floor(n * 0.7));
  const rightRim = closes.slice(Math.floor(n * 0.7), Math.floor(n * 0.85));
  const handle   = closes.slice(Math.floor(n * 0.85));

  if (!leftRim.length || !bottom.length || !rightRim.length || !handle.length) return null;

  const leftMax  = Math.max(...leftRim);
  const rightMax = Math.max(...rightRim);
  const cupMin   = Math.min(...bottom);
  const handleMax= Math.max(...handle);
  const current  = closes[n - 1];

  // Cup rims roughly equal
  const rimClose = pct(leftMax, rightMax) < 8;
  // Cup bottom significantly lower than rims
  const cupDepth = (leftMax - cupMin) / leftMax > 0.1;
  // Handle below right rim
  const handleBelowRim = handleMax < rightMax;
  // Current price near right rim (approaching breakout)
  const nearBreakout = pct(current, rightMax) < 5;

  if (rimClose && cupDepth && handleBelowRim && nearBreakout) {
    const target = rightMax + (rightMax - cupMin) * 0.6;
    return {
      type: 'CUP_AND_HANDLE', label: PATTERN_CONFIG.CUP_AND_HANDLE.label,
      emoji: PATTERN_CONFIG.CUP_AND_HANDLE.emoji, direction: 'bullish',
      confidence: 72,
      description: `Cốc sâu ${((leftMax - cupMin) / leftMax * 100).toFixed(0)}% · Tay cầm · Tiếp cận kháng cự`,
      keyLevels: { resistance: Math.round(rightMax), support: Math.round(cupMin), target: Math.round(target) },
      barStart: 0, barEnd: n - 1,
    };
  }
  return null;
}

function detectFlag(
  pivots: Pivot[],
  closes: number[],
): PatternResult | null {
  if (closes.length < 20) return null;
  const n      = closes.length;
  const pole   = closes.slice(Math.floor(n * 0.55), Math.floor(n * 0.75));
  const flag   = closes.slice(Math.floor(n * 0.75));
  if (pole.length < 5 || flag.length < 5) return null;

  const poleStart  = pole[0];
  const poleEnd    = pole[pole.length - 1];
  const poleMove   = (poleEnd - poleStart) / poleStart;
  const flagSlope  = linRegSlope(flag);
  const flagRange  = (Math.max(...flag) - Math.min(...flag)) / poleEnd;

  // Bull flag: strong up move + small pullback down
  if (poleMove > 0.06 && flagSlope < 0 && flagRange < 0.06) {
    const target = closes[n-1] + Math.abs(poleEnd - poleStart) * 0.8;
    return {
      type: 'BULL_FLAG', label: PATTERN_CONFIG.BULL_FLAG.label,
      emoji: PATTERN_CONFIG.BULL_FLAG.emoji, direction: 'bullish',
      confidence: 68,
      description: `Cột cờ +${(poleMove*100).toFixed(1)}% · Kéo lại nhẹ · Chuẩn bị tiếp tục`,
      keyLevels: { support: Math.round(Math.min(...flag)), resistance: Math.round(poleEnd), target: Math.round(target) },
      barStart: Math.floor(n * 0.55), barEnd: n - 1,
    };
  }

  // Bear flag: strong down move + small bounce up
  if (poleMove < -0.06 && flagSlope > 0 && flagRange < 0.06) {
    const target = closes[n-1] - Math.abs(poleEnd - poleStart) * 0.8;
    return {
      type: 'BEAR_FLAG', label: PATTERN_CONFIG.BEAR_FLAG.label,
      emoji: PATTERN_CONFIG.BEAR_FLAG.emoji, direction: 'bearish',
      confidence: 68,
      description: `Cột cờ ${(poleMove*100).toFixed(1)}% · Hồi phục nhẹ · Chuẩn bị tiếp tục giảm`,
      keyLevels: { resistance: Math.round(Math.max(...flag)), support: Math.round(poleEnd), target: Math.round(target) },
      barStart: Math.floor(n * 0.55), barEnd: n - 1,
    };
  }
  return null;
}

// ── Main scanner ──────────────────────────────────────────────

export function scanPatterns(
  closes: number[],
  highs: number[],
  lows: number[],
): PatternResult[] {
  if (closes.length < 20) return [];

  const pivots = findPivots(highs, lows, Math.max(3, Math.floor(closes.length / 20)));
  const results: PatternResult[] = [];

  const add = (r: PatternResult | null) => { if (r) results.push(r); };

  add(detectHeadAndShoulders(pivots, closes, false));
  add(detectHeadAndShoulders(pivots, closes, true));
  add(detectDoubleTopBottom(pivots, closes, true));
  add(detectDoubleTopBottom(pivots, closes, false));
  add(detectWedge(pivots, closes));
  add(detectTriangle(pivots, closes));
  add(detectCupAndHandle(pivots, closes));
  add(detectFlag(pivots, closes));

  // Return highest confidence per type
  const seen = new Set<PatternType>();
  return results
    .sort((a, b) => b.confidence - a.confidence)
    .filter(r => { if (seen.has(r.type)) return false; seen.add(r.type); return true; });
}
