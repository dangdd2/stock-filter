import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

export const runtime = 'nodejs';

export type EarningsTiming = 'amc' | 'bmo' | 'unknown';

export interface EarningsEntry {
  ticker: string;
  companyName: string | null;
  reportDate: string | null;
  timing: EarningsTiming;
  epsEstimate: number | null;
  epsActual: number | null;
  surprisePct: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  isUpcoming: boolean;
  hasData: boolean;
}

export interface EarningsResult {
  entries: EarningsEntry[];
  fetchedAt: number;
}

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const cache = new Map<string, { data: EarningsResult; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

async function fetchEarnings(ticker: string): Promise<EarningsEntry> {
  const symbol = `${ticker}.VN`;
  try {
    const summary = await yf.quoteSummary(symbol, {
      modules: ['calendarEvents', 'earningsTrend', 'price'],
    });

    const cal = summary.calendarEvents;
    const trend = summary.earningsTrend;
    const price = summary.price;

    const rawDate = cal?.earnings?.earningsDate?.[0];
    const reportDate = rawDate
      ? new Date(rawDate).toISOString().split('T')[0]
      : null;

    const today = new Date().toISOString().split('T')[0];
    const isUpcoming = reportDate ? reportDate >= today : false;

    // earningsTrend.trend is sorted: '0q' current qtr, '-1q' prev qtr, etc.
    const currentTrend = trend?.trend?.[0] ?? null;
    const epsEstimate = (currentTrend as Record<string, unknown> | null)?.['earningsEstimate'] != null
      ? ((currentTrend as Record<string, unknown>)['earningsEstimate'] as Record<string, number | null>)?.avg ?? null
      : null;
    const epsActual = (currentTrend as Record<string, unknown> | null)?.['actual'] as number | null ?? null;
    const revenueEstimate = (currentTrend as Record<string, unknown> | null)?.['revenueEstimate'] != null
      ? ((currentTrend as Record<string, unknown>)['revenueEstimate'] as Record<string, number | null>)?.avg ?? null
      : null;
    const revenueActual = (currentTrend as Record<string, unknown> | null)?.['revenueActual'] as number | null ?? null;

    const surprisePct =
      epsEstimate != null && epsActual != null && Math.abs(epsEstimate) > 0
        ? ((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100
        : null;

    const timingRaw = (cal as Record<string, unknown> | null | undefined)?.['earnings'] != null
      ? ((cal as Record<string, unknown>)['earnings'] as Record<string, unknown>)?.['earningsCallTimeMoment'] as string | null
      : null;
    const timing: EarningsTiming =
      timingRaw === 'amc' ? 'amc' : timingRaw === 'bmo' ? 'bmo' : 'unknown';

    const hasData = reportDate != null || epsEstimate != null || epsActual != null;

    return {
      ticker,
      companyName: price?.longName ?? price?.shortName ?? null,
      reportDate,
      timing,
      epsEstimate,
      epsActual,
      surprisePct,
      revenueEstimate,
      revenueActual,
      isUpcoming,
      hasData,
    };
  } catch {
    return {
      ticker,
      companyName: null,
      reportDate: null,
      timing: 'unknown',
      epsEstimate: null,
      epsActual: null,
      surprisePct: null,
      revenueEstimate: null,
      revenueActual: null,
      isUpcoming: false,
      hasData: false,
    };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickersParam = searchParams.get('tickers') ?? '';
  const tickers = tickersParam
    ? tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
    : [];

  if (!tickers.length) {
    return NextResponse.json({ entries: [], fetchedAt: Date.now() } satisfies EarningsResult);
  }

  const cacheKey = `earnings:${[...tickers].sort().join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const entries = await Promise.all(tickers.map(t => fetchEarnings(t)));

  const today = new Date().toISOString().split('T')[0];
  const upcoming = entries
    .filter(e => e.isUpcoming && e.reportDate)
    .sort((a, b) => a.reportDate!.localeCompare(b.reportDate!));
  const reported = entries
    .filter(e => !e.isUpcoming)
    .sort((a, b) => (b.reportDate ?? '').localeCompare(a.reportDate ?? ''));

  const result: EarningsResult = {
    entries: [...upcoming, ...reported],
    fetchedAt: Date.now(),
  };

  cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
  return NextResponse.json(result);
}
