'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Activity, TrendingUp, TrendingDown, Brain, RefreshCw, Sparkles,
} from 'lucide-react';
import type { StockIndicatorResult } from '@/types';

type Timeframe = '1w' | '1m' | '3m';

const TF_LABEL: Record<Timeframe, string> = { '1w': '1 Tuần', '1m': '1 Tháng', '3m': '3 Tháng' };
const TF_FIELD: Record<Timeframe, 'change1w' | 'change1m' | 'change3m'> = {
  '1w': 'change1w', '1m': 'change1m', '3m': 'change3m',
};

interface Bucket {
  key: string;
  label: string;
  min: number; // inclusive, in %
  max: number; // exclusive, in %
  color: string;
  textColor: string;
}

const BUCKETS: Bucket[] = [
  { key: 'up_strong',   label: 'Tăng trên 20%',      min: 20,   max: Infinity, color: 'bg-emerald-600',  textColor: 'text-emerald-300' },
  { key: 'up_mid',      label: 'Tăng từ 10–20%',     min: 10,   max: 20,       color: 'bg-emerald-500',  textColor: 'text-emerald-300' },
  { key: 'up_small',    label: 'Có lãi nhẹ dưới 10%', min: 0,    max: 10,       color: 'bg-emerald-400/70', textColor: 'text-emerald-300' },
  { key: 'flat',        label: 'Không biến động',     min: -0.01, max: 0.01,    color: 'bg-slate-500',    textColor: 'text-slate-300' },
  { key: 'down_small',  label: 'Lỗ dưới 10%',         min: -10,  max: 0,        color: 'bg-rose-400/70',  textColor: 'text-rose-300' },
  { key: 'down_strong', label: 'Lỗ trên 10%',         min: -Infinity, max: -10, color: 'bg-rose-600',     textColor: 'text-rose-300' },
];

function bucketize(changes: number[]): Array<Bucket & { count: number; pct: number }> {
  const total = changes.length || 1;
  return BUCKETS.map(b => {
    const count = changes.filter(c => c >= b.min && c < b.max).length;
    return { ...b, count, pct: (count / total) * 100 };
  });
}

interface Props {
  data: StockIndicatorResult[];
}

