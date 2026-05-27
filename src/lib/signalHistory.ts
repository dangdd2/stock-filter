// ─────────────────────────────────────────────────────────────
// Signal History & Backtesting — data layer
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vn_stock_signal_history';
const MAX_HISTORY = 1000;

export interface SignalLog {
  id: string;
  date: string;           // YYYY-MM-DD — day the signal was generated
  ticker: string;
  direction: 'BUY' | 'SELL';
  reasons: string[];      // e.g. ['RSI 28', 'Stoch 15', 'BB↓']
  convictionScore: number; // 1–3
  priceAtSignal: number;
  target: number | null;  // BB middle at signal time
  // Filled in on subsequent refreshes once enough days have elapsed
  price3d: number | null;
  price7d: number | null;
  price14d: number | null;
  return3d: number | null;  // % return vs priceAtSignal
  return7d: number | null;
  return14d: number | null;
  filledAt3d: string | null;
  filledAt7d: string | null;
  filledAt14d: string | null;
}

export interface SignalInput {
  ticker: string;
  direction: 'BUY' | 'SELL';
  reasons: string[];
  entry: number;
  target: number | null;
}

// ── localStorage helpers ────────────────────────────────────

export function loadSignalHistory(): SignalLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignalLog[]) : [];
  } catch {
    return [];
  }
}

export function saveSignalHistory(logs: SignalLog[]): void {
  if (typeof window === 'undefined') return;
  // Keep only most recent MAX_HISTORY entries to avoid bloating localStorage
  const trimmed = logs.length > MAX_HISTORY ? logs.slice(-MAX_HISTORY) : logs;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function clearSignalHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// ── Pure computation functions ──────────────────────────────

/**
 * Merge new signals into existing history.
 * Deduplication rule: only one entry per ticker+direction per calendar day.
 */
export function addNewSignals(
  existing: SignalLog[],
  inputs: SignalInput[],
  today: string,
): SignalLog[] {
  const todayKeys = new Set(
    existing
      .filter(l => l.date === today)
      .map(l => `${l.ticker}|${l.direction}`),
  );

  const newLogs: SignalLog[] = [];
  for (const input of inputs) {
    const key = `${input.ticker}|${input.direction}`;
    if (todayKeys.has(key)) continue;
    todayKeys.add(key);
    newLogs.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: today,
      ticker: input.ticker,
      direction: input.direction,
      reasons: input.reasons,
      convictionScore: Math.min(input.reasons.length, 3),
      priceAtSignal: input.entry,
      target: input.target,
      price3d: null,
      price7d: null,
      price14d: null,
      return3d: null,
      return7d: null,
      return14d: null,
      filledAt3d: null,
      filledAt7d: null,
      filledAt14d: null,
    });
  }

  return newLogs.length === 0 ? existing : [...existing, ...newLogs];
}

/**
 * For any unresolved signal log, fill in the price3d/7d/14d fields
 * if the required number of calendar days has elapsed and we have a
 * current price for that ticker.
 */
