import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceName: string;
  publishedAt: string;
  relativeTime: string;
  category: 'market' | 'stock' | 'macro' | 'world';
  ticker?: string;
}

// Direct RSS feeds — fetched straight from each publisher (no Google News proxy delay).
// Each publisher updates these feeds in near-realtime (TTL 5-15 min), much faster than
// waiting for Google News to crawl/index the article.
const RSS_FEEDS: Array<{
  key: string;
  name: string;
  feeds: Array<{ url: string; category: NewsArticle['category'] }>;
}> = [
  {
    key: 'cafef', name: 'CafeF',
    feeds: [
      { url: 'https://cafef.vn/thi-truong-chung-khoan.rss', category: 'stock'  },
      { url: 'https://cafef.vn/tai-chinh-ngan-hang.rss',     category: 'market' },
      { url: 'https://cafef.vn/vi-mo-dau-tu.rss',            category: 'macro'  },
    ],
  },
  {
    key: 'vietstock', name: 'Vietstock',
    feeds: [
      { url: 'https://vietstock.vn/830/chung-khoan/co-phieu.rss/', category: 'stock'  },
    ],
  },
  {
    key: 'tinnhanhchungkhoan', name: 'Tin Nhanh CK',
    feeds: [
      { url: 'https://www.tinnhanhchungkhoan.vn/chung-khoan.rss', category: 'stock'  },
      { url: 'https://www.tinnhanhchungkhoan.vn/thi-truong.rss',  category: 'market' },
    ],
  },
  {
    key: 'baodautu', name: 'Báo Đầu Tư',
    feeds: [
      { url: 'https://baodautu.vn/rss/chung-khoan.rss',   category: 'stock'  },
      { url: 'https://baodautu.vn/rss/tin-moi-nhat.rss',  category: 'market' },
    ],
  },
  {
    key: 'stockbiz', name: 'StockBiz',
    feeds: [
      { url: 'https://stockbiz.vn/rss/news.rss',   category: 'stock' },
      { url: 'https://stockbiz.vn/rss/market.rss', category: 'market' },
    ],
  },
  {
    key: 'vneconomy', name: 'VNEconomy',
    feeds: [
      { url: 'https://vneconomy.vn/chung-khoan.rss', category: 'stock' },
    ],
  },
  {
    key: 'vnbusiness', name: 'VnBusiness',
    feeds: [
      { url: 'https://vnbusiness.vn/rss/chung-khoan.rss', category: 'stock'  },
    ],
  },
];

function relativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Vừa xong';
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24);
    return `${d} ngày trước`;
  } catch { return ''; }
}

const IGNORE_TICKERS = new Set(['RSS','USD','VND','IPO','ETF','GDP','CPI','PPI','FED','IMF','WTO','SEC','PE','EPS','NAV','ROE','ROA','VN','DN','CP','CT','TT','HN','TP','PT','TP.HCM','HOSE','HNX']);

function extractTicker(title: string): string | undefined {
  const m = title.match(/\b([A-Z]{2,4})\b/g);
  return m?.find(t => !IGNORE_TICKERS.has(t) && t.length >= 2 && t.length <= 4);
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/<[^>]+>/g, '');
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return (m?.[1] || m?.[2] || '').trim();
}

async function fetchRSSFeed(
  url: string,
  category: NewsArticle['category'],
  sourceKey: string,
  sourceName: string,
): Promise<NewsArticle[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml,application/xml,text/xml,*/*',
        'Accept-Language': 'vi-VN,vi;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const text = await res.text();

    const items: NewsArticle[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;

    while ((m = itemRegex.exec(text)) !== null && items.length < 30) {
      const block = m[1];
      const title   = decodeEntities(extractTag(block, 'title'));
      const link    = extractTag(block, 'link') || extractTag(block, 'guid');
      const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');

      if (!title || !link) continue;

      const published = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
      items.push({
        id: `${sourceKey}_${Buffer.from(link).toString('base64url')}`,
        title: title.trim(),
        url: link.trim(),
        source: sourceKey,
        sourceName,
        publishedAt: published,
        relativeTime: relativeTime(published),
        category,
        ticker: extractTicker(title),
      });
    }
    return items;
  } catch { return []; }
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const categoryFilter = searchParams.get('category') ?? 'all';
  const search         = (searchParams.get('q') ?? '').toLowerCase();

  const tasks: Promise<NewsArticle[]>[] = RSS_FEEDS.flatMap(src =>
    src.feeds.map(({ url, category }) => fetchRSSFeed(url, category, src.key, src.name))
  );

  const results = await Promise.allSettled(tasks);
  const all: NewsArticle[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate by title prefix
  const seenTitles = new Set<string>();
  const dedupedByTitle = all.filter(a => {
    const k = a.title.slice(0, 50).toLowerCase();
    if (seenTitles.has(k)) return false;
    seenTitles.add(k);
    return true;
  });

  // Safety dedupe by id
  const seenIds = new Set<string>();
  const deduped = dedupedByTitle.filter(a => {
    if (seenIds.has(a.id)) return false;
    seenIds.add(a.id);
    return true;
  });

  // Apply filters
  const filtered = deduped.filter(a => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (search && !a.title.toLowerCase().includes(search) && !(a.ticker?.toLowerCase() === search)) return false;
    return true;
  });

  filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return NextResponse.json({ articles: filtered.slice(0, 100), fetchedAt: Date.now() });
}
