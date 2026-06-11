// ─────────────────────────────────────────────────────────────
// Pattern Recognition Engine v2 — stricter, fewer false positives
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
  barStart: number;
  barEnd: number;
}

export interface PatternConfig {
  label: string;
  emoji: string;
  direction: PatternDirection;
  interpretation: string;
}

export const PATTERN_CONFIG: Record<PatternType, PatternConfig> = {
  HEAD_AND_SHOULDERS:     { label: 'Head & Shoulders',    emoji: '👤', direction: 'bearish', interpretation: 'Đảo chiều giảm — phá vỡ neckline xác nhận tín hiệu' },
  INV_HEAD_AND_SHOULDERS: { label: 'Inverse H&S',         emoji: '🙃', direction: 'bullish', interpretation: 'Đảo chiều tăng — phá vỡ neckline xác nhận tín hiệu' },
  DOUBLE_TOP:             { label: 'Double Top',           emoji: '🔝', direction: 'bearish', interpretation: 'Kháng cự kép — giá thất bại 2 lần, khả năng đảo chiều giảm' },
  DOUBLE_BOTTOM:          { label: 'Double Bottom',        emoji: '🔛', direction: 'bullish', interpretation: 'Hỗ trợ kép — giá bật 2 lần, khả năng đảo chiều tăng' },
  RISING_WEDGE:           { label: 'Rising Wedge',         emoji: '📐', direction: 'bearish', interpretation: 'Hình nêm tăng — thường là tín hiệu phân phối, kỳ vọng giảm' },
  FALLING_WEDGE:          { label: 'Falling Wedge',        emoji: '📏', direction: 'bullish', interpretation: 'Hình nêm giảm — co lại rồi bật, kỳ vọng breakout tăng' },
  ASCENDING_TRIANGLE:     { label: 'Ascending Triangle',   emoji: '🔺', direction: 'bullish', interpretation: 'Tam giác tăng — kháng cự phẳng + đáy cao hơn → breakout tăng' },
  DESCENDING_TRIANGLE:    { label: 'Descending Triangle',  emoji: '🔻', direction: 'bearish', interpretation: 'Tam giác giảm — hỗ trợ phẳng + đỉnh thấp hơn → breakdown' },
  SYMMETRICAL_TRIANGLE:   { label: 'Symmetrical Triangle', emoji: '🔷', direction: 'neutral', interpretation: 'Tam giác đối xứng — tích lũy, breakout theo hướng xu hướng chính' },
  CUP_AND_HANDLE:         { label: 'Cup & Handle',         emoji: '☕', direction: 'bullish', interpretation: 'Cốc và tay cầm — giai đoạn tích lũy dài, breakout mạnh' },
  BULL_FLAG:              { label: 'Bull Flag',            emoji: '🚩', direction: 'bullish', interpretation: 'Cờ tăng — nghỉ ngắn sau đà tăng mạnh, tiếp tục tăng' },
  BEAR_FLAG:              { label: 'Bear Flag',            emoji: '🏴', direction: 'bearish', interpretation: 'Cờ giảm — phục hồi ngắn sau đà giảm mạnh, tiếp tục giảm' },
};

// ── Pivot detection — adaptive lookback, stricter ─────────────

export interface Pivot {
  index: number;
  price: number;
  type: 'high' | 'low';
}

export function findPivots(
  highs: number[],
  lows: number[],
  lookback = 5,
): Pivot[] {
  const pivots: Pivot[] = [];
  const n = Math.min(highs.length, lows.length);
  // Minimum lookback 4 to reduce noise
  const lb = Math.max(4, lookback);

  for (let i = lb; i < n - lb; i++) {
    let isHigh = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (j !== i && highs[j] >= highs[i]) { isHigh = false; break; }
    }
    if (isHigh) pivots.push({ index: i, price: highs[i], type: 'high' });

    let isLow = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (j !== i && lows[j] <= lows[i]) { isLow = false; break; }
    }
    if (isLow) pivots.push({ index: i, price: lows[i], type: 'low' });
  }

  return pivots.sort((a, b) => a.index - b.index);
}

