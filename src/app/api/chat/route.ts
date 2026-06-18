import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import { RSI, MACD, StochasticRSI, BollingerBands, SMA, EMA } from 'technicalindicators';

export const runtime = 'nodejs';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Live data fetcher ─────────────────────────────────────────────────────────
interface LiveTickerContext {
  ticker: string;
  price: number;
  change1d: number;
  change1w: number;
  change1m: number;
  high52w: number;
  low52w: number;
  volume: number;
  avgVolume20d: number;
  rsi: number | null;
  macdHistogram: number | null;
  macdTrend: string;
  stochK: number | null;
  stochZone: string;
  bbUpper: number | null;
  bbLower: number | null;
  bbPosition: string;
  sma20: number | null;
  sma50: number | null;
  ema20: number | null;
  trendVsSma20: string;
  trendVsSma50: string;
  signal: string;
  score: number;
  recentNews: string[];
  support: number[];
  resistance: number[];
  atr: number | null;
  suggestedEntry: { from: number; to: number } | null;
  suggestedTarget1: number | null;
  suggestedTarget2: number | null;
  suggestedStopLoss: number | null;
  riskReward: number | null;
  error?: string;
}

function computeSupportResistance(highs: number[], lows: number[], current: number): { support: number[]; resistance: number[] } {
  if (!highs.length) return { support: [], resistance: [] };
  const levels: number[] = [];
  const len = Math.min(highs.length, lows.length);
  for (let i = 2; i < len - 2; i++) {
    if (highs[i] >= highs[i - 1] && highs[i] >= highs[i - 2] && highs[i] >= highs[i + 1] && highs[i] >= highs[i + 2]) levels.push(highs[i]);
    if (lows[i] <= lows[i - 1] && lows[i] <= lows[i - 2] && lows[i] <= lows[i + 1] && lows[i] <= lows[i + 2]) levels.push(lows[i]);
  }
  const clustered: number[] = [];
  const used = new Set<number>();
  for (const lvl of [...levels].sort((a, b) => a - b)) {
    if (used.has(lvl)) continue;
    const cluster = levels.filter(l => !used.has(l) && Math.abs(l - lvl) / lvl < 0.015);
    const avg = cluster.reduce((a, b) => a + b, 0) / cluster.length;
    cluster.forEach(l => used.add(l));
    clustered.push(Math.round(avg));
  }
  const support    = clustered.filter(l => l < current * 1.02).sort((a, b) => b - a).slice(0, 3);
  const resistance = clustered.filter(l => l > current * 0.98).sort((a, b) => a - b).slice(0, 3);
  return { support, resistance };
}

function computeATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trs.push(tr);
  }
  const last = trs.slice(-period);
  return last.reduce((a, b) => a + b, 0) / last.length;
}

