import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';

interface IndicatorData {
  price: number;
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
}

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an expert stock market analyst specializing in Vietnamese stocks listed on HOSE (Ho Chi Minh Stock Exchange). You provide clear, actionable investment recommendations based on technical analysis.

Your response MUST begin with exactly one of these lines:
RECOMMENDATION: BUY
RECOMMENDATION: SELL
RECOMMENDATION: HOLD
RECOMMENDATION: OBSERVABLE

Definitions:
- BUY: Strong bullish technical signals — good entry point
- SELL: Overbought indicators or bearish signals — consider reducing or exiting position
- HOLD: Mixed signals or consolidation — maintain current position and wait for clarity
- OBSERVABLE: Insufficient signal clarity — monitor before acting, no clear direction

After the recommendation line, structure your response as:

## Technical Analysis
Interpret each indicator (RSI, MACD, Stochastic RSI) and their combined signal. Reference the exact values provided.

## Signal Summary
A concise table or bullet list of each indicator's current signal (bullish / bearish / neutral).

## Risk Factors
Key risks to the recommendation.

## Conclusion
One-paragraph summary reinforcing the recommendation.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const indicators: IndicatorData = await request.json();

  const macdTrend =
    indicators.macd !== null && indicators.macdSignal !== null
      ? indicators.macd > indicators.macdSignal
        ? 'MACD above Signal (Bullish crossover)'
        : 'MACD below Signal (Bearish crossover)'
      : 'N/A';

  const rsiZone =
    indicators.rsi !== null
      ? indicators.rsi > 70
        ? '(Overbought ⚠️)'
        : indicators.rsi < 30
          ? '(Oversold — potential reversal)'
          : '(Neutral zone)'
      : '';

  const stochZone =
    indicators.stochK !== null
      ? indicators.stochK > 80
        ? '(Overbought ⚠️)'
        : indicators.stochK < 20
          ? '(Oversold)'
          : ''
      : '';

  const userMessage = `Please analyze ${ticker} (${ticker}.VN) listed on HOSE Vietnam.

## Current Technical Indicators
- **Price**: ${indicators.price?.toLocaleString()} VND
- **RSI (14)**: ${indicators.rsi?.toFixed(2) ?? 'N/A'} ${rsiZone}
- **Stochastic RSI**: K = ${indicators.stochK?.toFixed(2) ?? 'N/A'}, D = ${indicators.stochD?.toFixed(2) ?? 'N/A'} ${stochZone}
- **MACD**: ${indicators.macd?.toFixed(4) ?? 'N/A'}
- **MACD Signal**: ${indicators.macdSignal?.toFixed(4) ?? 'N/A'}
- **MACD Histogram**: ${indicators.macdHistogram?.toFixed(4) ?? 'N/A'} ${indicators.macdHistogram !== null ? (indicators.macdHistogram > 0 ? '(Positive — bullish momentum)' : '(Negative — bearish momentum)') : ''}
- **MACD Trend**: ${macdTrend}

Based on these technical indicators, provide your analysis and recommendation.`;

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.chat.completions.create({
          model: 'moonshotai/kimi-k2-instruct',
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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

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
    },
  });
}
