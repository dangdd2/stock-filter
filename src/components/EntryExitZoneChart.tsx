"use client";

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  YAxis, ReferenceArea, ReferenceLine, Tooltip,
} from 'recharts';
import type { EntryExitResult } from '@/app/api/entry-exit/[ticker]/route';

interface Props {
  closes: number[];        // recent closes (e.g. last 60-90 days), oldest -> newest
  currentPrice: number;
  entryZones: EntryExitResult['entryZones'];
  exitZones: EntryExitResult['exitZones'];
  stopLoss: EntryExitResult['stopLoss'];
  support: number[];
  resistance: number[];
}

const ENTRY_ZONE_COLOR: Record<string, string> = {
  AGGRESSIVE:   '#a78bfa',
  CONSERVATIVE: '#60a5fa',
  BREAKOUT:     '#34d399',
};

const fmt = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

export default function EntryExitZoneChart({
  closes, currentPrice, entryZones, exitZones, stopLoss, support, resistance,
}: Props) {
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  const data = useMemo(() => {
    const series = closes.length > 0 ? closes : [currentPrice];
    return series.map((c, i) => ({ i, price: c }));
  }, [closes, currentPrice]);

  const targets = exitZones.filter(z => z.type.startsWith('TARGET'));

  // Y-axis ticks: every key price level becomes a labeled tick, deduped & sorted.
  const { yMin, yMax, priceTicks } = useMemo(() => {
    const all: number[] = [...closes, currentPrice, stopLoss.price];
    entryZones.forEach(z => all.push(z.priceFrom, z.priceTo));
    targets.forEach(t => all.push(t.price));
    support.slice(0, 2).forEach(s => all.push(s));
    resistance.slice(0, 2).forEach(r => all.push(r));

    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.08 || max * 0.02;

    const keyLevels = Array.from(new Set([
      currentPrice, stopLoss.price,
      ...entryZones.flatMap(z => [z.priceFrom, z.priceTo]),
      ...targets.map(t => t.price),
    ])).sort((a, b) => a - b);

    return { yMin: min - pad, yMax: max + pad, priceTicks: keyLevels };
  }, [closes, currentPrice, stopLoss, entryZones, targets, support, resistance]);

  const sortedEntries = [...entryZones].sort((a, b) => a.priority - b.priority);

  return (
    <div className="w-full">
      <div className="w-full" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 64, left: 0, bottom: 4 }}
            onMouseMove={(s) => {
              const p = s?.activePayload?.[0]?.payload as { price: number } | undefined;
              setHoverPrice(p ? p.price : null);
            }}
            onMouseLeave={() => setHoverPrice(null)}
          >
            <YAxis
              domain={[yMin, yMax]}
              orientation="right"
              width={58}
              ticks={priceTicks}
              stroke="#475569"
              fontSize={9}
              tickFormatter={fmt}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={() => null} cursor={{ stroke: '#64748b', strokeDasharray: '2 2' }} />

            {entryZones.map((z, i) => (
              <ReferenceArea
                key={`entry-${i}`}
                y1={Math.min(z.priceFrom, z.priceTo)}
                y2={Math.max(z.priceFrom, z.priceTo)}
                fill={ENTRY_ZONE_COLOR[z.type] ?? '#60a5fa'}
                fillOpacity={0.1}
                stroke={ENTRY_ZONE_COLOR[z.type] ?? '#60a5fa'}
                strokeOpacity={0.3}
                strokeWidth={1}
                strokeDasharray="3 3"
                ifOverflow="extendDomain"
              />
            ))}

            <ReferenceArea
              y1={Math.min(stopLoss.price, currentPrice)}
              y2={stopLoss.price}
              fill="#f43f5e"
              fillOpacity={0.06}
              ifOverflow="extendDomain"
            />
            <ReferenceLine y={stopLoss.price} stroke="#f43f5e" strokeWidth={1.25} strokeDasharray="4 3" />

            {targets.map((t, i) => (
              <ReferenceLine key={`target-${i}`} y={t.price} stroke="#34d399" strokeWidth={1.25} strokeDasharray="4 3" />
            ))}

            {support.slice(0, 2).map((s, i) => (
              <ReferenceLine key={`sup-${i}`} y={s} stroke="#22c55e" strokeOpacity={0.3} strokeWidth={1} />
            ))}
            {resistance.slice(0, 2).map((r, i) => (
              <ReferenceLine key={`res-${i}`} y={r} stroke="#ef4444" strokeOpacity={0.3} strokeWidth={1} />
            ))}

            <ReferenceLine y={currentPrice} stroke="#f8fafc" strokeWidth={1.25} />

            <defs>
              <linearGradient id="eePriceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="price" stroke="none" fill="url(#eePriceFill)" isAnimationActive={false} />
            <Line type="monotone" dataKey="price" stroke="#93c5fd" strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-4 px-1 -mt-1">
        {hoverPrice != null && (
          <span className="text-[10px] text-slate-400 font-mono">Giá tại điểm trỏ: {fmt(hoverPrice)}</span>
        )}
      </div>

      <div className="mt-2 space-y-1">
        {sortedEntries.map((z, i) => (
          <div key={`e-${i}`} className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ENTRY_ZONE_COLOR[z.type] ?? '#60a5fa' }} />
            <span className="text-slate-300 font-medium shrink-0">{z.label}</span>
            <span className="text-slate-500 truncate flex-1">{z.reason}</span>
            <span className="font-mono text-slate-200 shrink-0">{fmt(z.priceFrom)}-{fmt(z.priceTo)}</span>
          </div>
        ))}
        {targets.map((t, i) => (
          <div key={`t-${i}`} className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: '#34d399' }} />
            <span className="text-slate-300 font-medium shrink-0">{t.label}</span>
            <span className="text-slate-500 truncate flex-1">{t.reason}</span>
            <span className="font-mono text-emerald-300 shrink-0">{fmt(t.price)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: '#f43f5e' }} />
          <span className="text-slate-300 font-medium shrink-0">Dừng lỗ</span>
          <span className="text-slate-500 truncate flex-1">{stopLoss.reason}</span>
          <span className="font-mono text-rose-300 shrink-0">{fmt(stopLoss.price)}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] pt-1 border-t border-slate-700/50">
          <span className="w-2 h-2 rounded-sm shrink-0 bg-slate-100" />
          <span className="text-slate-300 font-medium shrink-0">Giá hiện tại</span>
          <span className="flex-1" />
          <span className="font-mono text-slate-100 font-bold shrink-0">{fmt(currentPrice)}</span>
        </div>
      </div>
    </div>
  );
}
