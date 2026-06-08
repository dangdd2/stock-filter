import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 0;

export interface CorrelationResult {
  tickers: string[];
  matrix: number[][];          // NxN Pearson correlation, -1..1
  closes: Record<string, number[]>; // last 60 daily closes per ticker
  dates?: number[];            // timestamps aligned to shortest series
  errors: Record<string, string>;
}

// Pearson correlation between two equal-length arrays
function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 5) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da2 = 0, db2 = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    da2 += da * da;
    db2 += db * db;
  }
  const denom = Math.sqrt(da2 * db2);
  return denom === 0 ? 0 : num / denom;
}

// Convert closes to % daily returns
function returns(closes: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    ret.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return ret;
}

async function fetchCloses(symbol: string): Promise<{ closes: number[]; timestamps: number[] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No data');
  const rawCloses: number[] = result.indicators.quote[0].close || [];
  const rawTs: number[] = result.timestamp || [];
  const closes: number[] = [];
  const timestamps: number[] = [];
  for (let i = 0; i < rawCloses.length; i++) {
    if (rawCloses[i] != null) {
      closes.push(rawCloses[i]);
      timestamps.push(rawTs[i]);
    }
  }
  if (closes.length < 20) throw new Error('Not enough data');
  return { closes, timestamps };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTickers: string[] = body.tickers ?? [];
    if (rawTickers.length < 2) {
      return NextResponse.json({ error: 'Cần ít nhất 2 mã cổ phiếu' }, { status: 400 });
    }
    const tickers = rawTickers.map((t: string) => t.toUpperCase()).slice(0, 20);

    const results = await Promise.allSettled(
      tickers.map(t => fetchCloses(`${t}.VN`))
    );

    const closesMap: Record<string, number[]> = {};
    const errors: Record<string, string> = {};

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        closesMap[tickers[i]] = r.value.closes;
      } else {
        errors[tickers[i]] = r.reason instanceof Error ? r.reason.message : 'Error';
      }
    });

    const validTickers = tickers.filter(t => closesMap[t]);
    if (validTickers.length < 2) {
      return NextResponse.json({ error: 'Không đủ dữ liệu để tính tương quan' }, { status: 400 });
    }

    // Align to same length (shortest series), use last N points
    const minLen = Math.min(...validTickers.map(t => closesMap[t].length));
    const aligned: Record<string, number[]> = {};
    for (const t of validTickers) {
      aligned[t] = closesMap[t].slice(-minLen);
    }

    // Build return series for correlation
    const retSeries: Record<string, number[]> = {};
    for (const t of validTickers) {
      retSeries[t] = returns(aligned[t]);
    }

    // Build NxN correlation matrix
    const n = validTickers.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1;
      for (let j = i + 1; j < n; j++) {
        const r = pearson(retSeries[validTickers[i]], retSeries[validTickers[j]]);
        matrix[i][j] = r;
        matrix[j][i] = r;
      }
    }

    // Return last 60 closes for scatter
    const closes60: Record<string, number[]> = {};
    for (const t of validTickers) {
      closes60[t] = aligned[t].slice(-60);
    }

    return NextResponse.json({
      tickers: validTickers,
      matrix,
      closes: closes60,
      errors,
    } satisfies CorrelationResult);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
