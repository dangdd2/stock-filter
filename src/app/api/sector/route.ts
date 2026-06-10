import { NextRequest, NextResponse } from 'next/server';
import { VN_SECTORS, type SectorDef } from '@/data/vnSectors';

export const revalidate = 0;

export interface TickerPerf {
  ticker: string;
  price: number;
  change1d: number;
  change1w: number;
  change1m: number;
  change3m: number;
  rsi: number | null;
  volume: number;
  error?: boolean;
}

export interface SectorPerf {
  sector: SectorDef;
  tickers: TickerPerf[];
  // Aggregated (median of valid tickers)
  avgChange1d: number;
  avgChange1w: number;
  avgChange1m: number;
  avgChange3m: number;
  avgRsi: number | null;
  topMover: TickerPerf | null;   // best 1d
  worstMover: TickerPerf | null; // worst 1d
  breadth: number;               // % tickers with positive 1d return
  validCount: number;
}

export interface SectorAnalysisResult {
  sectors: SectorPerf[];
  fetchedAt: number;
}

const pct = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100;
const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};

async function fetchBatch(tickers: string[]): Promise<TickerPerf[]> {
  // Fetch all in parallel — Yahoo Finance handles concurrent requests well
  const results = await Promise.allSettled(
    tickers.map(async (ticker): Promise<TickerPerf> => {
      const symbol = `${ticker}.VN`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=4mo`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
      if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`);
      const json = await res.json();
      const result = json.chart?.result?.[0];
      if (!result) throw new Error(`${ticker}: no data`);

      const rawC: (number | null)[] = result.indicators.quote[0].close || [];
      const rawV: (number | null)[] = result.indicators.quote[0].volume || [];
      const closes = rawC.filter((c): c is number => c != null);
      const volumes = rawV.filter((v): v is number => v != null);

      if (closes.length < 10) throw new Error(`${ticker}: insufficient`);

      const n = closes.length;
      const price = closes[n - 1];
      const ago = (d: number) => closes[Math.max(0, n - d - 1)];

      // Simple RSI(14)
      let gains = 0, losses = 0;
      for (let i = Math.max(1, n - 15); i < n; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

      const avgVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;

      return {
        ticker, price,
        change1d: pct(price, ago(1)),
        change1w: pct(price, ago(5)),
        change1m: pct(price, ago(21)),
        change3m: pct(price, ago(63)),
        rsi: Math.round(rsi * 10) / 10,
        volume: Math.round(avgVol),
      };
    })
  );

  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ticker: tickers[i], price: 0, change1d: 0, change1w: 0, change1m: 0, change3m: 0, rsi: null, volume: 0, error: true }
  );
}

function aggregateSector(sector: SectorDef, tickers: TickerPerf[]): SectorPerf {
  const valid = tickers.filter(t => !t.error);
  if (!valid.length) {
    return { sector, tickers, avgChange1d: 0, avgChange1w: 0, avgChange1m: 0, avgChange3m: 0, avgRsi: null, topMover: null, worstMover: null, breadth: 0, validCount: 0 };
  }

  const avgChange1d = median(valid.map(t => t.change1d));
  const avgChange1w = median(valid.map(t => t.change1w));
  const avgChange1m = median(valid.map(t => t.change1m));
  const avgChange3m = median(valid.map(t => t.change3m));
  const rsisValid = valid.filter(t => t.rsi != null).map(t => t.rsi!);
  const avgRsi = rsisValid.length ? median(rsisValid) : null;

  const sorted1d = [...valid].sort((a, b) => b.change1d - a.change1d);
  const topMover = sorted1d[0] ?? null;
  const worstMover = sorted1d[sorted1d.length - 1] ?? null;
  const breadth = (valid.filter(t => t.change1d > 0).length / valid.length) * 100;

  return { sector, tickers, avgChange1d, avgChange1w, avgChange1m, avgChange3m, avgRsi, topMover, worstMover, breadth, validCount: valid.length };
}

export async function GET(_req: NextRequest) {
  try {
    // Fetch sectors in batches of 2 to avoid overwhelming Yahoo
    const sectorResults: SectorPerf[] = [];
    const batchSize = 2;

    for (let i = 0; i < VN_SECTORS.length; i += batchSize) {
      const batch = VN_SECTORS.slice(i, i + batchSize);
      const batchPerfs = await Promise.all(
        batch.map(async (sector) => {
          const tickers = await fetchBatch(sector.tickers);
          return aggregateSector(sector, tickers);
        })
      );
      sectorResults.push(...batchPerfs);
    }

    return NextResponse.json({
      sectors: sectorResults,
      fetchedAt: Date.now(),
    } satisfies SectorAnalysisResult);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
