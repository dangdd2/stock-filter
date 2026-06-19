'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Newspaper, RefreshCw, Search, Bookmark, ExternalLink, Clock, Filter } from 'lucide-react';
import type { NewsArticle } from '@/app/api/market-news/route';

const SOURCES = [
  { key: 'all',                label: 'Tất cả' },
  { key: 'cafef',              label: 'CafeF' },
  { key: 'vietstock',          label: 'Vietstock' },
  { key: 'tinnhanhchungkhoan', label: 'Tin Nhanh CK' },
  { key: 'vneconomy',          label: 'VNEconomy' },
  { key: 'stockbiz',           label: 'StockBiz' },
];

const CATEGORIES = [
  { key: 'all',    label: 'Tất cả tin tức' },
  { key: 'market', label: 'Thị trường' },
  { key: 'stock',  label: 'Cổ phiếu' },
  { key: 'macro',  label: 'Vĩ mô' },
  { key: 'world',  label: 'Thế giới' },
];

const CATEGORY_COLOR: Record<string, string> = {
  market: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  stock:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  macro:  'bg-amber-500/15 text-amber-300 border-amber-500/25',
  world:  'bg-purple-500/15 text-purple-300 border-purple-500/25',
};

const CATEGORY_LABEL: Record<string, string> = {
  market: 'Thị trường', stock: 'Cổ phiếu', macro: 'Vĩ mô', world: 'Thế giới',
};

const SOURCE_NAME_MAP: Record<string, string[]> = {
  cafef:               ['cafef'],
  vietstock:           ['vietstock'],
  tinnhanhchungkhoan:  ['tin nhanh', 'tinnhanh'],
  vneconomy:           ['vneconomy', 'vn economy'],
  stockbiz:            ['stockbiz'],
};

function matchesSource(a: NewsArticle, key: string): boolean {
  if (key === 'all') return true;
  if (a.source === key) return true;
  const name = a.sourceName.toLowerCase();
  return SOURCE_NAME_MAP[key]?.some(k => name.includes(k)) ?? false;
}

export default function MarketNewsPanel() {
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [source,   setSource]   = useState('all');
  const [category, setCategory] = useState('all');
  const [search,   setSearch]   = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [saved,    setSaved]    = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // source + search → API refetch. Category is client-side only (instant, no refetch).
  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ source });
      if (search) params.set('q', search);
      const res = await fetch(`/api/market-news?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAllArticles(json.articles ?? []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, [source, search]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  useEffect(() => {
    try { const s = localStorage.getItem('news_saved'); if (s) setSaved(new Set(JSON.parse(s))); } catch { /* ignore */ }
  }, []);

  // Client-side: category filter applied on top of API results
  const articles = useMemo(
    () => category === 'all' ? allArticles : allArticles.filter(a => a.category === category),
    [allArticles, category]
  );

  // Count per source from full allArticles (not filtered by category, so counts stay stable)
  const sourceGroups = useMemo(() =>
    SOURCES.slice(1).reduce<Record<string, number>>((acc, s) => {
      acc[s.key] = allArticles.filter(a => matchesSource(a, s.key)).length;
      return acc;
    }, {}),
    [allArticles]
  );

  const toggleSave = (id: string) => {
    setSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('news_saved', JSON.stringify([...next]));
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSearch(searchInput); };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Newspaper size={15} className="text-blue-400" />
          <span className="text-sm font-bold text-slate-200">Tin Tức Chứng Khoán</span>
          {lastUpdated && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock size={9}/> {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex gap-1.5 ml-auto">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm tin tức..."
              className="bg-slate-900 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"/>
          </div>
          <button type="submit" className="px-3 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-md text-xs hover:bg-blue-500/25 transition-colors">Tìm</button>
          {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} className="px-2 py-1.5 text-slate-400 hover:text-slate-200 text-xs">✕</button>}
        </form>
        <button onClick={fetchNews} disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-700 rounded-md transition-colors border border-transparent hover:border-slate-600 disabled:opacity-50">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5">
          <Filter size={11} className="text-slate-500 shrink-0" />
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                category === c.key ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
              }`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SOURCES.map(s => {
            const count = s.key === 'all' ? allArticles.length : (sourceGroups[s.key] ?? 0);
            return (
              <button key={s.key} onClick={() => setSource(s.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
                  source === s.key ? 'bg-slate-700 text-slate-200 border-slate-600' : 'text-slate-500 border-transparent hover:bg-slate-700/50 hover:text-slate-300'
                }`}>
                {s.label}
                {count > 0 && <span className="text-[9px] text-slate-500 font-normal">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>}

      {/* Articles */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_140px] gap-4 px-4 py-2.5 border-b border-slate-700 bg-slate-900/50 text-[10px] text-slate-500 uppercase tracking-wider font-medium">
          <span>Thời gian</span><span>Tiêu đề bài viết</span><span className="text-right">Nguồn</span>
        </div>

        {loading && !allArticles.length && (
          <div className="divide-y divide-slate-700/50">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[140px_1fr_140px] gap-4 px-4 py-3.5 animate-pulse">
                <div className="h-3 w-20 bg-slate-700 rounded"/>
                <div className="space-y-1.5"><div className="h-3 w-full bg-slate-700 rounded"/><div className="h-2 w-16 bg-slate-800 rounded"/></div>
                <div className="h-3 w-16 bg-slate-700 rounded ml-auto"/>
              </div>
            ))}
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-500 text-sm">
            {error ? 'Không thể tải tin tức.' : 'Không tìm thấy tin tức phù hợp.'}
          </div>
        )}

        {articles.length > 0 && (
          <div className="divide-y divide-slate-700/30">
            {articles.map(article => (
              <div key={article.id} className="grid grid-cols-[140px_1fr_140px] gap-4 px-4 py-3 hover:bg-slate-700/20 transition-colors group">
                <div className="flex items-start gap-2 pt-0.5">
                  <button onClick={() => toggleSave(article.id)}
                    className={`mt-0.5 shrink-0 transition-colors ${saved.has(article.id) ? 'text-amber-400' : 'text-slate-600 group-hover:text-slate-500'}`}>
                    <Bookmark size={13} fill={saved.has(article.id) ? 'currentColor' : 'none'}/>
                  </button>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{article.relativeTime}</span>
                </div>
                <div>
                  <a href={article.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-slate-200 hover:text-blue-300 transition-colors leading-snug line-clamp-2 font-medium">
                    {article.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {article.ticker && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 font-mono font-bold">{article.ticker}</span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CATEGORY_COLOR[article.category] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                      {CATEGORY_LABEL[article.category] ?? article.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-start justify-end gap-2 pt-0.5">
                  <span className="text-xs text-slate-400 text-right leading-tight">{article.sourceName}</span>
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-400 transition-colors shrink-0">
                    <ExternalLink size={13}/>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {articles.length > 0 && (
        <p className="text-center text-[11px] text-slate-600">{articles.length} / {allArticles.length} tin tức</p>
      )}
    </div>
  );
}
