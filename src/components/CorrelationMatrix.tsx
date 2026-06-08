'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw, Info, Grid3X3, ScatterChart, TrendingUp } from 'lucide-react';
import type { CorrelationResult } from '@/app/api/correlation/route';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function corrColor(r: number): string {
  // -1 → rose, 0 → slate, +1 → emerald
  if (r >= 0) {
    const t = r;
    const g = Math.round(52 + t * (163 - 52));
    const b = Math.round(64 + t * (72 - 64));
    return `rgb(${Math.round(16 + t * 5)}, ${g}, ${b})`;
  } else {
    const t = -r;
    return `rgb(${Math.round(168 + t * 71)}, ${Math.round(30 + t * 13)}, ${Math.round(50 + t * 20)})`;
  }
}

function corrLabel(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.85) return r > 0 ? 'Rất mạnh ↑' : 'Rất mạnh ↓';
  if (a >= 0.65) return r > 0 ? 'Mạnh ↑' : 'Mạnh ↓';
  if (a >= 0.40) return r > 0 ? 'Vừa ↑' : 'Vừa ↓';
  if (a >= 0.15) return r > 0 ? 'Yếu ↑' : 'Yếu ↓';
  return 'Không tương quan';
}

function corrTextColor(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.65) return '#ffffff';
  if (a >= 0.30) return '#e2e8f0';
  return '#94a3b8';
}

// ─── Scatter plot for a pair ───────────────────────────────────────────────────
function ScatterPair({ closes, tickerA, tickerB, corr }: {
  closes: Record<string, number[]>;
  tickerA: string;
  tickerB: string;
  corr: number;
}) {
  const a = closes[tickerA];
  const b = closes[tickerB];
  if (!a || !b || a.length < 5) return null;

  const n = Math.min(a.length, b.length);
  const xs = a.slice(-n);
  const ys = b.slice(-n);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const W = 220, H = 160, PAD = 24;
  const toSvgX = (v: number) => PAD + ((v - minX) / rangeX) * (W - PAD * 2);
  const toSvgY = (v: number) => H - PAD - ((v - minY) / rangeY) * (H - PAD * 2);

  // linear regression line
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - meanX) * (ys[i] - meanY); sxx += (xs[i] - meanX) ** 2; }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;
  const regY1 = slope * minX + intercept;
  const regY2 = slope * maxX + intercept;

  const dotColor = corr > 0.3 ? '#10b981' : corr < -0.3 ? '#f43f5e' : '#64748b';

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-300">{tickerA} vs {tickerB}</span>
        <span className="text-xs font-mono font-bold" style={{ color: corrColor(corr) }}>
          r = {corr.toFixed(3)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 140 }}>
        {/* axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#334155" strokeWidth="1" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#334155" strokeWidth="1" />
        {/* regression line */}
        <line
          x1={toSvgX(minX)} y1={toSvgY(regY1)}
          x2={toSvgX(maxX)} y2={toSvgY(regY2)}
          stroke={dotColor} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7"
        />
        {/* dots */}
        {xs.map((x, i) => (
          <circle key={i} cx={toSvgX(x)} cy={toSvgY(ys[i])} r="2" fill={dotColor} opacity="0.7" />
        ))}
        {/* axis labels */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#64748b">{tickerA}</text>
        <text x={8} y={H / 2} textAnchor="middle" fontSize="9" fill="#64748b" transform={`rotate(-90, 8, ${H / 2})`}>{tickerB}</text>
      </svg>
      <div className="text-center text-[10px] text-slate-500 mt-1">{corrLabel(corr)}</div>
    </div>
  );
}

