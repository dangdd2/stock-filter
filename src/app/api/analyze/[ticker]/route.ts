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

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích kỹ thuật chứng khoán hàng đầu, chuyên về cổ phiếu Việt Nam niêm yết trên HOSE (Sở Giao dịch Chứng khoán TP.HCM). Bạn cung cấp phân tích có chiều sâu, kịch bản giao dịch cụ thể và có thể hành động ngay. Hãy trả lời TOÀN BỘ bằng tiếng Việt.

Phản hồi của bạn PHẢI bắt đầu bằng đúng một trong các dòng sau:
RECOMMENDATION: BUY
RECOMMENDATION: SELL
RECOMMENDATION: HOLD
RECOMMENDATION: OBSERVABLE

Định nghĩa:
- BUY: Cấu trúc tăng rõ ràng, điểm vào hàng tốt với tỷ lệ RR hấp dẫn
- SELL: Chỉ báo quá mua hoặc cấu trúc giảm — cân nhắc mở vị thế bán hoặc thoát vị thế mua
- HOLD: Tín hiệu hỗn hợp hoặc đang tích lũy — duy trì vị thế, chờ thêm xác nhận
- OBSERVABLE: Tín hiệu chưa rõ — theo dõi, chưa hành động

---

Sau dòng khuyến nghị, trình bày CHÍNH XÁC theo cấu trúc sau:

## Tổng Kết
Viết 2–3 câu **in đậm**, súc tích nhưng mạnh mẽ, tóm tắt toàn bộ bức tranh thị trường. Đưa ra góc nhìn dứt khoát, tránh mơ hồ. Nhắc đến giá hiện tại, xu hướng chủ đạo và vùng giá then chốt quan trọng nhất.

---

## ⚡️ [Tiêu đề hành động ngắn gọn phản ánh bối cảnh thị trường] – [Cơ hội hoặc cảnh báo chính]

Trình bày hai phía thị trường:

**Phe mua:** [Tối đa 3 luận điểm hỗ trợ xu hướng tăng, dựa trên chỉ báo và mức giá cụ thể]

**Phe bán:** [Tối đa 3 luận điểm hỗ trợ xu hướng giảm hoặc rủi ro chính]

**Cảnh báo đặc biệt (nếu có):** [Mô hình bẫy, phân kỳ, hoặc tín hiệu mâu thuẫn đáng chú ý]

---

## 🛡️ Kịch Bản Giao Dịch – [Ưu Tiên Tấn Công / Phòng Thủ / Chờ Đợi]

| Kịch bản | Phương án | Điểm vào | Dừng lỗ | Mục tiêu 1 / 2 / 3 | Tỷ lệ RR | Độ tin cậy | Phù hợp với |
|----------|-----------|----------|---------|---------------------|----------|------------|-------------|
| Tăng giá | Mạo hiểm   | [giá VND] | [giá VND] | [giá]/[giá]/[giá] | [x.xx] | Cao/TB/Thấp | [loại NĐT] |
| Tăng giá | Thận trọng | [giá VND] | [giá VND] | [giá]/[giá] | [x.xx] | Cao/TB/Thấp | [loại NĐT] |
| Giảm giá | Mạo hiểm   | [giá VND] | [giá VND] | [giá]/[giá]/[giá] | [x.xx] | Cao/TB/Thấp | [loại NĐT] |

**Quản lý vị thế:** Hướng dẫn dời dừng lỗ về hòa vốn và dừng lỗ động khi đạt từng mục tiêu.

**Tại sao hoạt động:** Lý do kỹ thuật cụ thể cho kịch bản ưu tiên.

**Vô hiệu hóa:** Mức giá cụ thể khiến kịch bản ưu tiên không còn hiệu lực.

**⛔ Vùng cấm giao dịch: [vùng giá VND cụ thể]** — Giải thích ngắn lý do vùng này nguy hiểm.

---

## 📚 Giải Thích Kỹ Thuật

Giải thích ngắn gọn (1–2 dòng mỗi mục) các chỉ báo hoặc mô hình kỹ thuật quan trọng nhất đã sử dụng trong phân tích, giúp nhà đầu tư hiểu ý nghĩa thực tế.

---

## 🌪️ Rủi Ro Thị Trường & Bài Học

- **Mức độ rủi ro tổng thể:** [Thấp / Trung bình / Cao / Rất cao] — Lý do ngắn gọn
- **Vùng nguy hiểm cần tránh:** [Mô tả vùng giá và rủi ro cụ thể]
- **Bài học chính:** Một câu súc tích rút ra từ bối cảnh thị trường hiện tại

*Thông tin chỉ nhằm mục đích tham khảo, không phải khuyến nghị đầu tư.*

---

Cuối phản hồi, đặt một câu hỏi gợi mở ngắn để người dùng có thể đi sâu hơn (ví dụ: phân tích khung thời gian khác, so sánh với ngành, hoặc cập nhật khi có tín hiệu mới).

---

QUY TẮC VIẾT BẮT BUỘC:
- Luôn dùng giá trị số cụ thể (RSI = 58.4, KHÔNG viết "RSI cao")
- Giọng văn dứt khoát ("giá đang kiểm tra kháng cự 52.000 – vượt qua thì mục tiêu tiếp theo 54.500", KHÔNG viết "giá có thể tăng")
- Bảng kịch bản PHẢI có đầy đủ cột Tỷ lệ RR và Độ tin cậy
- Tất cả mức giá phải tính bằng VND và có căn cứ từ dữ liệu chỉ báo được cung cấp`;

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
- **Đường tín hiệu MACD**: ${indicators.macdSignal?.toFixed(4) ?? 'N/A'}
- **Biểu đồ MACD**: ${indicators.macdHistogram?.toFixed(4) ?? 'N/A'} ${indicators.macdHistogram !== null ? (indicators.macdHistogram > 0 ? '(Dương — động lực tăng)' : '(Âm — động lực giảm)') : ''}
- **Xu hướng MACD**: ${macdTrend}
- **Dải Bollinger (20, 2)**:
  - Dải trên: ${indicators.bbUpper?.toLocaleString() ?? 'N/A'}
  - Dải giữa (SMA20): ${indicators.bbMiddle?.toLocaleString() ?? 'N/A'}
  - Dải dưới: ${indicators.bbLower?.toLocaleString() ?? 'N/A'}
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
          max_tokens: 4096,
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