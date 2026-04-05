import { NextResponse } from 'next/server';
import { fetchStockChartData } from '@/lib/stockApi';

export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params;
    const { ticker } = resolvedParams;
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }
    const data = await fetchStockChartData(ticker.toUpperCase());
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
