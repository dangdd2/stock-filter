import { NextResponse } from 'next/server';

export const revalidate = 0;

export interface IndexData {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  prevClose: number | null;
  ytdPct: number | null;
  closes30d: number[];
}

export interface MoverStock {
  ticker: string;
  price: number;
  changePct: number;
  change: number;
  volume: number;
}

export interface BreadthData {
  advance: number;
  decline: number;
  unchanged: number;
  total: number;
  advanceRatio: number;
}

export interface MarketOverviewResult {
  indices: IndexData[];
  topGainers: MoverStock[];
  topLosers: MoverStock[];
  breadth: BreadthData;
  fetchedAt: number;
}

// Index symbols on Yahoo Finance
const INDEX_DEFS = [
  { symbol: '^VNINDEX', name: 'VN-Index',  shortName: 'VNINDEX' },
  { symbol: '^HNX30',   name: 'HNX-Index', shortName: 'HNX'     },
  { symbol: '^UPCOM',   name: 'UPCOM',     shortName: 'UPCOM'   },
];

// Representative liquid stocks for breadth calculation (HOSE blue chips + mid caps)
const BREADTH_TICKERS = [
  'VCB','BID','CTG','TCB','MBB','VPB','ACB','HDB','STB','LPB',
  'VHM','VIC','VRE','MSN','MWG','FPT','HPG','GVR','SAB','PLX',
  'VNM','POW','GAS','PVD','PVS','VJC','HVN','ACV','REE','PNJ',
  'DGC','DCM','DPM','GMD','HAH','VGI','CTR','FOX','BCM','KDH',
  'PDR','NVL','DXG','NLG','HDG','HSG','NKG','TLH','VGS','SMC',
];

async function fetchIndexData(symbol: string, name: string): Promise<IndexData> {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1y`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error('no result');

    const meta = result.meta;
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const closes = rawCloses.filter((c): c is number => c != null);

    const price      = meta.regularMarketPrice ?? null;
    const prevClose  = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change     = price != null && prevClose != null ? price - prevClose : null;
    const changePct  = change != null && prevClose ? (change / prevClose) * 100 : null;
    const volume     = meta.regularMarketVolume ?? null;
    const high       = meta.regularMarketDayHigh ?? null;
    const low        = meta.regularMarketDayLow  ?? null;
    const open       = meta.regularMarketOpen    ?? null;

    // YTD: compare current vs first close of this year
    const timestamps: number[] = result.timestamp || [];
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
    let ytdPct: number | null = null;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] >= yearStart && rawCloses[i] != null) {
        const firstClose = rawCloses[i] as number;
        if (firstClose && price != null) {
          ytdPct = ((price - firstClose) / firstClose) * 100;
        }
        break;
      }
    }

    const closes30d = closes.slice(-30);

    return { symbol, name, price, change, changePct, volume, high, low, open, prevClose, ytdPct, closes30d };
  } catch {
    return { symbol, name, price: null, change: null, changePct: null, volume: null, high: null, low: null, open: null, prevClose: null, ytdPct: null, closes30d: [] };
  }
}

async function fetchMoverData(ticker: string): Promise<MoverStock | null> {
  const symbol = `${ticker}.VN`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price     = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose;
    const volume    = meta.regularMarketVolume ?? 0;
    if (!price || !prevClose) return null;

    const change    = price - prevClose;
    const changePct = (change / prevClose) * 100;

    return { ticker, price, change, changePct, volume };
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    // 1. Fetch indices in parallel
    const indicesRaw = await Promise.all(
      INDEX_DEFS.map(d => fetchIndexData(d.symbol, d.name))
    );

    // 2. Fetch movers (batch with concurrency limit)
    const CHUNK = 10;
    const allMovers: MoverStock[] = [];
    for (let i = 0; i < BREADTH_TICKERS.length; i += CHUNK) {
      const chunk = BREADTH_TICKERS.slice(i, i + CHUNK);
      const results = await Promise.allSettled(chunk.map(fetchMoverData));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) allMovers.push(r.value);
      }
    }

    // 3. Top gainers / losers (top 5 each)
    const sorted = [...allMovers].sort((a, b) => b.changePct - a.changePct);
    const topGainers = sorted.slice(0, 5);
    const topLosers  = sorted.slice(-5).reverse();

    // 4. Breadth
    let advance = 0, decline = 0, unchanged = 0;
    for (const m of allMovers) {
      if (m.changePct > 0.05)       advance++;
      else if (m.changePct < -0.05) decline++;
      else                          unchanged++;
    }
    const total = allMovers.length;
    const breadth: BreadthData = {
      advance, decline, unchanged, total,
      advanceRatio: total > 0 ? (advance / total) * 100 : 50,
    };

    return NextResponse.json({
      indices: indicesRaw,
      topGainers,
      topLosers,
      breadth,
      fetchedAt: Date.now(),
    } satisfies MarketOverviewResult);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