// ── Utilities ─────────────────────────────────────────────────

// Percentage difference between two prices
const pct = (a: number, b: number) => Math.abs((a - b) / b) * 100;
const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

function linRegSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = avg(values);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// Normalized slope: slope as % of average price per bar
function normalizedSlope(prices: number[]): number {
  const slope = linRegSlope(prices);
  const avgPrice = avg(prices);
  return avgPrice === 0 ? 0 : (slope / avgPrice) * 100;
}

// Check if price is near a prior uptrend (for H&S) or downtrend (for Inv H&S)
function priorTrendExists(closes: number[], startIdx: number, isBearish: boolean, minBars = 10): boolean {
  if (startIdx < minBars) return false;
  const priorSlice = closes.slice(Math.max(0, startIdx - 30), startIdx);
  if (priorSlice.length < minBars) return false;
  const slope = normalizedSlope(priorSlice);
  return isBearish ? slope > 0.05 : slope < -0.05; // prior uptrend for H&S, downtrend for Inv
}

// ── Head & Shoulders (strictly validated) ────────────────────

function detectHeadAndShoulders(
  pivots: Pivot[],
  closes: number[],
  inverted = false,
): PatternResult | null {
  const peakType = inverted ? 'low' : 'high';
  const troughType = inverted ? 'high' : 'low';
  const peaks = pivots.filter(p => p.type === peakType);
  if (peaks.length < 3) return null;

  const n = closes.length;

  for (let i = 0; i < peaks.length - 2; i++) {
    const ls = peaks[i];
    const hd = peaks[i + 1];
    const rs = peaks[i + 2];

    // Head must be meaningfully higher (not just marginally)
    const headClearance = inverted
      ? (ls.price - hd.price) / ls.price
      : (hd.price - ls.price) / ls.price;
    if (headClearance < 0.03) continue; // head must be >3% beyond shoulders

    // Shoulders must be roughly symmetric (tighter: <8% diff)
    if (pct(ls.price, rs.price) > 8) continue;

    // Must have minimum spacing — at least 5 bars between each peak
    if ((hd.index - ls.index) < 5 || (rs.index - hd.index) < 5) continue;

    // Pattern must span reasonable time — not too compressed
    const patternBars = rs.index - ls.index;
    if (patternBars < 12) continue;

    // RS must be recent (in last 40% of data) to be actionable
    if (rs.index < n * 0.5) continue;

    // Must have prior trend before left shoulder
    if (!priorTrendExists(closes, ls.index, !inverted)) continue;

    // Find troughs between shoulders for neckline
    const troughsBetween = pivots.filter(p =>
      p.type === troughType &&
      p.index > ls.index && p.index < rs.index
    );
    if (troughsBetween.length < 2) continue; // need both troughs

    const neckline = avg(troughsBetween.map(t => t.price));

    // Neckline must be clearly below/above head
    const necklineClearance = inverted
      ? (neckline - hd.price) / neckline
      : (hd.price - neckline) / hd.price;
    if (necklineClearance < 0.04) continue;

    // Current price should be near or below/above neckline (pattern completing)
    const currentPrice = closes[n - 1];
    const distFromNeckline = inverted
      ? (currentPrice - neckline) / neckline
      : (neckline - currentPrice) / neckline;
    // Skip if price already broke way past neckline (old pattern) or still far above
    if (distFromNeckline < -0.08 || distFromNeckline > 0.15) continue;

    const heightDiff = inverted ? neckline - hd.price : hd.price - neckline;
    const target = inverted ? neckline + heightDiff : neckline - heightDiff;

    // Confidence: symmetry + head clearance + neckline flatness
    const necklineStdDev = troughsBetween.length > 1
      ? Math.sqrt(troughsBetween.reduce((s, t) => s + (t.price - neckline) ** 2, 0) / troughsBetween.length) / neckline * 100
      : 3;
    const symScore = Math.max(0, 30 - pct(ls.price, rs.price) * 3);
    const headScore = Math.min(25, headClearance * 300);
    const neckScore = Math.max(0, 20 - necklineStdDev * 2);
    const recencyScore = rs.index > n * 0.7 ? 15 : 5;
    const confidence = Math.round(Math.min(88, Math.max(45, symScore + headScore + neckScore + recencyScore)));

    return {
      type: inverted ? 'INV_HEAD_AND_SHOULDERS' : 'HEAD_AND_SHOULDERS',
      label: PATTERN_CONFIG[inverted ? 'INV_HEAD_AND_SHOULDERS' : 'HEAD_AND_SHOULDERS'].label,
      emoji: PATTERN_CONFIG[inverted ? 'INV_HEAD_AND_SHOULDERS' : 'HEAD_AND_SHOULDERS'].emoji,
      direction: inverted ? 'bullish' : 'bearish',
      confidence,
      description: `LS@${Math.round(ls.price).toLocaleString()} · HD@${Math.round(hd.price).toLocaleString()} · RS@${Math.round(rs.price).toLocaleString()}`,
      keyLevels: { neckline: Math.round(neckline), target: Math.round(target) },
      barStart: ls.index,
      barEnd: n - 1,
    };
  }
  return null;
}

