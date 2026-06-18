import { Activity, RefreshCw, TrendingUp, TrendingDown, EyeOff } from 'lucide-react';
import type { SignalEntry } from '@/hooks/useTickerSignals';

interface Props {
  buySignals: SignalEntry[];
  sellSignals: SignalEntry[];
  watchlistName: string;
  loading: boolean;
  onTickerClick: (ticker: string) => void;
  onIgnoreTicker: (ticker: string) => void;
}

export default function SignalRecommendationPanel({
  buySignals, sellSignals, watchlistName, loading, onTickerClick, onIgnoreTicker,
}: Props) {
  if (buySignals.length === 0 && sellSignals.length === 0) return null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Activity size={13} className="text-blue-400"/>
        <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Khuyến Nghị Cổ Phiếu</span>
        {loading && <RefreshCw size={11} className="animate-spin text-slate-400 ml-1"/>}
        <span className="text-xs text-slate-500">— {watchlistName}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-400 tracking-wide">sorted by conviction</span>
      </div>
      {[{ signals: buySignals, dir: 'buy' as const }, { signals: sellSignals, dir: 'sell' as const }].map(({ signals, dir }) =>
        signals.length > 0 ? (
          <div key={dir} className="flex flex-wrap items-start gap-2">
            <span className={`flex items-center gap-1 text-xs font-semibold shrink-0 pt-0.5 min-w-[70px] ${dir==='buy'?'text-emerald-400':'text-rose-400'}`}>
              {dir==='buy'?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {dir==='buy'?'MUA':'BÁN'} ({signals.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {signals.map(({ ticker, reasons, entry, target }) => {
                const score = reasons.length; const c = dir==='buy'?'emerald':'rose';
                return (
                  <div key={ticker} onClick={() => onTickerClick(ticker)}
                    className={`relative flex flex-col px-2.5 py-1.5 border rounded-lg text-xs cursor-pointer hover:brightness-110 transition-all group ${score===3?`bg-${c}-500/25 border-${c}-500/50 ring-1 ring-${c}-500/30`:score===2?`bg-${c}-500/15 border-${c}-500/35`:`bg-${c}-500/10 border-${c}-500/20`}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-${c}-300`}>{ticker}</span>
                      <span className={`text-${c}-500/70`}>{reasons.join(' · ')}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono leading-none ${score===3?`bg-${c}-400/20 text-${c}-300 font-bold`:score===2?`bg-${c}-500/15 text-${c}-400`:`bg-slate-700 text-${c}-600`}`}>{score}/3</span>
                      <button onClick={e=>{e.stopPropagation();onIgnoreTicker(ticker);}} className="ml-auto p-0.5 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"><EyeOff size={11}/></button>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                      {target!=null?(<>
                        <span className={`text-${c}-400 font-medium`}>{entry.toLocaleString()}</span>
                        <span className="text-slate-500">-</span>
                        <span className={`text-${c}-300 font-medium`}>{Math.round(target).toLocaleString()}</span>
                        <span className="text-slate-500">(</span>
                        <span className={`text-${c}-300 font-semibold`}>{dir==='buy'?'+':''}{(((target-entry)/entry)*100).toFixed(1)}%</span>
                        <span className="text-slate-500">)</span>
                      </>):<span className={`text-${c}-400 font-medium`}>{entry.toLocaleString()}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
