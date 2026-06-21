"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { RefreshCw, BarChart2 } from 'lucide-react';
import {
  createChart, ColorType, CrosshairMode,
  type IChartApi, type ISeriesApi, type Time,
  CandlestickSeries, HistogramSeries, LineSeries,
} from 'lightweight-charts';

interface ChartDataPoint {
  time: number; open: number; high: number; low: number; close: number;
  dateStr: string;
  ma20?: number; ma50?: number;
  volume?: number;
}

const CHART_BG     = '#0f172a';
const GRID_COLOR   = '#1e293b';
const TEXT_COLOR   = '#94a3b8';
const BORDER_COLOR = '#334155';
const UP_COLOR     = '#10b981';
const DOWN_COLOR   = '#f43f5e';
const CHART_HEIGHT = 460;

export default function ChartView({ ticker }: { ticker: string }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [hover, setHover]         = useState<ChartDataPoint | null>(null);

  // ─── Fetch + compute MA client-side ──────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/chart/${ticker}`)
      .then(r => { if (!r.ok) throw new Error('Failed to fetch chart data'); return r.json(); })
      .then((json: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>) => {
        setChartData(json.map((d, i, arr) => {
          const sma = (period: number) => {
            if (i < period - 1) return undefined;
            return arr.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period;
          };
          return {
            time: d.time, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
            dateStr: format(new Date(d.time * 1000), 'MMM dd'),
            ma20: sma(20),
            ma50: sma(50),
          };
        }));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  const containerRef    = useRef<HTMLDivElement>(null);
  const chartRef        = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma20SeriesRef   = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50SeriesRef   = useRef<ISeriesApi<'Line'> | null>(null);
  const volSeriesRef    = useRef<ISeriesApi<'Histogram'> | null>(null);

  // ─── Build the chart once on mount ───────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: CHART_BG }, textColor: TEXT_COLOR, fontSize: 11 },
      grid: { vertLines: { color: GRID_COLOR }, horzLines: { color: GRID_COLOR } },
      rightPriceScale: { borderColor: BORDER_COLOR },
      timeScale: { borderColor: BORDER_COLOR },
      crosshair: { mode: CrosshairMode.Normal },
      width: container.clientWidth || 600,
      height: CHART_HEIGHT,
    });
    chartRef.current = chart;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR, downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR, borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR, wickDownColor: DOWN_COLOR,
    });
    candleSeriesRef.current = candle;

    ma20SeriesRef.current = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ma50SeriesRef.current = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

    // Volume as an overlay at the bottom of the SAME chart (own price scale, margin pushes it down)
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    chart.subscribeCrosshairMove(param => {
      if (!param.time) { setHover(null); return; }
      // resolved against chartData via separate effect below using a ref to avoid stale closures
      setHoverTimeRef.current(param.time as number);
    });

    // Resize: force correct size on mount + observe container changes
    const doResize = () => {
      const w = container.clientWidth;
      if (w > 0) chart.applyOptions({ width: w, height: CHART_HEIGHT });
    };
    doResize();
    requestAnimationFrame(doResize);
    const ro = new ResizeObserver(doResize);
    ro.observe(container);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve hover time -> data point (avoids stale closures inside the chart's own effect)
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const setHoverTimeRef = useRef((t: number | null) => setHoverTime(t));
  useEffect(() => { setHoverTimeRef.current = (t: number | null) => setHoverTime(t); });
  useEffect(() => {
    setHover(hoverTime == null ? null : (chartData.find(p => p.time === hoverTime) ?? null));
  }, [hoverTime, chartData]);

  // ─── Push data whenever it changes ───────────────────────────────────────
  useEffect(() => {
    if (!chartData.length || !chartRef.current) return;
    try {
      setRenderError(null);

      const sorted = [...chartData].sort((a, b) => a.time - b.time);
      const deduped = sorted.filter((d, i) => i === 0 || d.time !== sorted[i - 1].time);

      candleSeriesRef.current?.setData(deduped.map(d => ({
        time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close,
      })));
      ma20SeriesRef.current?.setData(deduped.filter(d => d.ma20 != null).map(d => ({ time: d.time as Time, value: d.ma20! })));
      ma50SeriesRef.current?.setData(deduped.filter(d => d.ma50 != null).map(d => ({ time: d.time as Time, value: d.ma50! })));
      volSeriesRef.current?.setData(deduped.map(d => ({
        time: d.time as Time, value: d.volume ?? 0, color: d.close >= d.open ? `${UP_COLOR}66` : `${DOWN_COLOR}66`,
      })));

      chartRef.current.timeScale().fitContent();
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : 'Lỗi không xác định khi vẽ biểu đồ');
    }
  }, [chartData]);

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
              {hover.volume != null && (
                <> {' '}Vol <span className="text-slate-300">{(hover.volume / 1e6).toFixed(2)}M</span></>
              )}
            </span>
          )}
        </h3>
      </div>

      {renderError && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-3">
          Lỗi vẽ biểu đồ: {renderError}
        </div>
      )}

      <div ref={containerRef} className="w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: CHART_HEIGHT }} />
    </div>
  );
}