export default function MarketSentimentPanel({ data }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const field = TF_FIELD[timeframe];

  const changes = useMemo(
    () => data.map(d => d[field]).filter((v): v is number => typeof v === 'number'),
    [data, field]
  );

  const buckets = useMemo(() => bucketize(changes), [changes]);
  const total = changes.length;

  const stats = useMemo(() => {
    if (changes.length === 0) return null;
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    const advancing = changes.filter(c => c > 0.01).length;
    const declining = changes.filter(c => c < -0.01).length;
    const sorted = [...changes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { avg, advancing, declining, median, advRatio: (advancing / changes.length) * 100 };
  }, [changes]);

  const buildTemplate = useCallback(() => {
    if (!stats || total === 0) return 'Chưa đủ dữ liệu để tạo nhận định.';
    const up20 = buckets.find(b => b.key === 'up_strong')!;
    const up1020 = buckets.find(b => b.key === 'up_mid')!;
    const downStrong = buckets.find(b => b.key === 'down_strong')!;
    const downSmall = buckets.find(b => b.key === 'down_small')!;

    const sentiment = stats.advRatio >= 60 ? 'tích cực' : stats.advRatio <= 40 ? 'tiêu cực' : 'phân hóa, giằng co';

    return `Trong ${TF_LABEL[timeframe].toLowerCase()} qua, thống kê ${total} mã trong danh mục theo dõi cho thấy tâm lý thị trường ${sentiment}. ` +
      `Có ${stats.advancing} mã tăng giá (${stats.advRatio.toFixed(1)}%) và ${stats.declining} mã giảm giá. ` +
      `Mức thay đổi trung bình đạt ${stats.avg >= 0 ? '+' : ''}${stats.avg.toFixed(2)}%, trung vị ${stats.median >= 0 ? '+' : ''}${stats.median.toFixed(2)}%. ` +
      `${up20.count > 0 ? `Đáng chú ý có ${up20.count} mã tăng mạnh trên 20%. ` : ''}` +
      `${downStrong.count > 0 ? `Ngược lại, ${downStrong.count} mã giảm sâu trên 10%, cho thấy áp lực bán vẫn hiện diện ở một số nhóm ngành. ` : ''}` +
      `${up1020.pct + downSmall.pct > 40 ? 'Phần lớn biến động vẫn nằm trong biên độ vừa phải, phản ánh thị trường chưa có xu hướng dứt khoát.' : ''}`;
  }, [stats, total, buckets, timeframe]);

  const runAiAnalysis = async () => {
    if (!stats || total === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiText('');
    try {
      const summary = `Thống kê biến động giá ${TF_LABEL[timeframe]} trên ${total} mã cổ phiếu:\n` +
        buckets.map(b => `- ${b.label}: ${b.count} mã (${b.pct.toFixed(1)}%)`).join('\n') +
        `\n\nTrung bình: ${stats.avg.toFixed(2)}% | Trung vị: ${stats.median.toFixed(2)}% | Tăng giá: ${stats.advancing} mã | Giảm giá: ${stats.declining} mã`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Dựa trên số liệu thống kê phân phối biến động giá thị trường sau đây, hãy viết một đoạn nhận định ngắn gọn (150-200 từ) theo phong cách chuyên gia phân tích, đề cập tâm lý thị trường, dòng tiền, và khuyến nghị chiến lược phân bổ vốn phù hợp với giai đoạn phân hóa này:\n\n${summary}`,
          }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'token') {
              accumulated += parsed.content;
              setAiText(accumulated);
            }
          } catch { /* skip malformed chunk */ }
        }
      }
      if (!accumulated) setAiText('Không nhận được phản hồi từ AI.');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setAiLoading(false);
    }
  };

  const displayText = aiText || buildTemplate();
  const maxPct = Math.max(...buckets.map(b => b.pct), 1);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-blue-400" />
          <span className="text-sm font-bold text-slate-200">Cảm Biến Thị Trường</span>
          <span className="text-xs text-slate-500">— {total} mã theo dõi</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {(['1w', '1m', '3m'] as Timeframe[]).map(tf => (
            <button key={tf} onClick={() => { setTimeframe(tf); setAiText(''); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                timeframe === tf ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'text-slate-500 border-transparent hover:bg-slate-700 hover:text-slate-300'
              }`}>
              {TF_LABEL[tf]}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-6 py-12 text-center text-slate-500 text-sm">
          Chưa có đủ dữ liệu biến động giá cho khung thời gian này. Hãy đảm bảo watchlist có dữ liệu lịch sử.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Left: distribution table + bars */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp size={11} /> Thống kê biến động giá trên toàn danh mục trong {TF_LABEL[timeframe].toLowerCase()} qua
            </p>

            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
                  <th className="text-left pb-2 font-medium">Tình trạng biến động giá</th>
                  <th className="text-right pb-2 font-medium">Tổng các mã</th>
                  <th className="text-right pb-2 font-medium">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {buckets.map(b => (
                  <tr key={b.key}>
                    <td className="py-1.5">
                      <span className={`inline-flex items-center gap-1.5 ${b.textColor}`}>
                        <span className={`w-2 h-2 rounded-sm ${b.color}`} />
                        {b.label}
                      </span>
                    </td>
                    <td className={`py-1.5 text-right font-mono font-semibold ${b.textColor}`}>{b.count}</td>
                    <td className={`py-1.5 text-right font-mono ${b.textColor}`}>{b.pct.toFixed(1)}%</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-600">
                  <td className="py-2 font-bold text-slate-200">Tổng cộng</td>
                  <td className="py-2 text-right font-mono font-bold text-slate-200">{total}</td>
                  <td className="py-2 text-right font-mono font-bold text-slate-200">100.0%</td>
                </tr>
              </tbody>
            </table>

            {/* Horizontal bars */}
            <div className="space-y-1.5">
              {buckets.map(b => (
                <div key={b.key} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-28 shrink-0 truncate">{b.label}</span>
                  <div className="flex-1 h-3 bg-slate-900/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${b.color} transition-all`} style={{ width: `${(b.pct / maxPct) * 100}%` }} />
                  </div>
                  <span className={`text-[10px] font-mono w-10 text-right shrink-0 ${b.textColor}`}>{b.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>

            {/* Quick stats */}
            {stats && (
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-700">
                <div className="flex items-center gap-2">
                  <TrendingUp size={12} className="text-emerald-400" />
                  <span className="text-xs text-slate-400">Tăng giá:</span>
                  <span className="text-xs font-mono font-bold text-emerald-300">{stats.advancing} mã</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown size={12} className="text-rose-400" />
                  <span className="text-xs text-slate-400">Giảm giá:</span>
                  <span className="text-xs font-mono font-bold text-rose-300">{stats.declining} mã</span>
                </div>
                <div className="text-xs text-slate-400">Trung bình: <span className={`font-mono font-bold ${stats.avg >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{stats.avg >= 0 ? '+' : ''}{stats.avg.toFixed(2)}%</span></div>
                <div className="text-xs text-slate-400">Trung vị: <span className={`font-mono font-bold ${stats.median >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{stats.median >= 0 ? '+' : ''}{stats.median.toFixed(2)}%</span></div>
              </div>
            )}
          </div>

          {/* Right: narrative */}
          <div className="bg-amber-50/[0.04] border border-amber-500/20 rounded-xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={13} className="text-amber-400" />
              <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">Nhận Định Thị Trường</span>
              <button
                onClick={runAiAnalysis}
                disabled={aiLoading}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 transition-colors disabled:opacity-50"
              >
                {aiLoading ? <RefreshCw size={11} className="animate-spin" /> : <Brain size={11} />}
                {aiLoading ? 'Đang phân tích...' : 'Phân Tích AI'}
              </button>
            </div>

            {aiError && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-3">{aiError}</div>
            )}

            <div className="flex-1 text-sm text-amber-100/90 leading-relaxed whitespace-pre-wrap">
              {displayText}
            </div>

            {!aiText && (
              <p className="text-[10px] text-amber-500/50 mt-3 pt-3 border-t border-amber-500/10">
                Nhận định trên được tạo tự động từ số liệu thống kê. Bấm &quot;Phân Tích AI&quot; để có góc nhìn chuyên sâu hơn.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