// ─── Cluster groups ────────────────────────────────────────────────────────────
function ClusterView({ tickers, matrix }: { tickers: string[]; matrix: number[][] }) {
  // Simple greedy clustering: group tickers with avg correlation > 0.5
  const n = tickers.length;
  const visited = new Set<number>();
  const groups: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    const group = [i];
    visited.add(i);
    for (let j = i + 1; j < n; j++) {
      if (visited.has(j)) continue;
      // avg correlation to current group members
      const avg = group.reduce((s, g) => s + matrix[g][j], 0) / group.length;
      if (avg >= 0.5) {
        group.push(j);
        visited.add(j);
      }
    }
    groups.push(group);
  }

  const groupColors = ['bg-blue-500/15 border-blue-500/30 text-blue-300',
    'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    'bg-violet-500/15 border-violet-500/30 text-violet-300',
    'bg-amber-500/15 border-amber-500/30 text-amber-300',
    'bg-rose-500/15 border-rose-500/30 text-rose-300'];

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Các nhóm cổ phiếu có tương quan cao (r ≥ 0.5) được gom lại với nhau:</p>
      {groups.map((group, gi) => (
        <div key={gi} className={`flex flex-wrap items-center gap-2 p-3 rounded-xl border ${groupColors[gi % groupColors.length]}`}>
          <span className="text-xs font-semibold opacity-70 w-16 shrink-0">Nhóm {gi + 1}</span>
          {group.map(idx => (
            <span key={idx} className="font-mono text-sm font-bold">{tickers[idx]}</span>
          ))}
          {group.length === 1 && <span className="text-xs opacity-50 italic">độc lập</span>}
          {group.length > 1 && (
            <span className="ml-auto text-[10px] opacity-60">
              avg r = {(group.reduce((s, a) => s + group.reduce((s2, b) => s2 + (a !== b ? matrix[a][b] : 0), 0), 0) / Math.max(1, group.length * (group.length - 1))).toFixed(2)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Legend bar ────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span>Tương quan:</span>
      <div className="flex items-center gap-1">
        <div className="w-16 h-3 rounded-sm" style={{ background: 'linear-gradient(to right, rgb(239,43,70), rgb(30,41,59), rgb(16,163,72))' }} />
        <span className="text-[10px]">-1 → 0 → +1</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {[[-1, 'Nghịch chiều mạnh'], [-0.5, 'Nghịch chiều'], [0, 'Không tương quan'], [0.5, 'Cùng chiều'], [1, 'Cùng chiều mạnh']].map(([r, label]) => (
          <span key={String(r)} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: corrColor(r as number) }} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Top pairs summary ─────────────────────────────────────────────────────────
function TopPairs({ tickers, matrix }: { tickers: string[]; matrix: number[][] }) {
  const pairs: { a: string; b: string; r: number }[] = [];
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      pairs.push({ a: tickers[i], b: tickers[j], r: matrix[i][j] });
    }
  }
  pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const top = pairs.slice(0, 6);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {top.map(({ a, b, r }) => (
        <div key={`${a}-${b}`} className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-slate-300 font-semibold">{a} / {b}</span>
          <span className="text-xs font-bold font-mono" style={{ color: corrColor(r) }}>
            {r > 0 ? '+' : ''}{r.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────
interface Props {
  tickers: string[];
  onTickerClick?: (ticker: string) => void;
}

type ViewMode = 'heatmap' | 'scatter' | 'cluster';

export default function CorrelationMatrix({ tickers: watchlistTickers, onTickerClick }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [data, setData] = useState<CorrelationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('heatmap');
  const [tooltip, setTooltip] = useState<{ i: number; j: number; x: number; y: number } | null>(null);
  const [period] = useState<'1mo' | '3mo' | '6mo'>('6mo');
  const [scatterPair, setScatterPair] = useState<[string, string] | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Init from watchlist
  useEffect(() => {
    if (watchlistTickers.length >= 2 && selected.length === 0) {
      setSelected(watchlistTickers.slice(0, 8));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistTickers]);

  const fetchData = useCallback(async () => {
    if (selected.length < 2) return;
    setLoading(true); setError(null); setData(null);
    try {
      const res = await fetch('/api/correlation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: selected, period }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      // default scatter pair = highest corr pair
      if (json.tickers.length >= 2) {
        let best = { r: -2, a: '', b: '' };
        for (let i = 0; i < json.tickers.length; i++) {
          for (let j = i + 1; j < json.tickers.length; j++) {
            const r = Math.abs(json.matrix[i][j]);
            if (r > best.r) { best = { r, a: json.tickers[i], b: json.tickers[j] }; }
          }
        }
        setScatterPair([best.a, best.b]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, [selected, period]);

  // Auto-fetch when selection changes (debounced)
  useEffect(() => {
    if (selected.length < 2) { setData(null); return; }
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
  }, [fetchData, selected]);

  const addTicker = (t: string) => {
    const clean = t.trim().toUpperCase();
    if (!clean || selected.includes(clean) || selected.length >= 20) return;
    setSelected(p => [...p, clean]);
    setInput('');
  };
  const removeTicker = (t: string) => setSelected(p => p.filter(x => x !== t));

  const cellSize = data ? Math.max(36, Math.min(60, Math.floor(560 / data.tickers.length))) : 48;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-100">Correlation Matrix</h2>
          <p className="text-xs text-slate-500 mt-0.5">Ma trận tương quan giữa các cổ phiếu — tính trên % thay đổi giá hàng ngày</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addTicker(input)}
            placeholder="Thêm mã (VD: FPT)"
            className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36"
          />
          <button onClick={() => addTicker(input)}
            className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-lg text-sm hover:bg-blue-500/30 transition-colors">
            + Thêm
          </button>
          <button onClick={fetchData} disabled={loading || selected.length < 2}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors disabled:opacity-40">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Watchlist quick-pick */}
      {watchlistTickers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-slate-500 mr-1">Watchlist:</span>
          {watchlistTickers.map(t => (
            <button key={t} onClick={() => selected.includes(t) ? removeTicker(t) : addTicker(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
                selected.includes(t)
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-600/60'
              }`}>
              {t}
            </button>
          ))}
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className="text-xs text-rose-400 hover:text-rose-300 ml-2 transition-colors">
              Xóa tất cả
            </button>
          )}
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(t => (
            <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-slate-700/60 border border-slate-600/50 rounded-full text-xs font-mono text-slate-300">
              {t}
              <button onClick={() => removeTicker(t)} className="text-slate-500 hover:text-rose-400 transition-colors ml-0.5">×</button>
            </span>
          ))}
          <span className="text-xs text-slate-600 self-center">{selected.length}/20 mã</span>
        </div>
      )}

      {selected.length < 2 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          Chọn ít nhất 2 mã cổ phiếu để tính ma trận tương quan
        </div>
      )}

      {/* Error */}
      {error && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2">⚠ {error}</div>}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Đang tải dữ liệu và tính tương quan…</span>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-4">
          {/* Errors for failed tickers */}
          {Object.keys(data.errors).length > 0 && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              ⚠ Không lấy được dữ liệu: {Object.keys(data.errors).join(', ')}
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
              {([
                { id: 'heatmap' as ViewMode, label: 'Heatmap', icon: <Grid3X3 size={12} /> },
                { id: 'scatter' as ViewMode, label: 'Scatter', icon: <ScatterChart size={12} /> },
                { id: 'cluster' as ViewMode, label: 'Nhóm',    icon: <TrendingUp size={12} /> },
              ]).map(v => (
                <button key={v.id} onClick={() => setView(v.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${view === v.id ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-700'}`}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Info size={11} /> <span>Dữ liệu 6 tháng — {data.tickers.length} mã — tính trên daily returns</span>
            </div>
          </div>

          {/* ── HEATMAP VIEW ── */}
          {view === 'heatmap' && (
            <div className="space-y-4">
              <Legend />
              <div className="overflow-x-auto">
                <div style={{ display: 'inline-block', position: 'relative' }}>
                  {/* Column labels */}
                  <div style={{ display: 'flex', paddingLeft: cellSize * 1.6 }}>
                    {data.tickers.map((t, j) => (
                      <div key={j} style={{ width: cellSize, minWidth: cellSize }}
                        className="text-center text-[10px] font-mono font-bold text-slate-400 pb-1 truncate px-0.5"
                        title={t}>
                        {t}
                      </div>
                    ))}
                  </div>
                  {/* Rows */}
                  {data.tickers.map((rowT, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                      {/* Row label */}
                      <div style={{ width: cellSize * 1.6, minWidth: cellSize * 1.6 }}
                        className="text-right pr-2 text-[10px] font-mono font-bold text-slate-400 truncate cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => onTickerClick?.(rowT)}
                        title={rowT}>
                        {rowT}
                      </div>
                      {/* Cells */}
                      {data.tickers.map((colT, j) => {
                        const r = data.matrix[i][j];
                        const isHovered = tooltip?.i === i && tooltip?.j === j;
                        return (
                          <div
                            key={j}
                            style={{
                              width: cellSize, minWidth: cellSize, height: cellSize,
                              background: i === j ? '#1e293b' : corrColor(r),
                              border: isHovered ? '2px solid #60a5fa' : '1px solid rgba(0,0,0,0.2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: i !== j ? 'pointer' : 'default',
                              transition: 'border 0.1s',
                            }}
                            onMouseEnter={e => { if (i !== j) setTooltip({ i, j, x: e.clientX, y: e.clientY }); }}
                            onMouseLeave={() => setTooltip(null)}
                            onClick={() => {
                              if (i !== j) {
                                setScatterPair([rowT, colT]);
                                setView('scatter');
                              }
                            }}
                          >
                            {i === j
                              ? <span className="font-mono text-[9px] font-bold text-slate-400">{rowT}</span>
                              : <span style={{ fontSize: Math.max(8, cellSize * 0.22), color: corrTextColor(r), fontWeight: 700, fontFamily: 'monospace' }}>
                                  {r.toFixed(2)}
                                </span>
                            }
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tooltip */}
              {tooltip && data && (
                <div
                  ref={tooltipRef}
                  className="fixed z-50 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none"
                  style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
                  <div className="font-bold text-slate-200 mb-1">
                    {data.tickers[tooltip.i]} ↔ {data.tickers[tooltip.j]}
                  </div>
                  <div className="font-mono text-lg font-bold" style={{ color: corrColor(data.matrix[tooltip.i][tooltip.j]) }}>
                    r = {data.matrix[tooltip.i][tooltip.j] > 0 ? '+' : ''}{data.matrix[tooltip.i][tooltip.j].toFixed(3)}
                  </div>
                  <div className="text-slate-400 mt-0.5">{corrLabel(data.matrix[tooltip.i][tooltip.j])}</div>
                  <div className="text-slate-600 text-[10px] mt-1">Click để xem scatter plot</div>
                </div>
              )}

              {/* Top pairs */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">Các cặp tương quan cao nhất</div>
                <TopPairs tickers={data.tickers} matrix={data.matrix} />
              </div>
            </div>
          )}

          {/* ── SCATTER VIEW ── */}
          {view === 'scatter' && (
            <div className="space-y-4">
              {/* Pair selector */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-slate-500">Chọn cặp:</span>
                {data.tickers.map((a, i) =>
                  data.tickers.slice(i + 1).map((b) => (
                    <button key={`${a}-${b}`}
                      onClick={() => setScatterPair([a, b])}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
                        scatterPair?.[0] === a && scatterPair?.[1] === b
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-600/60'
                      }`}>
                      {a}/{b}
                    </button>
                  ))
                )}
              </div>
              {scatterPair && (
                <div className="max-w-xs">
                  <ScatterPair
                    closes={data.closes}
                    tickerA={scatterPair[0]}
                    tickerB={scatterPair[1]}
                    corr={data.matrix[data.tickers.indexOf(scatterPair[0])][data.tickers.indexOf(scatterPair[1])]}
                  />
                </div>
              )}
              {/* All top scatter grid */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-3">6 cặp tương quan mạnh nhất</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(() => {
                    const pairs: { a: string; b: string; i: number; j: number; r: number }[] = [];
                    for (let i = 0; i < data.tickers.length; i++) {
                      for (let j = i + 1; j < data.tickers.length; j++) {
                        pairs.push({ a: data.tickers[i], b: data.tickers[j], i, j, r: data.matrix[i][j] });
                      }
                    }
                    return pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 6);
                  })().map(({ a, b, r }) => (
                    <ScatterPair key={`${a}-${b}`} closes={data.closes} tickerA={a} tickerB={b} corr={r} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CLUSTER VIEW ── */}
          {view === 'cluster' && (
            <ClusterView tickers={data.tickers} matrix={data.matrix} />
          )}
        </div>
      )}
    </div>
  );
}
