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

// Google News RSS queries per source — proven to work (used by InsiderTracker)
const SOURCE_QUERIES: Array<{
  key: string;
  name: string;
  queries: Array<{ q: string; category: NewsArticle['category'] }>;
}> = [
  {
    key: 'cafef', name: 'CafeF',
    queries: [
      { q: 'chứng khoán site:cafef.vn',       category: 'stock'  },
      { q: 'thị trường site:cafef.vn',         category: 'market' },
    ],
  },
  {
    key: 'vietstock', name: 'Vietstock',
    queries: [
      { q: 'cổ phiếu site:vietstock.vn',       category: 'stock'  },
      { q: 'thị trường site:vietstock.vn',      category: 'market' },
    ],
  },
  {
    key: 'tinnhanhchungkhoan', name: 'Tin Nhanh CK',
    queries: [
      { q: 'site:tinnhanhchungkhoan.vn chứng khoán', category: 'stock'  },
      { q: 'site:tinnhanhchungkhoan.vn thị trường',  category: 'market' },
    ],
  },
  {
    key: 'vneconomy', name: 'VNEconomy',
    queries: [
      { q: 'chứng khoán site:vneconomy.vn',    category: 'stock'  },
      { q: 'kinh tế site:vneconomy.vn',        category: 'macro'  },
    ],
  },
  {
    key: 'stockbiz', name: 'StockBiz',
    queries: [
      { q: 'cổ phiếu site:stockbiz.vn',        category: 'stock'  },
    ],
  },
];

// General market queries (no source filter) for "Tất cả"
const GENERAL_QUERIES: Array<{ q: string; category: NewsArticle['category'] }> = [
  { q: 'thị trường chứng khoán Việt Nam hôm nay', category: 'market' },
  { q: 'VNINDEX HNX hôm nay',                     category: 'market' },
  { q: 'cổ phiếu khuyến nghị mua bán',            category: 'stock'  },
  { q: 'lãi suất ngân hàng nhà nước Việt Nam',    category: 'macro'  },
  { q: 'kinh tế vĩ mô Việt Nam',                  category: 'macro'  },
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

const IGNORE_TICKERS = new Set(['RSS','USD','VND','IPO','ETF','GDP','CPI','PPI','FED','IMF','WTO','SEC','PE','EPS','NAV','ROE','ROA','VN','DN','CP','CT','TT','HN','TP','PT','TP.HCM']);

function extractTicker(title: string): string | undefined {
  const m = title.match(/\b([A-Z]{2,4})\b/g);
  return m?.find(t => !IGNORE_TICKERS.has(t) && t.length >= 2 && t.length <= 4);
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return (m?.[1] || m?.[2] || '').trim();
}

async function fetchGoogleNewsRSS(
  query: string,
  category: NewsArticle['category'],
  sourceKey: string,
  sourceName: string,
): Promise<NewsArticle[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=vi&gl=VN&ceid=VN:vi`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'application/rss+xml,application/xml,text/xml,*/*',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const text = await res.text();

    const items: NewsArticle[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;

    while ((m = itemRegex.exec(text)) !== null && items.length < 15) {
      const block = m[1];
      const title   = decodeEntities(extractTag(block, 'title'));
      const link    = extractTag(block, 'link') || extractTag(block, 'guid');
      const pubDate = extractTag(block, 'pubDate');

      if (!title || !link) continue;

      // Detect actual source from Google News redirect URL or title suffix " - SourceName"
      let resolvedSource = sourceKey;
      let resolvedName   = sourceName;
      if (sourceKey === 'all') {
        const titleParts = title.split(' - ');
        const suf = titleParts[titleParts.length - 1]?.trim().toLowerCase() ?? '';
        if (suf.includes('cafef'))             { resolvedSource = 'cafef';               resolvedName = 'CafeF'; }
        else if (suf.includes('vietstock'))    { resolvedSource = 'vietstock';           resolvedName = 'Vietstock'; }
        else if (suf.includes('tinnhanh'))     { resolvedSource = 'tinnhanhchungkhoan';  resolvedName = 'Tin Nhanh CK'; }
        else if (suf.includes('vneconomy'))    { resolvedSource = 'vneconomy';           resolvedName = 'VNEconomy'; }
        else if (suf.includes('stockbiz'))     { resolvedSource = 'stockbiz';            resolvedName = 'StockBiz'; }
        else if (suf.includes('f247'))         { resolvedSource = 'f247';                resolvedName = 'F247'; }
        else if (suf.includes('f319'))         { resolvedSource = 'f319';                resolvedName = 'F319'; }
        else                                   { resolvedSource = 'other';               resolvedName = titleParts[titleParts.length - 1]?.trim() ?? 'Khác'; }
      }

      // Clean title — remove " - SourceName" suffix that Google appends
      const cleanTitle = title.replace(/ - [^-]+$/, '').trim();

      const published = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
      items.push({
        id: `${resolvedSource}_${Buffer.from(link).toString('base64').slice(0, 16)}`,
        title: cleanTitle,
        url: link.trim(),
        source: resolvedSource,
        sourceName: resolvedName,
        publishedAt: published,
        relativeTime: relativeTime(published),
        category,
        ticker: extractTicker(cleanTitle),
      });
    }
    return items;
  } catch { return []; }
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const sourceFilter   = searchParams.get('source')   ?? 'all';
  const categoryFilter = searchParams.get('category') ?? 'all';
  const search         = (searchParams.get('q') ?? '').toLowerCase();

  let tasks: Promise<NewsArticle[]>[];

  if (sourceFilter === 'all') {
    // General queries + all source-specific
    tasks = [
      ...GENERAL_QUERIES.map(({ q, category }) => fetchGoogleNewsRSS(q, category, 'all', 'Khác')),
      ...SOURCE_QUERIES.flatMap(src =>
        src.queries.map(({ q, category }) => fetchGoogleNewsRSS(q, category, src.key, src.name))
      ),
    ];
  } else {
    const src = SOURCE_QUERIES.find(s => s.key === sourceFilter);
    tasks = src
      ? src.queries.map(({ q, category }) => fetchGoogleNewsRSS(q, category, src.key, src.name))
      : [];
  }

  const results = await Promise.allSettled(tasks);
  const all: NewsArticle[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate by title prefix
  const seen = new Set<string>();
  const deduped = all.filter(a => {
    const k = a.title.slice(0, 50).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
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
