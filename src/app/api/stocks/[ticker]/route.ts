import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;   // ISO string
  thumbnail?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // -1 to +1
  relevance: 'high' | 'medium' | 'low';
}

// ── In-memory cache ──────────────────────────────────────────
const cache = new Map<string, { items: NewsItem[]; expiresAt: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function isVietnamese(text: string): boolean {
  // Vietnamese has unique diacritics not found in English
  return /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(text);
}

function isRelevantVNNews(item: NewsItem, ticker: string): boolean {
  const source = item.source.toLowerCase();
  const title  = item.title;
  const desc   = item.description;

  // Must have Vietnamese characters in title or description
  if (!isVietnamese(title) && !isVietnamese(desc)) return false;

  // Block known foreign English sources regardless
  const BLOCKED = ['simply wall st','motley fool','seeking alpha','marketwatch',
    'reuters','bloomberg','thestreet','benzinga','zacks','barron',
    'globenewswire','pr newswire','business wire','mt newswire','accesswire'];
  if (BLOCKED.some(b => source.includes(b))) return false;

  return true;
}

const POSITIVE_KW = [
  'tăng','tăng mạnh','bứt phá','đột biến','kỷ lục','lợi nhuận','doanh thu',
  'phục hồi','tích cực','khởi sắc','vượt','đỉnh','mua vào','nâng mục tiêu',
  'khuyến nghị mua','outperform','upside','bullish','tăng trưởng','mở rộng',
  'hợp đồng mới','ký kết','thắng thầu','cổ tức','chia thưởng','đặt cọc',
];
const NEGATIVE_KW = [
  'giảm','lao dốc','sụt giảm','thua lỗ','âm','xấu','tiêu cực','bán ra',
  'nâng cảnh báo','hạ mục tiêu','downgrade','downside','bearish','rủi ro',
  'nợ xấu','vi phạm','bị phạt','đình chỉ','kiểm toán','sai phạm','xử lý',
  'tranh chấp','kiện','thoái vốn','thu hẹp','cắt giảm','chậm trả',
];

function analyzeSentiment(text: string): { sentiment: NewsItem['sentiment']; sentimentScore: number } {
  const t = text.toLowerCase();
  let score = 0;
  POSITIVE_KW.forEach(kw => { if (t.includes(kw)) score += 1; });
  NEGATIVE_KW.forEach(kw => { if (t.includes(kw)) score -= 1; });
  const norm = Math.max(-1, Math.min(1, score / 3));
  return {
    sentiment: norm > 0.15 ? 'positive' : norm < -0.15 ? 'negative' : 'neutral',
    sentimentScore: parseFloat(norm.toFixed(2)),
  };
}

// ── Yahoo Finance news ────────────────────────────────────────
async function fetchYahooNews(ticker: string): Promise<NewsItem[]> {
  const symbol = `${ticker}.VN`;
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=20&quotesCount=0&enableFuzzyQuery=false&enableEnhancedTrivialQuery=true`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const newsArr = data?.news ?? [];
  return newsArr.slice(0, 15).map((n: Record<string, unknown>, i: number) => {
    const title = String(n.title ?? '');
    const desc  = String(n.summary ?? title);
    const { sentiment, sentimentScore } = analyzeSentiment(title + ' ' + desc);
    return {
      id: String(n.uuid ?? i),
      title,
      description: desc.slice(0, 200),
      url: String(n.link ?? '#'),
      source: String(n.publisher ?? 'Yahoo Finance'),
      publishedAt: n.providerPublishTime
        ? new Date(Number(n.providerPublishTime) * 1000).toISOString()
        : new Date().toISOString(),
      thumbnail: (n.thumbnail as Record<string, unknown>)?.resolutions
        ? String(((n.thumbnail as Record<string, { url: string }[]>).resolutions?.[0])?.url ?? '')
        : undefined,
      sentiment,
      sentimentScore,
      relevance: 'high' as const,
    };
  });
}

// ── Google News RSS ───────────────────────────────────────────
async function fetchGoogleNews(ticker: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(`${ticker} cổ phiếu chứng khoán`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=vi&gl=VN&ceid=VN:vi`;
  const res = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const xml  = await res.text();
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
  return items.slice(0, 10).map((item, i) => {
    const title     = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? '';
    const link      = item.match(/<link>(.*?)<\/link>/)?.[1] ?? '#';
    const pubDate   = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
    const source    = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? 'Google News';
    const desc      = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ?? item.match(/<description>(.*?)<\/description>/))?.[1] ?? title;
    const cleanDesc = desc.replace(/<[^>]+>/g, '').slice(0, 200);
    const { sentiment, sentimentScore } = analyzeSentiment(title + ' ' + cleanDesc);
    return {
      id: `gn-${i}-${Date.now()}`,
      title: title.replace(/<[^>]+>/g, '').trim(),
      description: cleanDesc,
      url: link,
      source,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      sentiment,
      sentimentScore,
      relevance: 'medium' as const,
    };
  });
}

// ── Route handler ─────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const key = ticker.toUpperCase();

  // Cache hit
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.items, {
      headers: { 'X-Cache': 'HIT', 'X-Cache-Expires': String(cached.expiresAt) },
    });
  }

  // Fetch from both sources in parallel
  const [yahoo, google] = await Promise.allSettled([
    fetchYahooNews(key),
    fetchGoogleNews(key),
  ]);

  const yahooItems  = yahoo.status  === 'fulfilled' ? yahoo.value  : [];
  const googleItems = google.status === 'fulfilled' ? google.value : [];

  // Deduplicate by title similarity, prefer Yahoo items
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of [...yahooItems, ...googleItems]) {
    const key2 = item.title.slice(0, 40).toLowerCase();
    if (!seen.has(key2) && isRelevantVNNews(item, key)) {
      seen.add(key2);
      merged.push(item);
    }
  }

  // Sort by publishedAt desc
  merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const final = merged.slice(0, 20);

  cache.set(key, { items: final, expiresAt: Date.now() + CACHE_TTL });
  return NextResponse.json(final, { headers: { 'X-Cache': 'MISS' } });
}