// ── Double Top / Bottom (stricter) ───────────────────────────

function detectDoubleTopBottom(
  pivots: Pivot[],
  closes: number[],
  isTop = true,
): PatternResult | null {
  const peakType = isTop ? 'high' : 'low';
  const troughType = isTop ? 'low' : 'high';
  const peaks = pivots.filter(p => p.type === peakType);
  if (peaks.length < 2) return null;

  const n = closes.length;

  for (let i = peaks.length - 2; i >= Math.max(0, peaks.length - 6); i--) {
    const p1 = peaks[i];
    const p2 = peaks[i + 1];

    // Peaks must be very close in price (tighter: <2.5%)
    if (pct(p1.price, p2.price) > 2.5) continue;

    // Must have enough separation (at least 10 bars)
    if (p2.index - p1.index < 10) continue;

    // P2 must be recent
    if (p2.index < n * 0.55) continue;

    // Must have prior trend
    if (!priorTrendExists(closes, p1.index, isTop)) continue;

    const midTroughs = pivots.filter(p =>
      p.type === troughType &&
      p.index > p1.index && p.index < p2.index
    );
    if (!midTroughs.length) continue;

    const neckline = avg(midTroughs.map(t => t.price));

    // Meaningful retracement between tops
    const retracePct = isTop
      ? (p1.price - neckline) / p1.price * 100
      : (neckline - p1.price) / neckline * 100;
    if (retracePct < 3) continue; // must retrace at least 3%

    // Current price near neckline (pattern active)
    const currentPrice = closes[n - 1];
    const distPct = isTop
      ? (currentPrice - neckline) / neckline * 100
      : (neckline - currentPrice) / neckline * 100;
    if (distPct < -5 || distPct > 12) continue;

    const height = Math.abs(p1.price - neckline);
    const target = isTop ? neckline - height : neckline + height;
    const confidence = Math.round(Math.min(85, 55 + (2.5 - pct(p1.price, p2.price)) * 8 + Math.min(15, retracePct * 2)));

    return {
      type: isTop ? 'DOUBLE_TOP' : 'DOUBLE_BOTTOM',
      label: PATTERN_CONFIG[isTop ? 'DOUBLE_TOP' : 'DOUBLE_BOTTOM'].label,
      emoji: PATTERN_CONFIG[isTop ? 'DOUBLE_TOP' : 'DOUBLE_BOTTOM'].emoji,
      direction: isTop ? 'bearish' : 'bullish',
      confidence,
      description: `Đỉnh 1@${Math.round(p1.price).toLocaleString()} · Đỉnh 2@${Math.round(p2.price).toLocaleString()} · Neckline@${Math.round(neckline).toLocaleString()}`,
      keyLevels: {
        neckline: Math.round(neckline),
        target: Math.round(target),
        ...(isTop ? { resistance: Math.round(p1.price) } : { support: Math.round(p1.price) }),
      },
      barStart: p1.index,
      barEnd: n - 1,
    };
  }
  return null;
}

