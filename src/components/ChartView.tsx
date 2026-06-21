"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { RefreshCw, BarChart2 } from 'lucide-react';
import {
  createChart, ColorType, CrosshairMode,
  type IChartApi, type ISeriesApi, type Time,
  CandlestickSeries, HistogramSeries, LineSeries, AreaSeries,
} from 'lightweight-charts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChartDataPoint {
  time: number; open: number; high: number; low: number; close: number;
  dateStr: string;
  rsi?: number; macd?: number; macdSignal?: number; macdHistogram?: number;
  stochK?: number; stochD?: number;
  ma20?: number; ma50?: number;
  volume?: number; volumeMa?: number;
  bbUpper?: number | null; bbMiddle?: number | null; bbLower?: number | null;
  mfi?: number | null; obv?: number | null;
}

function readToggle(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const val = localStorage.getItem(key);
  return val === null ? def : val === 'true';
}

const CHART_BG     = '#0f172a';
const GRID_COLOR   = '#1e293b';
const TEXT_COLOR   = '#94a3b8';
const BORDER_COLOR = '#334155';
const UP_COLOR     = '#10b981';
const DOWN_COLOR   = '#f43f5e';

const PANEL_HEIGHT_MAIN = 380;
const PANEL_HEIGHT_SUB  = 130;

