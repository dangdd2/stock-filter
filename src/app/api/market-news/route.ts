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

interface RssFeed {
  name: string;
  key: string;
  urls: { url: string; category: NewsArticle['category'] }[];
}

const RSS_FEEDS: RssFeed[] = [
  {
    name: 'CafeF', key: 'cafef',
    urls: [
      { url: 'https://cafef.vn/rss/chung-khoan.rss',       category: 'stock'  },
      { url: 'https://cafef.vn/rss/thi-truong-chung-khoan.rss', category: 'market' },
    ],
  },
  {
    name: 'Vietstock', key: 'vietstock',
    urls: [
      { url: 'https://vietstock.vn/rss/chung-khoan.rss',   category: 'stock'  },
      { url: 'https://vietstock.vn/rss/thi-truong.rss',    category: 'market' },
    ],
  },
  {
    name: 'Tin Nhanh CK', key: 'tinnhanhchungkhoan',
    urls: [
      { url: 'https://tinnhanhchungkhoan.vn/rss/chung-khoan.rss', category: 'stock' },
      { url: 'https://tinnhanhchungkhoan.vn/rss/thi-truong.rss',  category: 'market' },
    ],
  },
  {
    name: 'VNEconomy', key: 'vneconomy',
    urls: [
      { url: 'https://vneconomy.vn/chung-khoan.rss',       category: 'stock'  },
      { url: 'https://vneconomy.vn/tai-chinh.rss',         category: 'market' },
    ],
  },
  {
    name: 'StockBiz', key: 'stockbiz',
    urls: [
      { url: 'https://stockbiz.vn/RSS/rss.aspx',           category: 'stock'  },
    ],
  },
  {
    name: 'F247', key: 'f247',
    urls: [
      { url: 'https://f247.com/rss/posts',                 category: 'market' },
    ],
  },
  {
    name: 'F319', key: 'f319',
    urls: [
      { url: 'https://f319.com/forums/-/index.rss',        category: 'stock'  },
    ],
  },
];

// Vietnamese diacritics — same as news route filter
const VI_DIACRITICS = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;

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

// Extract ticker from title — simple match for 2-4 uppercase sequences typical in VN markets
function extractTicker(title: string): string | undefined {
  const m = title.match(/\b([A-Z]{2,4})\b/g);
  if (!m) return undefined;
  // Filter common non-ticker uppercase words
  const IGNORE = new Set(['RSS', 'USD', 'VND', 'IPO', 'ETF', 'GDP', 'CPI', 'PPI', 'FED', 'IMF', 'WTO', 'SEC', 'PE', 'EPS', 'NAV', 'ROE', 'ROA', 'EBIT', 'TP.HCM', 'VN', 'DN', 'CP', 'CT', 'TT', 'HN', 'TP', 'PT', 'PGS']);
  return m.find(t => !IGNORE.has(t) && t.length >= 2 && t.length <= 4);
}

async function fetchFeed(url: string, feed: RssFeed, category: NewsArticle['category']): Promise<NewsArticle[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const text = await res.text();

    // Parse <item> blocks from RSS XML
    const items: NewsArticle[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;

    while ((m = itemRegex.exec(text)) !== null && items.length < 25) {
      const block = m[1];
      const title   = decodeEntities(extractTag(block, 'title'));
      const link    = extractTag(block, 'link') || extractTag(block, 'guid');
      const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || extractTag(block, 'published');

      if (!title || !link) continue;
      // Skip non-Vietnamese titles
      if (!VI_DIACRITICS.test(title) && title.length > 10) {
        const viMarkers = ['chứng khoán', 'cổ phiếu', 'thị trường', 'doanh nghiệp', 'ngân hàng', 'kinh tế'];
        if (!viMarkers.some(w => title.toLowerCase().includes(w))) continue;
      }

      const published = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
      items.push({
        id: `${feed.key}_${Buffer.from(link).toString('base64').slice(0, 16)}`,
        title: title.trim(),
        url: link.trim(),
        source: feed.key,
        sourceName: feed.name,
        publishedAt: published,
        relativeTime: relativeTime(published),
        category,
        ticker: extractTicker(title),
      });
    }
    return items;
  } catch { return []; }
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return (m?.[1] || m?.[2] || '').trim();
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const sourceFilter = searchParams.get('source') ?? 'all';
  const categoryFilter = searchParams.get('category') ?? 'all';
  const search = (searchParams.get('q') ?? '').toLowerCase();

  // Build fetch tasks
  const tasks: Promise<NewsArticle[]>[] = [];
  for (const feed of RSS_FEEDS) {
    if (sourceFilter !== 'all' && feed.key !== sourceFilter) continue;
    for (const { url, category } of feed.urls) {
      tasks.push(fetchFeed(url, feed, category));
    }
  }

  const results = await Promise.allSettled(tasks);
  const all: NewsArticle[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate by title prefix
  const seen = new Set<string>();
  const deduped = all.filter(a => {
    const k = a.title.slice(0, 40).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Filter
  const filtered = deduped.filter(a => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (search && !a.title.toLowerCase().includes(search) && !(a.ticker?.toLowerCase().includes(search))) return false;
    return true;
  });

  // Sort newest first
  filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return NextResponse.json({ articles: filtered.slice(0, 80), fetchedAt: Date.now() });
}