// ── Wedge (normalized slope) ─────────────────────────────────

function detectWedge(
  pivots: Pivot[],
  closes: number[],
): PatternResult | null {
  // Use only recent 50% of data
  const cutoff = closes.length * 0.5;
  const recentHighs = pivots.filter(p => p.type === 'high' && p.index > cutoff).slice(-5);
  const recentLows  = pivots.filter(p => p.type === 'low'  && p.index > cutoff).slice(-5);
  if (recentHighs.length < 3 || recentLows.length < 3) return null;

  // Need at least 15 bars of pattern
  const patternStart = Math.min(recentHighs[0].index, recentLows[0].index);
  if (closes.length - 1 - patternStart < 15) return null;

  const highSlope = normalizedSlope(recentHighs.map(p => p.price));
  const lowSlope  = normalizedSlope(recentLows.map(p => p.price));

  const support    = recentLows[recentLows.length - 1].price;
  const resistance = recentHighs[recentHighs.length - 1].price;
  const height     = resistance - support;

  // Rising wedge: both slopes positive, highs slope LESS than lows slope (converging upward)
  // Threshold: slopes must be meaningful (>0.03% per bar)
  if (highSlope > 0.03 && lowSlope > 0.03 && lowSlope > highSlope * 1.3) {
    return {
      type: 'RISING_WEDGE', label: PATTERN_CONFIG.RISING_WEDGE.label,
      emoji: PATTERN_CONFIG.RISING_WEDGE.emoji, direction: 'bearish',
      confidence: 62,
      description: `Nêm tăng: đáy tăng nhanh hơn đỉnh — áp lực bán đang tích tụ`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support), target: Math.round(support - height * 0.7) },
      barStart: patternStart, barEnd: closes.length - 1,
    };
  }

  // Falling wedge: both negative, highs slope MORE negative than lows (converging downward)
  if (highSlope < -0.03 && lowSlope < -0.03 && highSlope < lowSlope * 1.3) {
    return {
      type: 'FALLING_WEDGE', label: PATTERN_CONFIG.FALLING_WEDGE.label,
      emoji: PATTERN_CONFIG.FALLING_WEDGE.emoji, direction: 'bullish',
      confidence: 62,
      description: `Nêm giảm: đỉnh giảm nhanh hơn đáy — áp lực mua đang tích tụ`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support), target: Math.round(resistance + height * 0.7) },
      barStart: patternStart, barEnd: closes.length - 1,
    };
  }
  return null;
}

// ── Triangle (normalized slope, stricter flat test) ──────────

