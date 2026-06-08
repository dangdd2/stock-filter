"use client";
import { useEffect, useState } from 'react';
import { Brain, X, TrendingUp, RefreshCw, BarChart2, Target, Newspaper } from 'lucide-react';
import { type StockIndicatorResult } from '@/types';
import NewsPanel from '@/components/NewsPanel';
import EntryExitPanel from '@/components/EntryExitPanel';

type AiTab = 'analysis' | 'entryexit' | 'news';

const REC_CONFIG: Record<string, { label: string; className: string }> = {
  BUY:        { label: 'BUY',        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  SELL:       { label: 'SELL',       className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  HOLD:       { label: 'HOLD',       className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  OBSERVABLE: { label: 'OBSERVABLE', className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};
interface IncomeRow { date: string; revenue: number|null; grossProfit: number|null; operatingIncome: number|null; netIncome: number|null; ebit: number|null; }
interface CashFlowRow { date: string; operatingCashFlow: number|null; capex: number|null; freeCashFlow: number|null; }
interface BalanceSheetRow { date: string; totalAssets: number|null; totalLiabilities: number|null; equity: number|null; cash: number|null; totalDebt: number|null; debtToEquity: number|null; }
interface FinancialPeriod { income: IncomeRow[]; cashflow: CashFlowRow[]; balance: BalanceSheetRow[]; }
interface FinancialsData { annual: FinancialPeriod; quarterly: FinancialPeriod; }
export default function AiPanel({
  ticker, content, loading, error, onClose, item,
}: {
  ticker: string;
  content: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  item: StockIndicatorResult;
}) {
  const [aiTab, setAiTab] = useState<AiTab>('analysis');
  const [financials, setFinancials] = useState<FinancialsData | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState<string | null>(null);
  const [finPeriod, setFinPeriod] = useState<'annual' | 'quarterly'>('annual');

  useEffect(() => {
    setFinLoading(true);
    setFinError(null);
    fetch(`/api/financials/${ticker}`)
      .then(r => r.json())
      .then((d: FinancialsData & { error?: string }) => {
        if (d.error) { setFinError(d.error); } else { setFinancials(d); setFinPeriod('annual'); }
      })
      .catch(() => setFinError('Failed to load financials'))
      .finally(() => setFinLoading(false));
  }, [ticker]);

  const recMatch = content.match(/RECOMMENDATION:\s*(BUY|SELL|HOLD|OBSERVABLE)/);
  const rec = recMatch ? REC_CONFIG[recMatch[1]] : null;
  const bodyText = content.replace(/^RECOMMENDATION:\s*(BUY|SELL|HOLD|OBSERVABLE)\n?/, '');

  const fmtCap = (v?: number | null) => {
    if (!v) return '—';
    if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6)  return `${(v / 1e6).toFixed(2)}M`;
    return v.toLocaleString();
  };

  const pb = (item.price && item.bookValue) ? item.price / item.bookValue : null;

  const fundamentals = [
    {
      label: 'P/E Ratio',
      value: item.pe ? item.pe.toFixed(2) : '—',
      note: item.pe ? (item.pe < 10 ? 'Thấp — có thể định giá thấp' : item.pe < 20 ? 'Hợp lý' : item.pe < 35 ? 'Cao — kỳ vọng tăng trưởng' : 'Rất cao — rủi ro định giá') : undefined,
      noteColor: item.pe ? (item.pe < 10 ? 'text-emerald-400' : item.pe < 20 ? 'text-slate-400' : item.pe < 35 ? 'text-amber-400' : 'text-rose-400') : '',
    },
    {
      label: 'EPS',
      value: item.eps ? item.eps.toLocaleString() : '—',
      note: item.eps ? (item.eps > 0 ? 'Dương — sinh lời' : 'Âm — lỗ') : undefined,
      noteColor: item.eps ? (item.eps > 0 ? 'text-emerald-400' : 'text-rose-400') : '',
    },
    {
      label: 'P/B Ratio',
      value: pb ? pb.toFixed(2) : '—',
      note: pb ? (pb < 1 ? 'Dưới mệnh giá sổ sách' : pb < 2 ? 'Hợp lý' : pb < 4 ? 'Cao' : 'Rất cao') : undefined,
      noteColor: pb ? (pb < 1 ? 'text-emerald-400' : pb < 2 ? 'text-slate-400' : pb < 4 ? 'text-amber-400' : 'text-rose-400') : '',
    },
    {
      label: 'Book Value/Share',
      value: item.bookValue ? item.bookValue.toLocaleString() : '—',
      note: undefined,
      noteColor: '',
    },
    {
      label: 'Beta',
      value: item.beta ? item.beta.toFixed(2) : '—',
      note: item.beta ? (item.beta < 0.8 ? 'Ít biến động' : item.beta < 1.2 ? 'Tương đương thị trường' : 'Biến động cao') : undefined,
      noteColor: item.beta ? (item.beta < 0.8 ? 'text-emerald-400' : item.beta < 1.2 ? 'text-slate-400' : 'text-rose-400') : '',
    },
    {
      label: 'Vốn hoá',
      value: fmtCap(item.marketCap),
      note: undefined,
      noteColor: '',
    },
  ];

  return (
    <div className="bg-slate-900 border-t border-violet-500/20 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-violet-400" />
          <h3 className="font-bold text-slate-200">AI Analysis — {ticker}</h3>
          {rec && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${rec.className}`}>
              {rec.label}
            </span>
          )}
          {loading && !rec && (
            <span className="text-xs text-slate-500 animate-pulse">Analyzing…</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-slate-800/60 rounded-lg p-1 border border-slate-700/40">
        {([
          { id: 'analysis' as AiTab, label: 'Phân Tích AI', icon: <Brain size={13} /> },
          { id: 'entryexit' as AiTab, label: 'Vào / Ra', icon: <Target size={13} /> },
          { id: 'news' as AiTab, label: 'Tin Tức', icon: <Newspaper size={13} /> },
        ] as { id: AiTab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setAiTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
              aiTab === tab.id
                ? 'bg-violet-500/20 text-violet-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Entry/Exit tab */}
      {aiTab === 'entryexit' && (
        <EntryExitPanel item={item} />
      )}

      {/* News tab */}
      {aiTab === 'news' && (
        <NewsPanel ticker={ticker} />
      )}

      {/* Analysis tab content */}
      {aiTab === 'analysis' && (<>
      {error && (
        <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 mb-6">
          {error}
        </div>
      )}
      {!error && (
        <div className="prose prose-invert prose-sm max-w-none mb-6">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
            {bodyText || (loading ? '' : 'No content.')}
            {loading && <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />}
          </pre>
        </div>
      )}

      {/* Fundamental Analysis */}
      <div className="border-t border-slate-700/60 pt-5">
        <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-blue-400" /> Phân Tích Cơ Bản
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {fundamentals.map(({ label, value, note, noteColor }) => (
            <div key={label} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-base font-bold text-slate-200 font-mono">{value}</p>
              {note && <p className={`text-[10px] mt-1 ${noteColor}`}>{note}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Financial Statements */}
      <div className="border-t border-slate-700/60 pt-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <BarChart2 size={15} className="text-emerald-400" /> Báo Cáo Tài Chính
            {finLoading && <RefreshCw size={13} className="animate-spin text-slate-500" />}
          </h4>
          {financials && (
            <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs">
              {(['annual', 'quarterly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFinPeriod(p)}
                  className={`px-3 py-1 transition-colors ${
                    finPeriod === p
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {p === 'annual' ? 'Năm' : 'Quý'}
                </button>
              ))}
            </div>
          )}
        </div>

        {finError && (
          <p className="text-xs text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2">{finError}</p>
        )}

        {financials && !finError && (() => {
          const fmt = (v: number | null, unit = 'B') => {
            if (v === null) return '—';
            const b = v / 1e9;
            return `${b >= 0 ? '' : ''}${b.toFixed(1)}${unit}`;
          };
          const pct = (curr: number | null, prev: number | null) => {
            if (!curr || !prev || prev === 0) return null;
            const p = ((curr - prev) / Math.abs(prev)) * 100;
            return { val: p, label: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`, color: p >= 0 ? 'text-emerald-400' : 'text-rose-400' };
          };

          const period = financials[finPeriod];
          const inc = period.income;
          const cf = period.cashflow;
          const bs = period.balance;

          const hasCfData = cf.some(r => r.operatingCashFlow !== null || r.freeCashFlow !== null || r.capex !== null);
          const hasBsData = bs.some(r => r.totalAssets !== null || r.equity !== null || r.totalLiabilities !== null);

          return (
            <div className="space-y-5">
              {/* Income Statement */}
              {inc.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Kết Quả Kinh Doanh (tỷ VND)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700">
                          <th className="text-left py-1.5 pr-4 font-medium">Chỉ tiêu</th>
                          {inc.map(r => <th key={r.date} className="text-right py-1.5 px-3 font-medium">{r.date}</th>)}
                          {inc.length >= 2 && <th className="text-right py-1.5 pl-3 font-medium text-slate-600">YoY</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {([
                          { label: 'Doanh thu', key: 'revenue' },
                          { label: 'Lợi nhuận gộp', key: 'grossProfit' },
                          { label: 'Lợi nhuận HĐ', key: 'operatingIncome' },
                          { label: 'Lợi nhuận ròng', key: 'netIncome' },
                          { label: 'EBIT', key: 'ebit' },
                        ] as { label: string; key: keyof IncomeRow }[]).map(({ label, key }) => {
                          const latest = inc[0]?.[key] as number | null;
                          const prev = inc[1]?.[key] as number | null;
                          const yoy = pct(latest, prev);
                          const isProfit = key !== 'revenue' && key !== 'ebit';
                          return (
                            <tr key={key} className="hover:bg-slate-800/40">
                              <td className="py-1.5 pr-4 text-slate-400">{label}</td>
                              {inc.map(r => {
                                const v = r[key] as number | null;
                                const color = isProfit && v !== null ? (v >= 0 ? 'text-slate-200' : 'text-rose-400') : 'text-slate-200';
                                return <td key={r.date} className={`text-right py-1.5 px-3 font-mono ${color}`}>{fmt(v)}</td>;
                              })}
                              {inc.length >= 2 && (
                                <td className={`text-right py-1.5 pl-3 font-mono ${yoy?.color ?? 'text-slate-600'}`}>
                                  {yoy?.label ?? '—'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cash Flow */}
              {cf.length > 0 && hasCfData && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Dòng Tiền (tỷ VND)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700">
                          <th className="text-left py-1.5 pr-4 font-medium">Chỉ tiêu</th>
                          {cf.map(r => <th key={r.date} className="text-right py-1.5 px-3 font-medium">{r.date}</th>)}
                          {cf.length >= 2 && <th className="text-right py-1.5 pl-3 font-medium text-slate-600">YoY</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {([
                          { label: 'Dòng tiền HĐ', key: 'operatingCashFlow' },
                          { label: 'Chi tiêu vốn', key: 'capex' },
                          { label: 'Dòng tiền tự do', key: 'freeCashFlow' },
                        ] as { label: string; key: keyof CashFlowRow }[]).map(({ label, key }) => {
                          const latest = cf[0]?.[key] as number | null;
                          const prev = cf[1]?.[key] as number | null;
                          const yoy = pct(latest, prev);
                          return (
                            <tr key={key} className="hover:bg-slate-800/40">
                              <td className="py-1.5 pr-4 text-slate-400">{label}</td>
                              {cf.map(r => {
                                const v = r[key] as number | null;
                                const color = v !== null ? (v >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-600';
                                return <td key={r.date} className={`text-right py-1.5 px-3 font-mono ${color}`}>{fmt(v)}</td>;
                              })}
                              {cf.length >= 2 && (
                                <td className={`text-right py-1.5 pl-3 font-mono ${yoy?.color ?? 'text-slate-600'}`}>
                                  {yoy?.label ?? '—'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Balance Sheet */}
              {bs.length > 0 && hasBsData && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bảng Cân Đối Kế Toán (tỷ VND)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700">
                          <th className="text-left py-1.5 pr-4 font-medium">Chỉ tiêu</th>
                          {bs.map(r => <th key={r.date} className="text-right py-1.5 px-3 font-medium">{r.date}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {([
                          { label: 'Tổng tài sản', key: 'totalAssets', special: false },
                          { label: 'Tổng nợ', key: 'totalLiabilities', special: false },
                          { label: 'Vốn chủ sở hữu', key: 'equity', special: false },
                          { label: 'Tiền mặt', key: 'cash', special: false },
                          { label: 'Tổng vay nợ', key: 'totalDebt', special: false },
                          { label: 'Nợ/Vốn (D/E)', key: 'debtToEquity', special: true },
                        ] as { label: string; key: keyof BalanceSheetRow; special: boolean }[]).map(({ label, key, special }) => (
                          <tr key={key} className="hover:bg-slate-800/40">
                            <td className="py-1.5 pr-4 text-slate-400">{label}</td>
                            {bs.map(r => {
                              const v = r[key] as number | null;
                              if (special) {
                                const color = v !== null ? (v < 1 ? 'text-emerald-400' : v < 2 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-600';
                                return <td key={r.date} className={`text-right py-1.5 px-3 font-mono ${color}`}>{v !== null ? v.toFixed(2) : '—'}</td>;
                              }
                              return <td key={r.date} className="text-right py-1.5 px-3 font-mono text-slate-200">{fmt(v)}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {inc.length === 0 && !hasCfData && !hasBsData && (
                <p className="text-xs text-slate-500">Không có dữ liệu báo cáo tài chính từ Yahoo Finance.</p>
              )}
            </div>
          );
        })()}
      </div>

      </>)}
    </div>
  );
}