async function fetchLiveContext(ticker: string): Promise<LiveTickerContext> {
  const symbol = `${ticker.toUpperCase()}.VN`;
  const empty = (err: string): LiveTickerContext => ({
    ticker, price: 0, change1d: 0, change1w: 0, change1m: 0,
    high52w: 0, low52w: 0, volume: 0, avgVolume20d: 0,
    rsi: null, macdHistogram: null, macdTrend: 'N/A', stochK: null,
    stochZone: 'N/A', bbUpper: null, bbLower: null, bbPosition: 'N/A',
    sma20: null, sma50: null, ema20: null, trendVsSma20: 'N/A', trendVsSma50: 'N/A',
    signal: 'N/A', score: 0, recentNews: [],
    support: [], resistance: [], atr: null,
    suggestedEntry: null, suggestedTarget1: null, suggestedTarget2: null,
    suggestedStopLoss: null, riskReward: null,
    error: err,
  });

  try {
    const [priceRes, newsRes] = await Promise.allSettled([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store',
      }),
      fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=5&quotesCount=0`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store',
      }),
    ]);

    let recentNews: string[] = [];
    if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
      const nj = await newsRes.value.json();
      recentNews = (nj.news ?? [])
        .slice(0, 5)
        .map((n: { title: string }) => n.title)
        .filter(Boolean);
    }

    if (priceRes.status !== 'fulfilled' || !priceRes.value.ok) return empty('Yahoo Finance error');
    const json = await priceRes.value.json();
    const result = json.chart?.result?.[0];
    if (!result) return empty('No chart data');

    const rawC: (number | null)[] = result.indicators.quote[0].close || [];
    const rawH: (number | null)[] = result.indicators.quote[0].high || [];
    const rawL: (number | null)[] = result.indicators.quote[0].low || [];
    const rawV: (number | null)[] = result.indicators.quote[0].volume || [];

    const closes: number[] = [], highs: number[] = [], lows: number[] = [], volumes: number[] = [];
    for (let i = 0; i < rawC.length; i++) {
      if (rawC[i] != null && rawH[i] != null && rawL[i] != null) {
        closes.push(rawC[i]!); highs.push(rawH[i]!); lows.push(rawL[i]!); volumes.push(rawV[i] ?? 0);
      }
    }
    if (closes.length < 20) return empty('Not enough data');

    const n = closes.length;
    const price = closes[n - 1];
    const ago = (d: number) => closes[Math.max(0, n - d - 1)];
    const pct = (a: number, b: number) => b ? ((a - b) / b) * 100 : 0;

    const rsiArr   = RSI.calculate({ values: closes, period: 14 });
    const macdArr  = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    const stochArr = StochasticRSI.calculate({ values: closes, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 });
    const bbArr    = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
    const sma20Arr = SMA.calculate({ values: closes, period: 20 });
    const sma50Arr = SMA.calculate({ values: closes, period: 50 });
    const ema20Arr = EMA.calculate({ values: closes, period: 20 });

    const rsi          = rsiArr.at(-1) ?? null;
    const macdLast     = macdArr.at(-1);
    const stochLast    = stochArr.at(-1) as { k: number; d: number } | undefined;
    const bbLast       = bbArr.at(-1);
    const sma20        = sma20Arr.at(-1) ?? null;
    const sma50        = sma50Arr.at(-1) ?? null;
    const ema20        = ema20Arr.at(-1) ?? null;

    const macdHistogram  = macdLast?.histogram ?? null;
    const macdTrend      = macdHistogram == null ? 'N/A' : macdHistogram > 0 ? 'Tăng (bullish)' : 'Giảm (bearish)';
    const stochK         = stochLast?.k ?? null;
    const stochZone      = stochK == null ? 'N/A' : stochK < 20 ? 'Quá bán (oversold)' : stochK > 80 ? 'Quá mua (overbought)' : 'Trung tính';
    const bbPosition     = bbLast == null ? 'N/A' : price > bbLast.upper ? 'Trên dải trên (quá mua)' : price < bbLast.lower ? 'Dưới dải dưới (quá bán)' : 'Trong dải';
    const trendVsSma20   = sma20 == null ? 'N/A' : price > sma20 ? 'Trên SMA20 (tăng ngắn hạn)' : 'Dưới SMA20 (giảm ngắn hạn)';
    const trendVsSma50   = sma50 == null ? 'N/A' : price > sma50 ? 'Trên SMA50 (tăng trung hạn)' : 'Dưới SMA50 (giảm trung hạn)';

    let score = 0;
    if (rsi != null) { if (rsi < 30) score += 1; else if (rsi > 70) score -= 1; }
    if (macdHistogram != null) { if (macdHistogram > 0) score += 1; else score -= 1; }
    if (stochK != null) { if (stochK < 20) score += 1; else if (stochK > 80) score -= 1; }
    if (sma20 != null) { if (price > sma20) score += 1; else score -= 1; }
    if (sma50 != null) { if (price > sma50) score += 1; else score -= 1; }

    const signal = score >= 3 ? 'Mua mạnh (Strong Buy)' : score >= 1 ? 'Mua (Buy)' : score <= -3 ? 'Bán mạnh (Strong Sell)' : score <= -1 ? 'Bán (Sell)' : 'Trung lập (Neutral)';

    const { support, resistance } = computeSupportResistance(highs, lows, price);
    const atr = computeATR(highs, lows, closes);

    // Suggested entry zone: nearest support below price (or small pullback band if no clear support)
    const nearestSupport = support[0] ?? null;
    const suggestedEntry = nearestSupport != null
      ? { from: Math.round(nearestSupport), to: Math.round(nearestSupport * 1.01) }
      : atr != null
        ? { from: Math.round(price - atr), to: Math.round(price - atr * 0.5) }
        : null;

    // Targets: nearest resistance levels above price; fallback to ATR-based projection
    const suggestedTarget1 = resistance[0] != null ? Math.round(resistance[0]) : atr != null ? Math.round(price + atr * 1.5) : null;
    const suggestedTarget2 = resistance[1] != null ? Math.round(resistance[1]) : atr != null ? Math.round(price + atr * 3) : null;

    // Stop loss: below nearest support minus a buffer, or ATR-based
    const suggestedStopLoss = nearestSupport != null
      ? Math.round(nearestSupport * 0.97)
      : atr != null ? Math.round(price - atr * 2) : null;

    const riskReward = suggestedEntry != null && suggestedTarget1 != null && suggestedStopLoss != null
      ? parseFloat((((suggestedTarget1 - suggestedEntry.from) / (suggestedEntry.from - suggestedStopLoss)) || 0).toFixed(2))
      : null;

    return {
      ticker, price, change1d: pct(price, ago(1)), change1w: pct(price, ago(5)),
      change1m: pct(price, ago(21)), high52w: Math.max(...highs), low52w: Math.min(...lows),
      volume: volumes[n - 1] ?? 0, avgVolume20d: volumes.slice(-20).reduce((s, v) => s + v, 0) / 20,
      rsi, macdHistogram, macdTrend, stochK, stochZone, bbUpper: bbLast?.upper ?? null,
      bbLower: bbLast?.lower ?? null, bbPosition, sma20, sma50, ema20,
      trendVsSma20, trendVsSma50, signal, score, recentNews,
      support, resistance, atr,
      suggestedEntry, suggestedTarget1, suggestedTarget2, suggestedStopLoss, riskReward,
    };
  } catch (e) {
    return empty(e instanceof Error ? e.message : 'Unknown error');
  }
}

function buildContextBlock(ctx: LiveTickerContext): string {
  if (ctx.error) return `\n[${ctx.ticker}] Không thể tải dữ liệu: ${ctx.error}\n`;
  const n = (v: number | null, d = 2) => v == null ? 'N/A' : v.toFixed(d);
  const p = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const fmt = (v: number) => v.toLocaleString('vi-VN');
  return `
=== DỮ LIỆU THỰC ${ctx.ticker} (cập nhật ngay lúc này) ===
Giá hiện tại: ${fmt(ctx.price)} VNĐ
Thay đổi: 1N ${p(ctx.change1d)} | 1T ${p(ctx.change1w)} | 1M ${p(ctx.change1m)}
52T Đỉnh/Đáy: ${fmt(ctx.high52w)} / ${fmt(ctx.low52w)}
Volume hôm nay: ${(ctx.volume / 1e6).toFixed(2)}M cp | Avg20d: ${(ctx.avgVolume20d / 1e6).toFixed(2)}M cp

Chỉ số kỹ thuật:
- RSI(14): ${n(ctx.rsi)} ${ctx.rsi != null ? (ctx.rsi < 30 ? '← QUÁ BÁN' : ctx.rsi > 70 ? '← QUÁ MUA' : '') : ''}
- MACD Histogram: ${n(ctx.macdHistogram, 4)} | Xu hướng: ${ctx.macdTrend}
- Stochastic K: ${n(ctx.stochK)} | Vùng: ${ctx.stochZone}
- Bollinger Bands: Upper ${ctx.bbUpper ? fmt(ctx.bbUpper) : 'N/A'} | Lower ${ctx.bbLower ? fmt(ctx.bbLower) : 'N/A'} | Vị trí: ${ctx.bbPosition}
- SMA20: ${ctx.sma20 ? fmt(ctx.sma20) : 'N/A'} | ${ctx.trendVsSma20}
- SMA50: ${ctx.sma50 ? fmt(ctx.sma50) : 'N/A'} | ${ctx.trendVsSma50}
- EMA20: ${ctx.ema20 ? fmt(ctx.ema20) : 'N/A'}
- ATR(14): ${ctx.atr != null ? fmt(Math.round(ctx.atr)) : 'N/A'} (biến động trung bình/ngày)

Vùng hỗ trợ (support, gần → xa): ${ctx.support.length ? ctx.support.map(fmt).join(' | ') : 'Chưa xác định rõ'}
Vùng kháng cự (resistance, gần → xa): ${ctx.resistance.length ? ctx.resistance.map(fmt).join(' | ') : 'Chưa xác định rõ'}

★ KẾ HOẠCH GIAO DỊCH GỢI Ý (tính sẵn từ pivot S/R + ATR — dùng các số này khi trả lời, KHÔNG tự bịa số khác):
- Vùng vào lệnh (entry): ${ctx.suggestedEntry ? `${fmt(ctx.suggestedEntry.from)} – ${fmt(ctx.suggestedEntry.to)}` : 'N/A'}
- Mục tiêu 1 (target 1): ${ctx.suggestedTarget1 ? fmt(ctx.suggestedTarget1) : 'N/A'}
- Mục tiêu 2 (target 2): ${ctx.suggestedTarget2 ? fmt(ctx.suggestedTarget2) : 'N/A'}
- Cắt lỗ (stop loss): ${ctx.suggestedStopLoss ? fmt(ctx.suggestedStopLoss) : 'N/A'}
- Tỷ lệ Risk/Reward (đến target 1): ${ctx.riskReward != null ? `1 : ${ctx.riskReward}` : 'N/A'}

Tổng hợp tín hiệu: ${ctx.signal} (điểm: ${ctx.score > 0 ? '+' : ''}${ctx.score}/5)
${ctx.recentNews.length ? `\nTin tức gần đây:\n${ctx.recentNews.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : ''}
======================================================
`;
}

// ─── Ticker extractor ──────────────────────────────────────────────────────────
function extractTickers(text: string): string[] {
  // Match 2-4 uppercase letters that look like VN tickers
  const matches = text.match(/\b([A-Z]{2,4})\b/g) ?? [];
  // Common VN tickers heuristic — filter out common words
  const stopWords = new Set(['AI', 'OK', 'VN', 'HOW', 'WHY', 'THE', 'AND', 'FOR', 'RSI', 'EMA', 'SMA', 'BB', 'MFI', 'OBV', 'ATR', 'PE', 'ROE', 'EPS', 'USD', 'VND']);
  return [...new Set(matches.filter(t => !stopWords.has(t)))].slice(0, 3);
}

// ─── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM = `Bạn là trợ lý phân tích chứng khoán Việt Nam thông minh, có khả năng đọc dữ liệu thị trường realtime.

Nguyên tắc trả lời:
- Luôn dùng tiếng Việt, chuyên nghiệp nhưng dễ hiểu
- Khi có dữ liệu thực của mã cổ phiếu trong context, hãy phân tích DỰA TRÊN SỐ LIỆU ĐÓ, không nói chung chung
- Trích dẫn con số cụ thể (giá, RSI, %, vùng giá, v.v.) — KHÔNG bịa số, chỉ dùng số có trong context
- TUYỆT ĐỐI KHÔNG trả lời mơ hồ kiểu "chờ đợi và quan sát thêm", "có thể tăng có thể giảm", "theo dõi thêm tín hiệu". Đây là câu trả lời VÔ DỤNG với nhà đầu tư. Luôn đưa ra hành động cụ thể.
- Khi context có "KẾ HOẠCH GIAO DỊCH GỢI Ý" (entry/target/stop loss/risk-reward), LUÔN trích dẫn các số này trong phần khuyến nghị — đây là số đã được tính toán sẵn từ pivot support/resistance + ATR, đáng tin cậy hơn số tự suy luận
- Với câu hỏi phân tích mã cụ thể, cấu trúc câu trả lời theo thứ tự:
  1. Nhận định nhanh: xu hướng hiện tại + tín hiệu nổi bật nhất (1-2 câu)
  2. Phân tích kỹ thuật: RSI/MACD/Stoch/BB — chỉ nêu cái có ý nghĩa, không liệt kê máy móc tất cả
  3. Vùng giá hành động: entry cụ thể, target 1 + target 2, stop loss, risk/reward — LẤY TỪ "KẾ HOẠCH GIAO DỊCH GỢI Ý" nếu có
  4. Khuyến nghị dứt khoát: MUA / BÁN / GIỮ / ĐỨNG NGOÀI — chọn 1, kèm điều kiện kích hoạt rõ ràng (ví dụ: "Mua nếu giá hồi về vùng X, cắt lỗ nếu phá Y")
- Nếu dữ liệu không đủ để có vùng giá cụ thể (atr/support N/A), nói rõ lý do, không tự bịa số thay thế
- Với câu hỏi thị trường chung: phân tích breadth, sector rotation, macro — vẫn cần kết luận hành động cụ thể, không lửng lơ
- Format dùng markdown (bold, bullet points) cho dễ đọc, súc tích, tránh lặp lại số liệu nhiều lần`;

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages, watchlistTickers = [] } = await req.json();
    if (!messages?.length) return new Response('No messages', { status: 400 });

    // Extract tickers from latest user message
    const lastMsg = messages[messages.length - 1]?.content ?? '';
    const mentionedTickers = extractTickers(lastMsg);

    // Also check if watchlist tickers are mentioned
    const wlMentioned = watchlistTickers.filter((t: string) =>
      lastMsg.toUpperCase().includes(t.toUpperCase())
    );
    const allTickers = [...new Set([...mentionedTickers, ...wlMentioned])].slice(0, 3);

    // Fetch live context for all mentioned tickers
    let contextBlocks = '';
    if (allTickers.length > 0) {
      const contexts = await Promise.all(allTickers.map(fetchLiveContext));
      contextBlocks = contexts.map(buildContextBlock).join('\n');
    }

    // Build system prompt with injected live data
    const systemWithContext = contextBlocks
      ? `${SYSTEM}\n\n${contextBlocks}\nSử dụng dữ liệu trên để trả lời câu hỏi của người dùng.`
      : SYSTEM;

    // Stream response
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemWithContext },
        ...messages.slice(-12), // keep last 12 turns for context window
      ],
      max_tokens: 1800,
      temperature: 0.4,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // First send which tickers were fetched
        if (allTickers.length > 0) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'context', tickers: allTickers })}\n\n`
          ));
        }
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'token', content: delta })}\n\n`
            ));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
