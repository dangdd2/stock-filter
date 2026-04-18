import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';

interface IndicatorData {
  price: number;
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

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// In-memory cache: key → { content, expiresAt }
const cache = new Map<string, { content: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function cacheKey(ticker: string, indicators: IndicatorData): string {
  return `${ticker}|${indicators.price}|${indicators.volume}|${indicators.rsi?.toFixed(2)}|${indicators.macd?.toFixed(4)}|${indicators.stochK?.toFixed(2)}`;
}

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích thị trường chứng khoán, chuyên về cổ phiếu Việt Nam niêm yết trên HOSE (Sở Giao dịch Chứng khoán TP.HCM). Bạn cung cấp khuyến nghị đầu tư rõ ràng, có thể hành động dựa trên phân tích kỹ thuật. Hãy trả lời TOÀN BỘ bằng tiếng Việt.

Phản hồi của bạn PHẢI bắt đầu bằng đúng một trong các dòng sau:
RECOMMENDATION: BUY
RECOMMENDATION: SELL
RECOMMENDATION: HOLD
RECOMMENDATION: OBSERVABLE

Định nghĩa:
- BUY: Tín hiệu kỹ thuật tăng mạnh — điểm vào hàng tốt
- SELL: Chỉ báo quá mua hoặc tín hiệu giảm — cân nhắc giảm hoặc thoát vị thế
- HOLD: Tín hiệu hỗn hợp hoặc đang tích lũy — duy trì vị thế hiện tại và chờ thêm tín hiệu
- OBSERVABLE: Tín hiệu chưa rõ ràng — theo dõi trước khi hành động

Sau dòng khuyến nghị, trình bày theo cấu trúc:

## Phân Tích Kỹ Thuật
Diễn giải từng chỉ báo (RSI, MACD, Stochastic RSI, Khối lượng) và tín hiệu tổng hợp. Tham chiếu các giá trị cụ thể được cung cấp.

## Tóm Tắt Tín Hiệu
Danh sách ngắn gọn tín hiệu của từng chỉ báo (tăng / giảm / trung lập).

## Rủi Ro
Các rủi ro chính đối với khuyến nghị.

## Kết Luận
Một đoạn tóm tắt củng cố khuyến nghị.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const indicators: IndicatorData = await request.json();

  const key = cacheKey(ticker, indicators);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    // Serve from cache as a single SSE chunk
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: cached.content })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Cache': 'HIT',
      },
    });
  }

  const macdTrend =
    indicators.macd !== null && indicators.macdSignal !== null
      ? indicators.macd > indicators.macdSignal
        ? 'MACD trên Signal (xu hướng tăng)'
        : 'MACD dưới Signal (xu hướng giảm)'
      : 'N/A';

  const rsiZone =
    indicators.rsi !== null
      ? indicators.rsi > 70
        ? '(Quá mua ⚠️)'
        : indicators.rsi < 30
          ? '(Quá bán — khả năng đảo chiều)'
          : '(Vùng trung lập)'
      : '';

  const stochZone =
    indicators.stochK !== null
      ? indicators.stochK > 80
        ? '(Quá mua ⚠️)'
        : indicators.stochK < 20
          ? '(Quá bán)'
          : ''
      : '';

  const formatVolume = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` :
    v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);

  const userMessage = `Hãy phân tích cổ phiếu ${ticker} (${ticker}.VN) niêm yết trên HOSE Việt Nam.

## Chỉ Báo Kỹ Thuật Hiện Tại
- **Giá**: ${indicators.price?.toLocaleString()} VND
- **Khối lượng giao dịch**: ${formatVolume(indicators.volume ?? 0)} cổ phiếu
- **RSI (14)**: ${indicators.rsi?.toFixed(2) ?? 'N/A'} ${rsiZone}
- **Stochastic RSI**: K = ${indicators.stochK?.toFixed(2) ?? 'N/A'}, D = ${indicators.stochD?.toFixed(2) ?? 'N/A'} ${stochZone}
- **MACD**: ${indicators.macd?.toFixed(4) ?? 'N/A'}
- **MACD Signal**: ${indicators.macdSignal?.toFixed(4) ?? 'N/A'}
- **MACD Histogram**: ${indicators.macdHistogram?.toFixed(4) ?? 'N/A'} ${indicators.macdHistogram !== null ? (indicators.macdHistogram > 0 ? '(Dương — động lực tăng)' : '(Âm — động lực giảm)') : ''}
- **Xu hướng MACD**: ${macdTrend}
- **Bollinger Bands (20, 2)**:
  - Upper: ${indicators.bbUpper?.toLocaleString() ?? 'N/A'}
  - Middle (SMA20): ${indicators.bbMiddle?.toLocaleString() ?? 'N/A'}
  - Lower: ${indicators.bbLower?.toLocaleString() ?? 'N/A'}
  ${indicators.bbUpper && indicators.bbLower ? `- Giá hiện tại ${indicators.price > indicators.bbUpper ? 'TRÊN dải trên ⚠️ (quá mua)' : indicators.price < indicators.bbLower ? 'DƯỚI dải dưới (quá bán)' : 'NẰM TRONG dải Bollinger'}` : ''}
  ${indicators.bbUpper && indicators.bbLower ? `- %B = ${(((indicators.price - indicators.bbLower) / (indicators.bbUpper - indicators.bbLower)) * 100).toFixed(1)}%` : ''}

Dựa trên các chỉ báo kỹ thuật này, hãy cung cấp phân tích và khuyến nghị của bạn.`;

  const encoder = new TextEncoder();
  let accumulated = '';

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.chat.completions.create({
          model: 'openai/gpt-oss-120b', //'moonshotai/kimi-k2-instruct',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          stream: true,
          max_tokens: 2048,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            accumulated += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // Store in cache
        cache.set(key, { content: accumulated, expiresAt: Date.now() + CACHE_TTL_MS });

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Analysis failed';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Cache': 'MISS',
    },
  });
}
