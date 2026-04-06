import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface IncomeRow {
  date: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ebit: number | null;
}

export interface CashFlowRow {
  date: string;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;
}

export interface BalanceSheetRow {
  date: string;
  totalAssets: number | null;
  totalLiabilities: number | null;
  equity: number | null;
  cash: number | null;
  totalDebt: number | null;
  debtToEquity: number | null;
}

export interface FinancialPeriod {
  income: IncomeRow[];
  cashflow: CashFlowRow[];
  balance: BalanceSheetRow[];
}

export interface FinancialsData {
  annual: FinancialPeriod;
  quarterly: FinancialPeriod;
}

type AnyRecord = Record<string, unknown>;

function toDate(raw: unknown, quarterly: boolean): string {
  if (!raw) return '—';
  const d = raw instanceof Date ? raw : new Date(raw as string);
  if (isNaN(d.getTime())) return '—';
  if (!quarterly) return d.getFullYear().toString();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q} ${d.getFullYear()}`;
}

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const num = Number(v);
  return isNaN(num) ? null : num;
}

function mapIncome(statements: AnyRecord[], quarterly: boolean): IncomeRow[] {
  return statements.map((s) => ({
    date: toDate(s['endDate'], quarterly),
    revenue: n(s['totalRevenue']),
    grossProfit: n(s['grossProfit']),
    operatingIncome: n(s['operatingIncome']),
    netIncome: n(s['netIncome']),
    ebit: n(s['ebit']),
  }));
}

function mapCashflow(statements: AnyRecord[], quarterly: boolean): CashFlowRow[] {
  return statements.map((s) => {
    const op = n(s['totalCashFromOperatingActivities']);
    const cx = n(s['capitalExpenditures']);
    return {
      date: toDate(s['endDate'], quarterly),
      operatingCashFlow: op,
      capex: cx,
      freeCashFlow: op !== null && cx !== null ? op + cx : null,
      investingCashFlow: n(s['totalCashFromInvestingActivities']),
      financingCashFlow: n(s['totalCashFromFinancingActivities']),
    };
  });
}

function mapBalance(statements: AnyRecord[], quarterly: boolean): BalanceSheetRow[] {
  return statements.map((s) => {
    const eq = n(s['totalStockholderEquity']);
    const debt = n(s['totalDebt'] ?? s['shortLongTermDebt'] ?? s['longTermDebt']);
    return {
      date: toDate(s['endDate'], quarterly),
      totalAssets: n(s['totalAssets']),
      totalLiabilities: n(s['totalLiab']),
      equity: eq,
      cash: n(s['cash']),
      totalDebt: debt,
      debtToEquity: eq && debt ? debt / eq : null,
    };
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = `${ticker}.VN`;

  try {
    const summary = await yf.quoteSummary(symbol, {
      modules: [
        'incomeStatementHistory',
        'incomeStatementHistoryQuarterly',
        'cashflowStatementHistory',
        'cashflowStatementHistoryQuarterly',
        'balanceSheetHistory',
        'balanceSheetHistoryQuarterly',
      ],
    });

    const annual: FinancialPeriod = {
      income: mapIncome(
        (summary.incomeStatementHistory?.incomeStatementHistory ?? []) as unknown as AnyRecord[],
        false
      ),
      cashflow: mapCashflow(
        (summary.cashflowStatementHistory?.cashflowStatements ?? []) as unknown as AnyRecord[],
        false
      ),
      balance: mapBalance(
        (summary.balanceSheetHistory?.balanceSheetStatements ?? []) as unknown as AnyRecord[],
        false
      ),
    };

    const quarterly: FinancialPeriod = {
      income: mapIncome(
        (summary.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? []) as unknown as AnyRecord[],
        true
      ),
      cashflow: mapCashflow(
        (summary.cashflowStatementHistoryQuarterly?.cashflowStatements ?? []) as unknown as AnyRecord[],
        true
      ),
      balance: mapBalance(
        (summary.balanceSheetHistoryQuarterly?.balanceSheetStatements ?? []) as unknown as AnyRecord[],
        true
      ),
    };

    return NextResponse.json({ annual, quarterly } satisfies FinancialsData);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch financials' },
      { status: 500 }
    );
  }
}
