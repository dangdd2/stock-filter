import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';

interface EntryExitRequest {
  price: number;
  closes6m: number[];
  highs6m: number[];
  lows6m: number[];
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  volume: number;
  avgVolume20d: number | null;
  mfi: number | null;
  obvTrend: number | null;
  change1m: number | null;
  change3m: number | null;
  signalHistory: {
    direction: 'BUY' | 'SELL';
    priceAtSignal: number;
    return7d: number | null;
    return14d: number | null;
    convictionScore: number;
  }[];
}

export interface EntryExitResult {
  ticker: string;
  generatedAt: string;
  currentPrice: number;
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  confidence: 'CAO' | 'TRUNG BÌNH' | 'THẤP';
  entryZones: {
    type: 'AGGRESSIVE' | 'CONSERVATIVE' | 'BREAKOUT';
    label: string;
    priceFrom: number;
    priceTo: number;
    reason: string;
    priority: 1 | 2 | 3;
  }[];
  exitZones: {
    type: 'TARGET_1' | 'TARGET_2' | 'TARGET_3' | 'STOP_LOSS' | 'TRAILING';
    label: string;
    price: number;
    pctFromCurrent: number;
    reason: string;
  }[];
  stopLoss: {
    price: number;
    pctFromEntry: number;
    reason: string;
  };
  riskReward: number;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  historicalAccuracy: {
    totalSignals: number;
    winRate: number | null;
    avgReturn7d: number | null;
    avgReturn14d: number | null;
    bestEntry: number | null;
    worstEntry: number | null;
  };
  summary: string;
  warnings: string[];
}

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// In-memory cache
const cache = new Map<string, { data: EntryExitResult; expiresAt: number }>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

function computeSupportResistance(highs: number[], lows: number[], closes: number[], current: number): { support: number[]; resistance: number[] } {
  if (!closes.length) return { support: [], resistance: [] };

  // Simple pivot-based S/R from 6-month data
  const levels: number[] = [];
  const len = Math.min(highs.length, lows.length, closes.length);
  for (let i = 2; i < len - 2; i++) {
    // Local high
    if (highs[i] >= highs[i - 1] && highs[i] >= highs[i - 2] &&
        highs[i] >= highs[i + 1] && highs[i] >= highs[i + 2]) {
      levels.push(highs[i]);
    }
    // Local low
    if (lows[i] <= lows[i - 1] && lows[i] <= lows[i - 2] &&
        lows[i] <= lows[i + 1] && lows[i] <= lows[i + 2]) {
      levels.push(lows[i]);
    }
  }

  // Cluster nearby levels (within 1.5%)
  const clustered: number[] = [];
  const used = new Set<number>();
  for (const lvl of levels.sort((a, b) => a - b)) {
    if (used.has(lvl)) continue;
    const cluster = levels.filter(l => !used.has(l) && Math.abs(l - lvl) / lvl < 0.015);
    const avg = cluster.reduce((a, b) => a + b, 0) / cluster.length;
    cluster.forEach(l => used.add(l));
    clustered.push(Math.round(avg));
  }

  const support = clustered.filter(l => l < current * 1.02).sort((a, b) => b - a).slice(0, 3);
  const resistance = clustered.filter(l => l > current * 0.98).sort((a, b) => a - b).slice(0, 3);
  return { support, resistance };
}

function computeHistoricalAccuracy(history: EntryExitRequest['signalHistory']) {
  if (!history.length) {
    return { totalSignals: 0, winRate: null, avgReturn7d: null, avgReturn14d: null, bestEntry: null, worstEntry: null };
  }

  const withReturns = history.filter(s => s.return7d !== null);
  const wins = withReturns.filter(s => (s.direction === 'BUY' ? (s.return7d! > 0) : (s.return7d! < 0)));
  const returns7d = withReturns.map(s => s.return7d!);
  const returns14d = history.filter(s => s.return14d !== null).map(s => s.return14d!);

  return {
    totalSignals: history.length,
    winRate: withReturns.length > 0 ? (wins.length / withReturns.length) * 100 : null,
    avgReturn7d: returns7d.length > 0 ? returns7d.reduce((a, b) => a + b, 0) / returns7d.length : null,
    avgReturn14d: returns14d.length > 0 ? returns14d.reduce((a, b) => a + b, 0) / returns14d.length : null,
    bestEntry: withReturns.length > 0 ? Math.max(...returns7d) : null,
    worstEntry: withReturns.length > 0 ? Math.min(...returns7d) : null,
  };
}