export default function ChartView({ ticker }: { ticker: string }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [hover, setHover]         = useState<ChartDataPoint | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const [showMA20, setShowMA20] = useState(() => readToggle('chart_showMA20', true));
  const [showMA50, setShowMA50] = useState(() => readToggle('chart_showMA50', false));
  const [showBB,   setShowBB]   = useState(() => readToggle('chart_showBB',   true));

  const [showVolPanel,   setShowVolPanel]   = useState(() => readToggle('chart_showVolPanel',   true));
  const [showRsiPanel,   setShowRsiPanel]   = useState(() => readToggle('chart_showRsiPanel',   true));
  const [showMacdPanel,  setShowMacdPanel]  = useState(() => readToggle('chart_showMacdPanel',  true));
  const [showStochPanel, setShowStochPanel] = useState(() => readToggle('chart_showStochPanel', false));
  const [showMfiPanel,   setShowMfiPanel]   = useState(() => readToggle('chart_showMfiPanel',   true));
  const [showObvPanel,   setShowObvPanel]   = useState(() => readToggle('chart_showObvPanel',   true));

  useEffect(() => { localStorage.setItem('chart_showMA20', String(showMA20)); }, [showMA20]);
  useEffect(() => { localStorage.setItem('chart_showMA50', String(showMA50)); }, [showMA50]);
  useEffect(() => { localStorage.setItem('chart_showBB',   String(showBB));   }, [showBB]);
  useEffect(() => { localStorage.setItem('chart_showVolPanel',   String(showVolPanel));   }, [showVolPanel]);
  useEffect(() => { localStorage.setItem('chart_showRsiPanel',   String(showRsiPanel));   }, [showRsiPanel]);
  useEffect(() => { localStorage.setItem('chart_showMacdPanel',  String(showMacdPanel));  }, [showMacdPanel]);
  useEffect(() => { localStorage.setItem('chart_showStochPanel', String(showStochPanel)); }, [showStochPanel]);
  useEffect(() => { localStorage.setItem('chart_showMfiPanel',   String(showMfiPanel));   }, [showMfiPanel]);
  useEffect(() => { localStorage.setItem('chart_showObvPanel',   String(showObvPanel));   }, [showObvPanel]);

  // ─── Fetch + compute MA/volMa client-side ─────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/chart/${ticker}`)
      .then(r => { if (!r.ok) throw new Error('Failed to fetch chart data'); return r.json(); })
      .then((json: ChartDataPoint[]) => {
        setChartData(json.map((d, i, arr) => {
          const sma = (period: number) => {
            if (i < period - 1) return undefined;
            return arr.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period;
          };
          const volMa = i < 19
            ? undefined
            : arr.slice(i - 19, i + 1).reduce((s, x) => s + (x.volume ?? 0), 0) / 20;
          return {
            ...d,
            dateStr: format(new Date(d.time * 1000), 'MMM dd'),
            ma20: sma(20),
            ma50: sma(50),
            volumeMa: volMa,
          };
        }));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const mainChartRef     = useRef<IChartApi | null>(null);
  const candleSeriesRef  = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma20SeriesRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50SeriesRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef       = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef       = useRef<ISeriesApi<'Line'> | null>(null);

  const volContainerRef  = useRef<HTMLDivElement>(null);
  const volChartRef      = useRef<IChartApi | null>(null);
  const volSeriesRef     = useRef<ISeriesApi<'Histogram'> | null>(null);
  const volMaSeriesRef   = useRef<ISeriesApi<'Line'> | null>(null);

  const rsiContainerRef  = useRef<HTMLDivElement>(null);
  const rsiChartRef      = useRef<IChartApi | null>(null);
  const rsiSeriesRef     = useRef<ISeriesApi<'Line'> | null>(null);

  const macdContainerRef = useRef<HTMLDivElement>(null);
  const macdChartRef     = useRef<IChartApi | null>(null);
  const macdHistRef      = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdLineRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef    = useRef<ISeriesApi<'Line'> | null>(null);

  const stochContainerRef = useRef<HTMLDivElement>(null);
  const stochChartRef     = useRef<IChartApi | null>(null);
  const stochKRef         = useRef<ISeriesApi<'Line'> | null>(null);
  const stochDRef         = useRef<ISeriesApi<'Line'> | null>(null);

  const mfiContainerRef   = useRef<HTMLDivElement>(null);
  const mfiChartRef       = useRef<IChartApi | null>(null);
  const mfiSeriesRef      = useRef<ISeriesApi<'Line'> | null>(null);

  const obvContainerRef   = useRef<HTMLDivElement>(null);
  const obvChartRef       = useRef<IChartApi | null>(null);
  const obvSeriesRef      = useRef<ISeriesApi<'Area'> | null>(null);

  const allCharts = useRef<IChartApi[]>([]);

  // Force-resize a chart to match its container's actual rendered size.
  // autoSize alone can fail to pick up the correct size when the container
  // mounts inside a modal/tab that has zero size on the first paint frame
  // (e.g. CSS transition, conditional render). ResizeObserver + a manual
  // resize() call right after creation makes this reliable.
  const attachResizeObserver = useCallback((container: HTMLDivElement, chart: IChartApi, height: number) => {
    const resize = () => {
      const w = container.clientWidth;
      if (w > 0) chart.resize(w, height);
    };
    resize();
    // Run again on next frame in case layout wasn't finalized yet (modal animations etc.)
    requestAnimationFrame(resize);
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const baseChartOptions = useCallback((height: number) => ({
    layout: {
      background: { type: ColorType.Solid, color: CHART_BG },
      textColor: TEXT_COLOR,
      fontSize: 11,
    },
    grid: {
      vertLines: { color: GRID_COLOR },
      horzLines: { color: GRID_COLOR },
    },
    rightPriceScale: { borderColor: BORDER_COLOR },
    timeScale: { borderColor: BORDER_COLOR, timeVisible: false },
    crosshair: { mode: CrosshairMode.Normal },
    height,
  }), []);

  // ─── Build main candlestick chart (once) ─────────────────────────────────
  useEffect(() => {
    if (!mainContainerRef.current) return;
    const container = mainContainerRef.current;
    const chart = createChart(container, baseChartOptions(PANEL_HEIGHT_MAIN));
    mainChartRef.current = chart;
    allCharts.current.push(chart);
    const detachResize = attachResizeObserver(container, chart, PANEL_HEIGHT_MAIN);

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR, downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR, borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR, wickDownColor: DOWN_COLOR,
    });
    candleSeriesRef.current = candle;

    ma20SeriesRef.current = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ma50SeriesRef.current = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    bbUpperRef.current  = chart.addSeries(LineSeries, { color: '#a78bfa80', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    bbMiddleRef.current = chart.addSeries(LineSeries, { color: '#a78bfa40', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    bbLowerRef.current  = chart.addSeries(LineSeries, { color: '#a78bfa80', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });

    chart.subscribeCrosshairMove(param => {
      setHoverTime(param.time ? (param.time as number) : null);
    });

    return () => { detachResize(); chart.remove(); allCharts.current = allCharts.current.filter(c => c !== chart); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve hovered data point from time (avoids stale closure in crosshair handler)
  useEffect(() => {
    if (hoverTime == null) { setHover(null); return; }
    setHover(chartData.find(p => p.time === hoverTime) ?? null);
  }, [hoverTime, chartData]);

  const buildSubChart = useCallback((
    containerRef: React.RefObject<HTMLDivElement | null>,
    chartRef: React.MutableRefObject<IChartApi | null>,
    visible: boolean,
    build: (chart: IChartApi) => void,
  ) => {
    if (!visible || !containerRef.current) {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
      return;
    }
    if (chartRef.current) return;
    const container = containerRef.current;
    const chart = createChart(container, baseChartOptions(PANEL_HEIGHT_SUB));
    chartRef.current = chart;
    allCharts.current.push(chart);
    attachResizeObserver(container, chart, PANEL_HEIGHT_SUB);
    build(chart);
  }, [baseChartOptions, attachResizeObserver]);

  useEffect(() => {
    buildSubChart(volContainerRef, volChartRef, showVolPanel, chart => {
      volSeriesRef.current   = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false });
      volMaSeriesRef.current = chart.addSeries(LineSeries, { color: '#f59e0baa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    });
  }, [showVolPanel, buildSubChart]);

  useEffect(() => {
    buildSubChart(rsiContainerRef, rsiChartRef, showRsiPanel, chart => {
      rsiSeriesRef.current = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 1.5, priceLineVisible: false });
      const ob = chart.addSeries(LineSeries, { color: '#f43f5e40', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
      const os = chart.addSeries(LineSeries, { color: '#10b98140', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
      ob.setData(chartData.map(d => ({ time: d.time as Time, value: 70 })));
      os.setData(chartData.map(d => ({ time: d.time as Time, value: 30 })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRsiPanel, buildSubChart]);

  useEffect(() => {
    buildSubChart(macdContainerRef, macdChartRef, showMacdPanel, chart => {
      macdHistRef.current   = chart.addSeries(HistogramSeries, { priceLineVisible: false });
      macdLineRef.current   = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1.5, priceLineVisible: false });
      macdSignalRef.current = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false });
    });
  }, [showMacdPanel, buildSubChart]);

  useEffect(() => {
    buildSubChart(stochContainerRef, stochChartRef, showStochPanel, chart => {
      stochKRef.current = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1.5, priceLineVisible: false });
      stochDRef.current = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false });
    });
  }, [showStochPanel, buildSubChart]);

  useEffect(() => {
    buildSubChart(mfiContainerRef, mfiChartRef, showMfiPanel, chart => {
      mfiSeriesRef.current = chart.addSeries(LineSeries, { color: '#ec4899', lineWidth: 1.5, priceLineVisible: false });
      const ob = chart.addSeries(LineSeries, { color: '#f43f5e40', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
      const os = chart.addSeries(LineSeries, { color: '#10b98140', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
      ob.setData(chartData.map(d => ({ time: d.time as Time, value: 80 })));
      os.setData(chartData.map(d => ({ time: d.time as Time, value: 20 })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMfiPanel, buildSubChart]);

  useEffect(() => {
    buildSubChart(obvContainerRef, obvChartRef, showObvPanel, chart => {
      obvSeriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: '#22d3ee', topColor: '#22d3ee33', bottomColor: '#22d3ee00', lineWidth: 1.5, priceLineVisible: false,
      });
    });
  }, [showObvPanel, buildSubChart]);

  // ─── Sync time scales across all visible charts ──────────────────────────
  useEffect(() => {
    const charts = allCharts.current;
    if (charts.length < 2) return;
    const unsubs: (() => void)[] = [];
    charts.forEach(src => {
      const handler = (range: { from: number; to: number } | null) => {
        if (!range) return;
        charts.forEach(dst => { if (dst !== src) dst.timeScale().setVisibleLogicalRange(range as never); });
      };
      src.timeScale().subscribeVisibleLogicalRangeChange(handler);
      unsubs.push(() => src.timeScale().unsubscribeVisibleLogicalRangeChange(handler));
    });
    return () => unsubs.forEach(u => u());
  }, [showVolPanel, showRsiPanel, showMacdPanel, showStochPanel, showMfiPanel, showObvPanel]);

  // ─── Push data into series whenever chartData or toggles change ─────────
  const [chartRenderError, setChartRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!chartData.length) return;
    try {
      setChartRenderError(null);

      // lightweight-charts requires data sorted ascending by time with no duplicate timestamps.
      const sorted = [...chartData].sort((a, b) => a.time - b.time);
      const deduped = sorted.filter((d, i) => i === 0 || d.time !== sorted[i - 1].time);

      candleSeriesRef.current?.setData(deduped.map(d => ({
        time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close,
      })));

      if (showMA20 && ma20SeriesRef.current) {
        ma20SeriesRef.current.setData(deduped.filter(d => d.ma20 != null).map(d => ({ time: d.time as Time, value: d.ma20! })));
      } else { ma20SeriesRef.current?.setData([]); }

      if (showMA50 && ma50SeriesRef.current) {
        ma50SeriesRef.current.setData(deduped.filter(d => d.ma50 != null).map(d => ({ time: d.time as Time, value: d.ma50! })));
      } else { ma50SeriesRef.current?.setData([]); }

      if (showBB) {
        bbUpperRef.current?.setData(deduped.filter(d => d.bbUpper != null).map(d => ({ time: d.time as Time, value: d.bbUpper! })));
        bbMiddleRef.current?.setData(deduped.filter(d => d.bbMiddle != null).map(d => ({ time: d.time as Time, value: d.bbMiddle! })));
        bbLowerRef.current?.setData(deduped.filter(d => d.bbLower != null).map(d => ({ time: d.time as Time, value: d.bbLower! })));
      } else {
        bbUpperRef.current?.setData([]); bbMiddleRef.current?.setData([]); bbLowerRef.current?.setData([]);
      }

      volSeriesRef.current?.setData(deduped.map(d => ({
        time: d.time as Time, value: d.volume ?? 0, color: d.close >= d.open ? `${UP_COLOR}55` : `${DOWN_COLOR}55`,
      })));
      volMaSeriesRef.current?.setData(deduped.filter(d => d.volumeMa != null).map(d => ({ time: d.time as Time, value: d.volumeMa! })));

      rsiSeriesRef.current?.setData(deduped.filter(d => d.rsi != null).map(d => ({ time: d.time as Time, value: d.rsi! })));

      macdHistRef.current?.setData(deduped.map(d => ({
        time: d.time as Time, value: d.macdHistogram ?? 0, color: (d.macdHistogram ?? 0) >= 0 ? `${UP_COLOR}88` : `${DOWN_COLOR}88`,
      })));
      macdLineRef.current?.setData(deduped.filter(d => d.macd != null).map(d => ({ time: d.time as Time, value: d.macd! })));
      macdSignalRef.current?.setData(deduped.filter(d => d.macdSignal != null).map(d => ({ time: d.time as Time, value: d.macdSignal! })));

      stochKRef.current?.setData(deduped.filter(d => d.stochK != null).map(d => ({ time: d.time as Time, value: d.stochK! })));
      stochDRef.current?.setData(deduped.filter(d => d.stochD != null).map(d => ({ time: d.time as Time, value: d.stochD! })));

      mfiSeriesRef.current?.setData(deduped.filter(d => d.mfi != null).map(d => ({ time: d.time as Time, value: d.mfi! })));
      obvSeriesRef.current?.setData(deduped.filter(d => d.obv != null).map(d => ({ time: d.time as Time, value: d.obv! })));

      mainChartRef.current?.timeScale().fitContent();
    } catch (e) {
      setChartRenderError(e instanceof Error ? e.message : 'Lỗi không xác định khi vẽ biểu đồ');
    }
  }, [chartData, showMA20, showMA50, showBB]);

  const panelToggles = [
    { label: 'Vol',   color: '#64748b', active: showVolPanel,   set: setShowVolPanel   },
    { label: 'RSI',   color: '#a78bfa', active: showRsiPanel,   set: setShowRsiPanel   },
    { label: 'MACD',  color: '#3b82f6', active: showMacdPanel,  set: setShowMacdPanel  },
    { label: 'Stoch', color: '#f59e0b', active: showStochPanel, set: setShowStochPanel },
    { label: 'MFI',   color: '#ec4899', active: showMfiPanel,   set: setShowMfiPanel   },
    { label: 'OBV',   color: '#22d3ee', active: showObvPanel,   set: setShowObvPanel   },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <RefreshCw size={16} className="animate-spin" /> Đang tải biểu đồ {ticker}...
      </div>
    );
  }
  if (error) {
    return <div className="text-center py-20 text-rose-400 text-sm">Lỗi tải dữ liệu: {error}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BarChart2 className="text-blue-400" /> {ticker} — 6 Months
          {hover && (
            <span className="text-xs font-normal text-slate-400 ml-2 font-mono">
              O <span className="text-slate-200">{hover.open.toLocaleString()}</span>{' '}
              H <span className="text-emerald-400">{hover.high.toLocaleString()}</span>{' '}
              L <span className="text-rose-400">{hover.low.toLocaleString()}</span>{' '}
              C <span className={hover.close >= hover.open ? 'text-emerald-400' : 'text-rose-400'}>{hover.close.toLocaleString()}</span>
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          {panelToggles.map(({ label, color, active, set }) => (
            <button key={label} onClick={() => set(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${active ? 'border-transparent' : 'border-slate-600 opacity-40'}`}
              style={active ? { backgroundColor: color + '22', color, borderColor: color + '55' } : {}}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? color : '#475569' }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {chartRenderError && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-3">
          Lỗi vẽ biểu đồ: {chartRenderError}
        </div>
      )}

      <div ref={mainContainerRef} className="w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: PANEL_HEIGHT_MAIN }} />

      {showVolPanel && (
        <div className="mt-1.5">
          <p className="text-[10px] text-slate-500 px-1 mb-0.5">Volume</p>
          <div ref={volContainerRef} className="w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: PANEL_HEIGHT_SUB }} />
        </div>
      )}
      {showRsiPanel && (
        <div className="mt-1.5">
          <p className="text-[10px] text-slate-500 px-1 mb-0.5">RSI (14)</p>
          <div ref={rsiContainerRef} className="w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: PANEL_HEIGHT_SUB }} />
        </div>
      )}
      {showMacdPanel && (
        <div className="mt-1.5">
          <p className="text-[10px] text-slate-500 px-1 mb-0.5">MACD (12,26,9)</p>
          <div ref={macdContainerRef} className="w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: PANEL_HEIGHT_SUB }} />
        </div>
      )}
      {showStochPanel && (
        <div className="mt-1.5">
          <p className="text-[10px] text-slate-500 px-1 mb-0.5">Stochastic RSI</p>
          <div ref={stochContainerRef} className="w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: PANEL_HEIGHT_SUB }} />
        </div>
      )}
      {showMfiPanel && (
        <div className="mt-1.5">
          <p className="text-[10px] text-slate-500 px-1 mb-0.5">MFI (14)</p>
          <div ref={mfiContainerRef} className="w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: PANEL_HEIGHT_SUB }} />
        </div>
      )}
      {showObvPanel && (
        <div className="mt-1.5">
          <p className="text-[10px] text-slate-500 px-1 mb-0.5">OBV</p>
          <div ref={obvContainerRef} className="w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: PANEL_HEIGHT_SUB }} />
        </div>
      )}
    </div>
  );
}
