import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export type TransactionType = 'buy' | 'sell' | 'register_buy' | 'register_sell' | 'result_buy' | 'result_sell' | 'unknown';
export type PersonType = 'director' | 'cfo' | 'chairman' | 'board' | 'major_shareholder' | 'related' | 'unknown';
export type SignalStrength = 'strong' | 'medium' | 'weak';

export interface InsiderTransaction {
  id: string;
  ticker: string;
  personName: string;
  personTitle: string;
  personType: PersonType;
  transactionType: TransactionType;
  // Quantities (may be null if not parseable)
  plannedQty: number | null;
  executedQty: number | null;
  ownedAfter: number | null;
  // Price context
  priceAtDisclosure: number | null;
  priceNow: number | null;
  priceChangeSince: number | null;   // % change since disclosure date
  // Metadata
  disclosureDate: string;            // ISO
  effectiveDateStart: string | null;
  effectiveDateEnd: string | null;
  source: string;
  sourceUrl: string;
  rawTitle: string;
  // Analysis
  signalStrength: SignalStrength;
  signalNote: string;
  isLargeDeal: boolean;              // > 1% charter capital or > 1B VND estimated
}

export interface InsiderSummary {
  ticker: string;
  recentBuyQty: number;
  recentSellQty: number;
  netSentiment: 'bullish' | 'bearish' | 'neutral';
  largeDealCount: number;
  lastActivity: string | null;
}

export interface InsiderResult {
  transactions: InsiderTransaction[];
  summaries: Record<string, InsiderSummary>;
  fetchedAt: number;
}