const SYSTEM_PROMPT = `Bạn là chuyên gia định lượng về thị trường chứng khoán Việt Nam. Nhiệm vụ: phân tích dữ liệu kỹ thuật và lịch sử tín hiệu để xác định CHÍNH XÁC các vùng vào lệnh và thoát lệnh tối ưu.

Bạn PHẢI trả về JSON hợp lệ duy nhất, không có markdown, không có giải thích ngoài JSON.

Cấu trúc JSON bắt buộc:
{
  "trend": "BULLISH" | "BEARISH" | "SIDEWAYS",
  "confidence": "CAO" | "TRUNG BÌNH" | "THẤP",
  "entryZones": [
    {
      "type": "AGGRESSIVE" | "CONSERVATIVE" | "BREAKOUT",
      "label": "string (ví dụ: Vào tích cực tại vùng hỗ trợ BB)",
      "priceFrom": number,
      "priceTo": number,
      "reason": "string ngắn gọn",
      "priority": 1 | 2 | 3
    }
  ],
  "exitZones": [
    {
      "type": "TARGET_1" | "TARGET_2" | "TARGET_3" | "STOP_LOSS" | "TRAILING",
      "label": "string",
      "price": number,
      "pctFromCurrent": number,
      "reason": "string"
    }
  ],
  "stopLoss": {
    "price": number,
    "pctFromEntry": number,
    "reason": "string"
  },
  "riskReward": number,
  "summary": "string 2-3 câu tiếng Việt súc tích",
  "warnings": ["string"]
}

QUY TẮC:
- entryZones: 2-3 vùng, ưu tiên vùng hỗ trợ kỹ thuật rõ ràng
- exitZones: bao gồm 2-3 mục tiêu lợi nhuận VÀ 1 stop loss
- stopLoss: dựa trên ATR hoặc cấu trúc thị trường, không quá 7% từ entry
- riskReward: tính từ entry zone 1 đến target 1
- Tất cả giá tính bằng VND, làm tròn hợp lý
- warnings: tối đa 3 cảnh báo quan trọng nhất (rỗng nếu không có)
- Nếu lịch sử tín hiệu cho thấy win rate thấp, phản ánh vào confidence và warnings`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const body: EntryExitRequest = await request.json();

    const cacheKey = `${ticker}|${body.price}|${body.rsi?.toFixed(1)}|${body.macdHistogram?.toFixed(3)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data);
    }

    // Pre-compute S/R levels
    const { support, resistance } = computeSupportResistance(
      body.highs6m || [],
      body.lows6m || [],
      body.closes6m || [],
      body.price
    );

    // Historical accuracy from signal history
    const historicalAccuracy = computeHistoricalAccuracy(body.signalHistory || []);

    const closes = body.closes6m || [];
    const recentCloses = closes.slice(-20);
    const sma20 = recentCloses.length ? recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length : null;
    const high6m = body.highs6m?.length ? Math.max(...body.highs6m) : null;
    const low6m = body.lows6m?.length ? Math.min(...body.lows6m) : null;

    const userMessage = `Phân tích Entry/Exit cho ${ticker} (HOSE - Việt Nam):

## Giá & Xu Hướng
- Giá hiện tại: ${body.price.toLocaleString()} VND
- SMA20: ${sma20 ? Math.round(sma20).toLocaleString() : 'N/A'} VND
- High 6 tháng: ${high6m?.toLocaleString() ?? 'N/A'} VND
- Low 6 tháng: ${low6m?.toLocaleString() ?? 'N/A'} VND
- Thay đổi 1 tháng: ${body.change1m !== null ? body.change1m.toFixed(2) + '%' : 'N/A'}
- Thay đổi 3 tháng: ${body.change3m !== null ? body.change3m.toFixed(2) + '%' : 'N/A'}