function detectTriangle(
  pivots: Pivot[],
  closes: number[],
): PatternResult | null {
  const cutoff = closes.length * 0.45;
  const recentHighs = pivots.filter(p => p.type === 'high' && p.index > cutoff).slice(-5);
  const recentLows  = pivots.filter(p => p.type === 'low'  && p.index > cutoff).slice(-5);
  if (recentHighs.length < 3 || recentLows.length < 3) return null;

  const patternStart = Math.min(recentHighs[0].index, recentLows[0].index);
  if (closes.length - 1 - patternStart < 12) return null;

  const highSlope = normalizedSlope(recentHighs.map(p => p.price));
  const lowSlope  = normalizedSlope(recentLows.map(p => p.price));

  const resistance = avg(recentHighs.map(p => p.price));
  const support    = avg(recentLows.map(p => p.price));

  // Ascending: flat resistance (<0.02%) + rising lows (>0.04%)
  if (Math.abs(highSlope) < 0.02 && lowSlope > 0.04) {
    return {
      type: 'ASCENDING_TRIANGLE', label: PATTERN_CONFIG.ASCENDING_TRIANGLE.label,
      emoji: PATTERN_CONFIG.ASCENDING_TRIANGLE.emoji, direction: 'bullish',
      confidence: 68,
      description: `Đáy cao dần + kháng cự phẳng@${Math.round(resistance).toLocaleString()} — chuẩn bị breakout`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support), target: Math.round(resistance + (resistance - support)) },
      barStart: patternStart, barEnd: closes.length - 1,
    };
  }

  // Descending: falling highs (<-0.04%) + flat support (<0.02%)
  if (highSlope < -0.04 && Math.abs(lowSlope) < 0.02) {
    return {
      type: 'DESCENDING_TRIANGLE', label: PATTERN_CONFIG.DESCENDING_TRIANGLE.label,
      emoji: PATTERN_CONFIG.DESCENDING_TRIANGLE.emoji, direction: 'bearish',
      confidence: 68,
      description: `Đỉnh thấp dần + hỗ trợ phẳng@${Math.round(support).toLocaleString()} — nguy cơ breakdown`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support), target: Math.round(support - (resistance - support)) },
      barStart: patternStart, barEnd: closes.length - 1,
    };
  }

  // Symmetrical: both converging meaningfully
  if (highSlope < -0.03 && lowSlope > 0.03) {
    return {
      type: 'SYMMETRICAL_TRIANGLE', label: PATTERN_CONFIG.SYMMETRICAL_TRIANGLE.label,
      emoji: PATTERN_CONFIG.SYMMETRICAL_TRIANGLE.emoji, direction: 'neutral',
      confidence: 58,
      description: `Đỉnh thấp dần + đáy cao dần — tích lũy trước breakout`,
      keyLevels: { resistance: Math.round(resistance), support: Math.round(support) },
      barStart: patternStart, barEnd: closes.length - 1,
    };
  }
  return null;
}

// ── Cup & Handle (stricter shape validation) ─────────────────

function detectCupAndHandle(
  pivots: Pivot[],
  closes: number[],
): PatternResult | null {
  if (closes.length < 50) return null;
  const n = closes.length;

  const leftRim  = closes.slice(0, Math.floor(n * 0.12));
  const cupBase  = closes.slice(Math.floor(n * 0.15), Math.floor(n * 0.65));
  const rightRim = closes.slice(Math.floor(n * 0.65), Math.floor(n * 0.82));
  const handle   = closes.slice(Math.floor(n * 0.82));

  if (leftRim.length < 5 || cupBase.length < 15 || rightRim.length < 5 || handle.length < 4) return null;

  const leftMax   = Math.max(...leftRim);
  const rightMax  = Math.max(...rightRim);
  const cupMin    = Math.min(...cupBase);
  const handleMin = Math.min(...handle);
  const handleMax = Math.max(...handle);

  // Rims within 5% of each other
  if (pct(leftMax, rightMax) > 5) return null;
  // Cup depth: 10–40% from rim
  const depth = (leftMax - cupMin) / leftMax;
  if (depth < 0.10 || depth > 0.45) return null;
  // Handle is a small pullback (<= 50% of cup depth from right rim)
  if (rightMax - handleMin > (rightMax - cupMin) * 0.5) return null;
  // Handle bottom above cup bottom
  if (handleMin <= cupMin) return null;
  // Cup base should be rounded — check via std dev being relatively low
  const cupAvg = avg(cupBase);
  const cupStd = Math.sqrt(cupBase.reduce((s, v) => s + (v - cupAvg) ** 2, 0) / cupBase.length);
  if (cupStd / cupAvg > 0.08) return null; // too jagged for a cup

  const target = rightMax + (rightMax - cupMin) * 0.6;
  const confidence = Math.round(Math.min(82, 55 + (5 - pct(leftMax, rightMax)) * 3 + Math.min(15, depth * 60)));

  return {
    type: 'CUP_AND_HANDLE', label: PATTERN_CONFIG.CUP_AND_HANDLE.label,
    emoji: PATTERN_CONFIG.CUP_AND_HANDLE.emoji, direction: 'bullish',
    confidence,
    description: `Cốc sâu ${(depth * 100).toFixed(0)}% · Handle ${((rightMax - handleMin) / rightMax * 100).toFixed(1)}% · Breakout@${Math.round(rightMax).toLocaleString()}`,
    keyLevels: { resistance: Math.round(rightMax), support: Math.round(cupMin), target: Math.round(target) },
    barStart: 0, barEnd: n - 1,
  };
}