export function fillSignalPrices(
  logs: SignalLog[],
  priceMap: Map<string, number>,
): SignalLog[] {
  const today = new Date();
  let changed = false;

  const updated = logs.map(log => {
    const current = priceMap.get(log.ticker);
    if (current === undefined) return log;

    // Skip fully resolved entries
    if (log.price3d !== null && log.price7d !== null && log.price14d !== null) return log;

    const signalDate = new Date(log.date);
    const daysPassed = Math.floor(
      (today.getTime() - signalDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysPassed < 3) return log;

    const pct = (p: number) =>
      parseFloat((((p - log.priceAtSignal) / log.priceAtSignal) * 100).toFixed(2));

    const todayStr = today.toISOString().split('T')[0];
    const next = { ...log };

    if (daysPassed >= 3 && next.price3d === null) {
      next.price3d = current;
      next.return3d = pct(current);
      next.filledAt3d = todayStr;
      changed = true;
    }
    if (daysPassed >= 7 && next.price7d === null) {
      next.price7d = current;
      next.return7d = pct(current);
      next.filledAt7d = todayStr;
      changed = true;
    }
    if (daysPassed >= 14 && next.price14d === null) {
      next.price14d = current;
      next.return14d = pct(current);
      next.filledAt14d = todayStr;
      changed = true;
    }
    return next;
  });

  return changed ? updated : logs;
}

// ── Statistics ──────────────────────────────────────────────

export interface BacktestStats {
  total: number;
  resolved3d: number;
  resolved7d: number;
  resolved14d: number;
  winRate3d: number | null;   // %
  winRate7d: number | null;
  winRate14d: number | null;
  avgReturn3d: number | null; // %
  avgReturn7d: number | null;
  avgReturn14d: number | null;
  bestTicker: { ticker: string; return7d: number } | null;
  worstTicker: { ticker: string; return7d: number } | null;
  byConviction: Record<
    number,
    { total: number; resolved7d: number; wins7d: number; winRate7d: number | null }
  >;
}

function isWin(ret: number | null, dir: 'BUY' | 'SELL'): boolean {
  if (ret === null) return false;
  return dir === 'BUY' ? ret > 0 : ret < 0;
}

export function computeStats(
  logs: SignalLog[],
  direction: 'BUY' | 'SELL' | 'ALL',
): BacktestStats {
  const filtered =
    direction === 'ALL' ? logs : logs.filter(l => l.direction === direction);

  const total = filtered.length;
  const with3d = filtered.filter(l => l.return3d !== null);
  const with7d = filtered.filter(l => l.return7d !== null);
  const with14d = filtered.filter(l => l.return14d !== null);

  const winRate = (group: SignalLog[], retKey: 'return3d' | 'return7d' | 'return14d') => {
    if (group.length === 0) return null;
    const wins = group.filter(l => isWin(l[retKey], l.direction)).length;
    return parseFloat(((wins / group.length) * 100).toFixed(1));
  };

  const avgRet = (group: SignalLog[], retKey: 'return3d' | 'return7d' | 'return14d') => {
    if (group.length === 0) return null;
    const sum = group.reduce((acc, l) => acc + (l[retKey] ?? 0), 0);
    return parseFloat((sum / group.length).toFixed(2));
  };

  // Best / worst by 7d return (among resolved)
  let bestTicker: BacktestStats['bestTicker'] = null;
  let worstTicker: BacktestStats['worstTicker'] = null;
  if (with7d.length > 0) {
    // For BUY: highest return7d is best; for SELL: most negative is best
    const sorted = [...with7d].sort((a, b) => (b.return7d ?? 0) - (a.return7d ?? 0));
    bestTicker = { ticker: sorted[0].ticker, return7d: sorted[0].return7d! };
    worstTicker = { ticker: sorted[sorted.length - 1].ticker, return7d: sorted[sorted.length - 1].return7d! };
  }

  const byConviction: BacktestStats['byConviction'] = {};
  for (const score of [1, 2, 3]) {
    const group = filtered.filter(l => l.convictionScore === score);
    const resolved = group.filter(l => l.return7d !== null);
    const wins = resolved.filter(l => isWin(l.return7d, l.direction)).length;
    byConviction[score] = {
      total: group.length,
      resolved7d: resolved.length,
      wins7d: wins,
      winRate7d:
        resolved.length > 0
          ? parseFloat(((wins / resolved.length) * 100).toFixed(1))
          : null,
    };
  }

  return {
    total,
    resolved3d: with3d.length,
    resolved7d: with7d.length,
    resolved14d: with14d.length,
    winRate3d: winRate(with3d, 'return3d'),
    winRate7d: winRate(with7d, 'return7d'),
    winRate14d: winRate(with14d, 'return14d'),
    avgReturn3d: avgRet(with3d, 'return3d'),
    avgReturn7d: avgRet(with7d, 'return7d'),
    avgReturn14d: avgRet(with14d, 'return14d'),
    bestTicker,
    worstTicker,
    byConviction,
  };
}