## Chỉ Báo Kỹ Thuật
- RSI(14): ${body.rsi?.toFixed(2) ?? 'N/A'}
- Stoch K/D: ${body.stochK?.toFixed(2) ?? 'N/A'} / ${body.stochD?.toFixed(2) ?? 'N/A'}
- MACD: ${body.macd?.toFixed(4) ?? 'N/A'} | Signal: ${body.macdSignal?.toFixed(4) ?? 'N/A'} | Histogram: ${body.macdHistogram?.toFixed(4) ?? 'N/A'}
- BB Upper/Mid/Lower: ${body.bbUpper?.toLocaleString() ?? 'N/A'} / ${body.bbMiddle?.toLocaleString() ?? 'N/A'} / ${body.bbLower?.toLocaleString() ?? 'N/A'}
- MFI: ${body.mfi?.toFixed(2) ?? 'N/A'}
- OBV Trend: ${body.obvTrend !== null ? (body.obvTrend > 0 ? 'Tăng' : body.obvTrend < 0 ? 'Giảm' : 'Ngang') : 'N/A'}
- Volume hiện tại: ${(body.volume / 1000).toFixed(0)}K | Avg20d: ${body.avgVolume20d ? (body.avgVolume20d / 1000).toFixed(0) + 'K' : 'N/A'}

## Vùng Hỗ Trợ / Kháng Cự (tính từ pivot 6 tháng)
- Kháng cự: ${resistance.map(r => r.toLocaleString()).join(' | ') || 'N/A'}
- Hỗ trợ: ${support.map(s => s.toLocaleString()).join(' | ') || 'N/A'}

## Lịch Sử Tín Hiệu AI (${historicalAccuracy.totalSignals} tín hiệu)
- Win rate 7 ngày: ${historicalAccuracy.winRate !== null ? historicalAccuracy.winRate.toFixed(1) + '%' : 'Chưa đủ dữ liệu'}
- Return TB 7 ngày: ${historicalAccuracy.avgReturn7d !== null ? historicalAccuracy.avgReturn7d.toFixed(2) + '%' : 'N/A'}
- Return TB 14 ngày: ${historicalAccuracy.avgReturn14d !== null ? historicalAccuracy.avgReturn14d.toFixed(2) + '%' : 'N/A'}
- Tín hiệu tốt nhất: ${historicalAccuracy.bestEntry !== null ? '+' + historicalAccuracy.bestEntry.toFixed(2) + '%' : 'N/A'}
- Tín hiệu tệ nhất: ${historicalAccuracy.worstEntry !== null ? historicalAccuracy.worstEntry.toFixed(2) + '%' : 'N/A'}

Hãy xác định vùng Entry/Exit tối ưu dựa trên tất cả dữ liệu trên. Trả về JSON.`;

    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
      temperature: 0.2,
    });

    const rawText = completion.choices[0]?.message?.content ?? '{}';
    // Strip any markdown fences
    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const aiResult = JSON.parse(cleanText);

    const result: EntryExitResult = {
      ticker,
      generatedAt: new Date().toISOString(),
      currentPrice: body.price,
      trend: aiResult.trend ?? 'SIDEWAYS',
      confidence: aiResult.confidence ?? 'THẤP',
      entryZones: aiResult.entryZones ?? [],
      exitZones: aiResult.exitZones ?? [],
      stopLoss: aiResult.stopLoss ?? { price: 0, pctFromEntry: 0, reason: '' },
      riskReward: aiResult.riskReward ?? 0,
      keyLevels: { support, resistance },
      historicalAccuracy,
      summary: aiResult.summary ?? '',
      warnings: aiResult.warnings ?? [],
    };

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[entry-exit] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute entry/exit' },
      { status: 500 }
    );
  }
}
