"use client";

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, Newspaper, Clock } from 'lucide-react';
import type { NewsItem } from '@/app/api/news/[ticker]/route';

interface Props {
  ticker: string;
}

function SentimentBadge({ sentiment, score }: { sentiment: NewsItem['sentiment']; score: number }) {
  const cfg = {
    positive: { icon: <TrendingUp  size={11}/>, cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
    negative: { icon: <TrendingDown size={11}/>, cls: 'bg-rose-500/15    text-rose-300    border-rose-500/25'    },
    neutral:  { icon: <Minus        size={11}/>, cls: 'bg-slate-700       text-slate-400   border-slate-600'      },
  }[sentiment];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.cls}`}>
      {cfg.icon} {score > 0 ? '+' : ''}{(score * 100).toFixed(0)}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return `${Math.floor(diff / 60000)}p trước`;
  if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export default function NewsPanel({ ticker }: Props) {
  const [news,    setNews]    = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<'all' | 'positive' | 'negative'>('all');

  const fetchNews = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/news/${ticker}`);
      if (!res.ok) throw new Error('Không thể tải tin tức');
      setNews(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally { setLoading(false); }
  }, [ticker]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const filtered = news.filter(n => filter === 'all' || n.sentiment === filter);

  // Sentiment summary
  const pos = news.filter(n => n.sentiment === 'positive').length;
  const neg = news.filter(n => n.sentiment === 'negative').length;
  const avgScore = news.length ? news.reduce((s, n) => s + n.sentimentScore, 0) / news.length : 0;
  const overallSentiment = avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral';

  return (
    <div className="bg-slate-900 border-t border-slate-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={15} className="text-blue-400"/>
          <span className="text-sm font-semibold text-slate-200">Tin tức — {ticker}</span>
          {!loading && news.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              overallSentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-300' :
              overallSentiment === 'negative' ? 'bg-rose-500/20 text-rose-300' :
              'bg-slate-700 text-slate-400'
            }`}>
              {overallSentiment === 'positive' ? '🟢 Tích cực' : overallSentiment === 'negative' ? '🔴 Tiêu cực' : '⚪ Trung lập'}
              {' '}({(avgScore * 100).toFixed(0) > '0' ? '+' : ''}{(avgScore * 100).toFixed(0)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex rounded overflow-hidden border border-slate-700 text-[11px]">
            {[['all','Tất cả'],['positive','🟢'],['negative','🔴']] .map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v as typeof filter)}
                className={`px-2 py-1 transition-colors ${filter === v ? 'bg-slate-600 text-slate-200' : 'text-slate-500 hover:bg-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={fetchNews} disabled={loading}
            className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>
          </button>
        </div>
      </div>

      {/* Sentiment summary bar */}
      {news.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-400 flex items-center gap-1"><TrendingUp size={11}/>{pos}</span>
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${(pos/news.length)*100}%` }}/>
            <div className="bg-rose-500   h-full" style={{ width: `${(neg/news.length)*100}%` }}/>
          </div>
          <span className="text-rose-400 flex items-center gap-1"><TrendingDown size={11}/>{neg}</span>
        </div>
      )}

      {/* News list */}
      {loading && <div className="flex items-center gap-2 text-slate-500 text-sm py-4 justify-center"><RefreshCw size={14} className="animate-spin"/> Đang tải...</div>}
      {error   && <div className="text-rose-400 text-sm bg-rose-500/10 rounded-lg px-3 py-2">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center text-slate-500 text-sm py-6">Không có tin tức</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {filtered.map(item => (
            <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
              className="group flex gap-3 p-3 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/40 hover:border-slate-600 transition-colors block">
              {/* Thumbnail */}
              {item.thumbnail && (
                <img src={item.thumbnail} alt="" className="w-16 h-12 object-cover rounded shrink-0 opacity-80" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-200 leading-snug group-hover:text-blue-300 transition-colors line-clamp-2 font-medium">
                    {item.title}
                  </p>
                  <ExternalLink size={12} className="text-slate-600 group-hover:text-slate-400 shrink-0 mt-0.5 transition-colors"/>
                </div>
                {item.description && item.description !== item.title && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <SentimentBadge sentiment={item.sentiment} score={item.sentimentScore}/>
                  <span className="text-[10px] text-slate-600">{item.source}</span>
                  <span className="text-[10px] text-slate-600 flex items-center gap-0.5 ml-auto">
                    <Clock size={9}/> {timeAgo(item.publishedAt)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-600 text-center">
        Sentiment phân tích từ tiêu đề · Cập nhật cache 15 phút · Click để đọc bài gốc
      </p>
    </div>
  );
}