// ── Bull / Bear Flag (stricter pole + flag) ──────────────────

function detectFlag(
  pivots: Pivot[],
  closes: number[],
): PatternResult | null {
  if (closes.length < 25) return null;
  const n = closes.length;

  // Pole: 15–30% of bars from back
  const poleStartIdx = Math.floor(n * 0.55);
  const poleEndIdx   = Math.floor(n * 0.75);
  const flagStartIdx = poleEndIdx;

  const pole = closes.slice(poleStartIdx, poleEndIdx);
  const flag = closes.slice(flagStartIdx);
  if (pole.length < 6 || flag.length < 4) return null;

  const poleStart = pole[0];
  const poleEnd   = pole[pole.length - 1];
  const poleMove  = (poleEnd - poleStart) / poleStart;

  // Pole must be sharp: >7% move in relatively few bars
  if (Math.abs(poleMove) < 0.07) return null;

  const flagSlope = normalizedSlope(flag);
  const flagRange = (Math.max(...flag) - Math.min(...flag)) / poleEnd;

  // Flag consolidation must be tight (<5% range) and counter-trend
  if (flagRange > 0.05) return null;

  // Bull flag: sharp up pole + slight downward drift in flag
  if (poleMove > 0.07 && flagSlope < -0.01 && flagSlope > -0.15) {
    const target = closes[n - 1] + Math.abs(poleEnd - poleStart) * 0.8;
    return {
      type: 'BULL_FLAG', label: PATTERN_CONFIG.BULL_FLAG.label,
      emoji: PATTERN_CONFIG.BULL_FLAG.emoji, direction: 'bullish',
      confidence: 70,
      description: `Cột cờ +${(poleMove * 100).toFixed(1)}% · Nghỉ ${flag.length} nến · Breakout dự kiến@${Math.round(Math.max(...flag)).toLocaleString()}`,
      keyLevels: { support: Math.round(Math.min(...flag)), resistance: Math.round(Math.max(...flag)), target: Math.round(target) },
      barStart: poleStartIdx, barEnd: n - 1,
    };
  }

  // Bear flag: sharp down pole + slight upward drift in flag
  if (poleMove < -0.07 && flagSlope > 0.01 && flagSlope < 0.15) {
    const target = closes[n - 1] - Math.abs(poleEnd - poleStart) * 0.8;
    return {
      type: 'BEAR_FLAG', label: PATTERN_CONFIG.BEAR_FLAG.label,
      emoji: PATTERN_CONFIG.BEAR_FLAG.emoji, direction: 'bearish',
      confidence: 70,
      description: `Cột cờ ${(poleMove * 100).toFixed(1)}% · Hồi ${flag.length} nến · Breakdown dự kiến@${Math.round(Math.min(...flag)).toLocaleString()}`,
      keyLevels: { resistance: Math.round(Math.max(...flag)), support: Math.round(Math.min(...flag)), target: Math.round(target) },
      barStart: poleStartIdx, barEnd: n - 1,
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
  if (closes.length < 25) return [];

  // Adaptive lookback: larger for more data → fewer but more meaningful pivots
  const lookback = Math.max(5, Math.floor(closes.length / 15));
  const pivots = findPivots(highs, lows, lookback);

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

  // One result per pattern type, highest confidence wins
  const seen = new Set<PatternType>();
  return results
    .sort((a, b) => b.confidence - a.confidence)
    .filter(r => { if (seen.has(r.type)) return false; seen.add(r.type); return true; });
}
