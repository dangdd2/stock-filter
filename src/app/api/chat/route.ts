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
  error?: string;
}

async function fetchLiveContext(ticker: string): Promise<LiveTickerContext> {
  const symbol = `${ticker.toUpperCase()}.VN`;
  const empty = (err: string): LiveTickerContext => ({
    ticker, price: 0, change1d: 0, change1w: 0, change1m: 0,
    high52w: 0, low52w: 0, volume: 0, avgVolume20d: 0,
    rsi: null, macdHistogram: null, macdTrend: 'N/A', stochK: null,
    stochZone: 'N/A', bbUpper: null, bbLower: null, bbPosition: 'N/A',
    sma20: null, sma50: null, ema20: null, trendVsSma20: 'N/A', trendVsSma50: 'N/A',
    signal: 'N/A', score: 0, recentNews: [], error: err,
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

    return {
      ticker, price, change1d: pct(price, ago(1)), change1w: pct(price, ago(5)),
      change1m: pct(price, ago(21)), high52w: Math.max(...highs), low52w: Math.min(...lows),
      volume: volumes[n - 1] ?? 0, avgVolume20d: volumes.slice(-20).reduce((s, v) => s + v, 0) / 20,
      rsi, macdHistogram, macdTrend, stochK, stochZone, bbUpper: bbLast?.upper ?? null,
      bbLower: bbLast?.lower ?? null, bbPosition, sma20, sma50, ema20,
      trendVsSma20, trendVsSma50, signal, score, recentNews,
    };
  } catch (e) {
    return empty(e instanceof Error ? e.message : 'Unknown error');
  }
}

function buildContextBlock(ctx: LiveTickerContext): string {
  if (ctx.error) return `\n[${ctx.ticker}] Không thể tải dữ liệu: ${ctx.error}\n`;
  const n = (v: number | null, d = 2) => v == null ? 'N/A' : v.toFixed(d);
  const p = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  return `
=== DỮ LIỆU THỰC ${ctx.ticker} (cập nhật ngay lúc này) ===
Giá hiện tại: ${ctx.price.toLocaleString('vi-VN')} VNĐ
Thay đổi: 1N ${p(ctx.change1d)} | 1T ${p(ctx.change1w)} | 1M ${p(ctx.change1m)}
52T Đỉnh/Đáy: ${ctx.high52w.toLocaleString()} / ${ctx.low52w.toLocaleString()}
Volume hôm nay: ${(ctx.volume / 1e6).toFixed(2)}M cp | Avg20d: ${(ctx.avgVolume20d / 1e6).toFixed(2)}M cp

Chỉ số kỹ thuật:
- RSI(14): ${n(ctx.rsi)} ${ctx.rsi != null ? (ctx.rsi < 30 ? '← QUÁ BÁN' : ctx.rsi > 70 ? '← QUÁ MUA' : '') : ''}
- MACD Histogram: ${n(ctx.macdHistogram, 4)} | Xu hướng: ${ctx.macdTrend}
- Stochastic K: ${n(ctx.stochK)} | Vùng: ${ctx.stochZone}
- Bollinger Bands: Upper ${ctx.bbUpper?.toLocaleString() ?? 'N/A'} | Lower ${ctx.bbLower?.toLocaleString() ?? 'N/A'} | Vị trí: ${ctx.bbPosition}
- SMA20: ${ctx.sma20?.toLocaleString() ?? 'N/A'} | ${ctx.trendVsSma20}
- SMA50: ${ctx.sma50?.toLocaleString() ?? 'N/A'} | ${ctx.trendVsSma50}
- EMA20: ${ctx.ema20?.toLocaleString() ?? 'N/A'}

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
- Trích dẫn con số cụ thể (giá, RSI, %, v.v.)
- Đưa ra nhận định dứt khoát, tránh mơ hồ
- Với câu hỏi phân tích mã cụ thể: đề cập tín hiệu kỹ thuật, xu hướng ngắn/trung hạn, vùng support/resistance
- Với câu hỏi thị trường chung: phân tích breadth, sector rotation, macro
- Cuối mỗi phân tích cụ thể, đưa ra 1 khuyến nghị hành động rõ ràng
- Format dùng markdown (bold, bullet points) cho dễ đọc`;

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
      max_tokens: 1500,
      temperature: 0.5,
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
