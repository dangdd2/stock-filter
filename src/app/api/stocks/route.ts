import { NextResponse } from 'next/server';
import { fetchTickersIndicators } from '@/lib/stockApi';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tickersParam = searchParams.get('tickers');
    const tickers = tickersParam ? tickersParam.split(',').filter(t => t.trim() !== '') : [];

    if (tickers.length === 0) {
      return NextResponse.json([]);
    }

    const data = await fetchTickersIndicators(tickers);
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