// ─── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: InsiderResult; expiresAt: number }>();
const CACHE_TTL = 20 * 60 * 1000; // 20 min

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractNumber(text: string): number | null {
  // Match Vietnamese number formats: 1.000.000 or 1,000,000 or 1000000
  const match = text.match(/[\d.,]+/);
  if (!match) return null;
  const n = parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function extractTicker(text: string): string | null {
  // Match stock code in parens, after colon, or standalone 2-4 uppercase letters
  const patterns = [
    /\(([A-Z]{2,4})\)/,           // (VNM)
    /mã\s+([A-Z]{2,4})\b/i,       // mã VNM
    /cổ phiếu\s+([A-Z]{2,4})\b/i, // cổ phiếu VNM
    /\b([A-Z]{2,4})\s*[-:]/,      // VNM:
    /^([A-Z]{2,4})\s+/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function classifyPerson(title: string): PersonType {
  const t = title.toLowerCase();
  if (t.includes('chủ tịch') || t.includes('chairman')) return 'chairman';
  if (t.includes('tổng giám đốc') || t.includes('ceo') || t.includes('giám đốc điều hành')) return 'director';
  if (t.includes('giám đốc tài chính') || t.includes('cfo') || t.includes('kế toán trưởng')) return 'cfo';
  if (t.includes('thành viên hđqt') || t.includes('hội đồng quản trị') || t.includes('board')) return 'board';
  if (t.includes('cổ đông lớn') || t.includes('cổ đông nội bộ') || t.includes('shareholder')) return 'major_shareholder';
  if (t.includes('người liên quan') || t.includes('vợ') || t.includes('chồng') || t.includes('con')) return 'related';
  return 'unknown';
}

function classifyTransaction(title: string): TransactionType {
  const t = title.toLowerCase();
  if (t.includes('kết quả') && (t.includes('mua') || t.includes('đã mua'))) return 'result_buy';
  if (t.includes('kết quả') && (t.includes('bán') || t.includes('đã bán'))) return 'result_sell';
  if (t.includes('đăng ký mua') || t.includes('dự kiến mua')) return 'register_buy';
  if (t.includes('đăng ký bán') || t.includes('dự kiến bán')) return 'register_sell';
  if (t.includes('mua vào') || t.includes(' mua ') || t.includes('tăng sở hữu')) return 'buy';
  if (t.includes('bán ra') || t.includes(' bán ') || t.includes('giảm sở hữu')) return 'sell';
  return 'unknown';
}

function extractPersonInfo(titleText: string, description: string): { name: string; title: string } {
  const combined = `${titleText} ${description}`;
  // Common patterns: "Ông/Bà [Name] - [Title]" or "[Title] [Name]"
  const namePatterns = [
    /(?:ông|bà|anh|chị)\s+([A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂƠƯ][a-zđàáâãèéêìíòóôõùúýăơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]+(?:\s+[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂƠƯ][a-zđàáâãèéêìíòóôõùúýăơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]+){1,4})/i,
  ];
  let name = 'Người nội bộ';
  for (const p of namePatterns) {
    const m = combined.match(p);
    if (m?.[1]) { name = m[1]; break; }
  }

  const titlePatterns = [
    /(chủ tịch hội đồng quản trị)/i,
    /(tổng giám đốc)/i,
    /(giám đốc điều hành)/i,
    /(giám đốc tài chính)/i,
    /(kế toán trưởng)/i,
    /(thành viên hội đồng quản trị)/i,
    /(thành viên hđqt)/i,
    /(phó tổng giám đốc)/i,
    /(cổ đông lớn)/i,
    /(người liên quan)/i,
    /(phó chủ tịch)/i,
  ];
  let title = 'Lãnh đạo';
  for (const p of titlePatterns) {
    const m = combined.match(p);
    if (m?.[1]) { title = m[1]; break; }
  }
  return { name, title };
}

function parseQuantityFromText(text: string): { planned: number | null; executed: number | null } {
  const numPatterns = [
    /đăng ký\s+(?:mua|bán)\s+([\d.,]+)\s*(?:cổ phiếu|cp|cổ phần)/i,
    /(?:mua|bán)\s+([\d.,]+)\s*(?:cổ phiếu|cp|cổ phần)/i,
    /([\d.,]+)\s*(?:cổ phiếu|cp|cổ phần)/i,
  ];
  let planned: number | null = null;
  let executed: number | null = null;
  for (const p of numPatterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(v)) { planned = v; break; }
    }
  }
  // If "kết quả" in text, executed = planned
  if (text.toLowerCase().includes('kết quả')) executed = planned;
  return { planned, executed };
}

function computeSignal(txType: TransactionType, personType: PersonType, qty: number | null): { strength: SignalStrength; note: string; isLarge: boolean } {
  const isLarge = qty != null && qty >= 100000;
  const isBuy = ['buy', 'result_buy', 'register_buy'].includes(txType);
  const isSell = ['sell', 'result_sell', 'register_sell'].includes(txType);
  const isHighRank = ['chairman', 'director', 'cfo'].includes(personType);
  const isResult = ['result_buy', 'result_sell'].includes(txType);

  let strength: SignalStrength = 'weak';
  let note = '';

  if (isBuy) {
    if (isResult && isHighRank && isLarge) { strength = 'strong'; note = '✅ Lãnh đạo cấp cao đã hoàn tất mua lớn — tín hiệu tích cực mạnh'; }
    else if (isResult && isLarge) { strength = 'medium'; note = '🟡 Giao dịch mua hoàn tất số lượng lớn'; }
    else if (isHighRank) { strength = 'medium'; note = '🟡 Lãnh đạo cấp cao đăng ký mua'; }
    else { strength = 'weak'; note = '⬜ Đăng ký mua, chờ kết quả thực tế'; }
  } else if (isSell) {
    if (isResult && isHighRank && isLarge) { strength = 'strong'; note = '🔴 Lãnh đạo cấp cao đã hoàn tất bán lớn — cẩn trọng'; }
    else if (isResult && isLarge) { strength = 'medium'; note = '🟠 Giao dịch bán hoàn tất số lượng lớn'; }
    else if (isHighRank) { strength = 'medium'; note = '🟠 Lãnh đạo cấp cao đăng ký bán'; }
    else { strength = 'weak'; note = '⬜ Đăng ký bán, chưa hoàn tất'; }
  } else {
    note = '⬜ Thông báo giao dịch nội bộ';
  }

  return { strength, note, isLarge };
}

// ─── RSS fetch & parse ─────────────────────────────────────────────────────────
async function fetchInsiderRSS(query: string): Promise<Array<{ title: string; description: string; pubDate: string; link: string; source: string }>> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=vi&gl=VN&ceid=VN:vi`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: Array<{ title: string; description: string; pubDate: string; link: string; source: string }> = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const item = match[1];
      const title       = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
                       ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
      const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
                       ?? item.match(/<description>(.*?)<\/description>/)?.[1] ?? '';
      const pubDate     = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
      const link        = item.match(/<link>(.*?)<\/link>/)?.[1]
                       ?? item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ?? '';
      const source      = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? 'Google News';
      if (title) items.push({ title, description, pubDate, link, source });
    }
    return items.slice(0, 30);
  } catch { return []; }
}

// ─── Price fetch for context ───────────────────────────────────────────────────
async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.VN?interval=1d&range=5d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c: number | null) => c != null);
    return valid.length ? valid[valid.length - 1] : null;
  } catch { return null; }
}

// ─── Parse RSS items into InsiderTransaction ───────────────────────────────────
function parseRSSItems(
  items: Array<{ title: string; description: string; pubDate: string; link: string; source: string }>,
  targetTickers: string[]
): InsiderTransaction[] {
  const results: InsiderTransaction[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const combined = `${item.title} ${item.description}`;

    // Must contain insider-related keywords
    const insiderKw = ['giao dịch nội bộ', 'nội bộ', 'cổ đông nội bộ', 'người nội bộ',
      'đăng ký mua', 'đăng ký bán', 'kết quả giao dịch', 'thông báo giao dịch'];
    if (!insiderKw.some(kw => combined.toLowerCase().includes(kw))) continue;

    // Extract or match ticker
    let ticker = extractTicker(item.title) ?? extractTicker(item.description);
    if (!ticker && targetTickers.length > 0) {
      ticker = targetTickers.find(t => combined.toUpperCase().includes(t)) ?? null;
    }
    if (!ticker) continue;

    const txType = classifyTransaction(combined);
    const { name, title } = extractPersonInfo(item.title, item.description);
    const personType = classifyPerson(title);
    const { planned, executed } = parseQuantityFromText(combined);
    const { strength, note, isLarge } = computeSignal(txType, personType, planned ?? executed);

    const id = `${ticker}-${item.pubDate}-${name}`.replace(/\s+/g, '-').slice(0, 60);
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    results.push({
      id,
      ticker,
      personName: name,
      personTitle: title,
      personType,
      transactionType: txType,
      plannedQty: planned,
      executedQty: executed,
      ownedAfter: null,
      priceAtDisclosure: null,
      priceNow: null,
      priceChangeSince: null,
      disclosureDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      effectiveDateStart: null,
      effectiveDateEnd: null,
      source: item.source,
      sourceUrl: item.link,
      rawTitle: item.title,
      signalStrength: strength,
      signalNote: note,
      isLargeDeal: isLarge,
    });
  }

  return results;
}

// ─── Build summaries ───────────────────────────────────────────────────────────
function buildSummaries(transactions: InsiderTransaction[]): Record<string, InsiderSummary> {
  const map: Record<string, InsiderSummary> = {};
  for (const tx of transactions) {
    if (!map[tx.ticker]) {
      map[tx.ticker] = { ticker: tx.ticker, recentBuyQty: 0, recentSellQty: 0, netSentiment: 'neutral', largeDealCount: 0, lastActivity: null };
    }
    const s = map[tx.ticker];
    const qty = tx.executedQty ?? tx.plannedQty ?? 0;
    if (['buy', 'result_buy', 'register_buy'].includes(tx.transactionType)) s.recentBuyQty += qty;
    if (['sell', 'result_sell', 'register_sell'].includes(tx.transactionType)) s.recentSellQty += qty;
    if (tx.isLargeDeal) s.largeDealCount++;
    if (!s.lastActivity || tx.disclosureDate > s.lastActivity) s.lastActivity = tx.disclosureDate;
  }
  for (const s of Object.values(map)) {
    if (s.recentBuyQty > s.recentSellQty * 1.5) s.netSentiment = 'bullish';
    else if (s.recentSellQty > s.recentBuyQty * 1.5) s.netSentiment = 'bearish';
    else s.netSentiment = 'neutral';
  }
  return map;
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickersParam = searchParams.get('tickers') ?? '';
  const tickers = tickersParam ? tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean) : [];

  const cacheKey = `insider:${tickers.sort().join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch RSS for general + ticker-specific insider news
    const queries = [
      'giao dịch nội bộ cổ phiếu HOSE HNX',
      'đăng ký mua bán cổ phiếu người nội bộ',
      'kết quả giao dịch cổ phiếu lãnh đạo',
    ];
    if (tickers.length > 0) {
      queries.push(...tickers.slice(0, 3).map(t => `giao dịch nội bộ ${t} cổ phiếu`));
    }

    const rssResults = await Promise.all(queries.map(q => fetchInsiderRSS(q)));
    const allItems = rssResults.flat();

    // Deduplicate by title
    const seen = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      const key = item.title.slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let transactions = parseRSSItems(uniqueItems, tickers);

    // Filter to target tickers if specified
    if (tickers.length > 0) {
      transactions = transactions.filter(t => tickers.includes(t.ticker));
    }

    // Sort by date desc
    transactions.sort((a, b) => new Date(b.disclosureDate).getTime() - new Date(a.disclosureDate).getTime());
    transactions = transactions.slice(0, 50);

    // Enrich with current price for tickers we have
    const uniqueTickers = [...new Set(transactions.map(t => t.ticker))].slice(0, 8);
    const priceMap: Record<string, number | null> = {};
    await Promise.all(uniqueTickers.map(async t => {
      priceMap[t] = await fetchCurrentPrice(t);
    }));
    for (const tx of transactions) {
      tx.priceNow = priceMap[tx.ticker] ?? null;
    }

    const summaries = buildSummaries(transactions);
    const result: InsiderResult = { transactions, summaries, fetchedAt: Date.now() };

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
