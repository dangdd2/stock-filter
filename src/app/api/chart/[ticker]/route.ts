import { NextRequest, NextResponse } from 'next/server';
import { fetchStockChartData } from '@/lib/stockApi';

export const runtime = 'nodejs';

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const key = ticker.toUpperCase();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json(hit.data, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const data = await fetchStockChartData(key);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
    return NextResponse.json(data, { headers: { 'X-Cache': 'MISS' } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
