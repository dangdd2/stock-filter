"use client";

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, ReferenceArea, ReferenceLine, Tooltip,
} from 'recharts';
import type { EntryExitResult } from '@/app/api/entry-exit/[ticker]/route';

interface Props {
  closes: number[];        // recent closes (e.g. last 60-90 days), oldest → newest
  currentPrice: number;
  entryZones: EntryExitResult['entryZones'];
  exitZones: EntryExitResult['exitZones'];
  stopLoss: EntryExitResult['stopLoss'];
  support: number[];
  resistance: number[];
}

const ENTRY_ZONE_FILL: Record<string, string> = {
  AGGRESSIVE:   '#8b5cf6',
  CONSERVATIVE: '#3b82f6',
  BREAKOUT:     '#10b981',
};

export default function EntryExitZoneChart({
  closes, currentPrice, entryZones, exitZones, stopLoss, support, resistance,
}: Props) {
  const data = useMemo(() => {
    const series = closes.length > 0 ? closes : [currentPrice];
    return series.map((c, i) => ({ i, price: c }));
  }, [closes, currentPrice]);

  // Determine overall Y domain so all zones (entry/target/stop) are visible even if outside historical range
  const { yMin, yMax } = useMemo(() => {
    const all: number[] = [...closes, currentPrice, stopLoss.price];
    entryZones.forEach(z => { all.push(z.priceFrom, z.priceTo); });
    exitZones.forEach(z => { all.push(z.price); });
    support.forEach(s => all.push(s));
    resistance.forEach(r => all.push(r));
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.06 || max * 0.02;
    return { yMin: min - pad, yMax: max + pad };
  }, [closes, currentPrice, stopLoss, entryZones, exitZones, support, resistance]);

  const targets = exitZones.filter(z => z.type.startsWith('TARGET'));
  const lastIdx = data.length - 1;

  return (
    <div className="w-full" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 56, left: 0, bottom: 0 }}>
          <XAxis dataKey="i" hide />
          <YAxis domain={[yMin, yMax]} orientation="right" width={56} stroke="#64748b" fontSize={10}
            tickFormatter={v => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const p = payload[0].payload as { price: number };
              return (
                <div className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-[11px] text-slate-200 font-mono">
                  {p.price.toLocaleString('vi-VN')}
                </div>
              );
            }}
          />

          {/* Entry zones — bands behind the price line */}
          {entryZones.map((z, i) => (
            <ReferenceArea
              key={`entry-${i}`}
              y1={Math.min(z.priceFrom, z.priceTo)}
              y2={Math.max(z.priceFrom, z.priceTo)}
              fill={ENTRY_ZONE_FILL[z.type] ?? '#3b82f6'}
              fillOpacity={0.12}
              stroke={ENTRY_ZONE_FILL[z.type] ?? '#3b82f6'}
              strokeOpacity={0.35}
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
              label={{
                value: z.label,
                position: 'insideLeft',
                fill: ENTRY_ZONE_FILL[z.type] ?? '#3b82f6',
                fontSize: 9,
                fontWeight: 700,
              }}
            />
          ))}

          {/* Stop loss zone — red band below entry */}
          <ReferenceArea
            y1={Math.min(stopLoss.price, currentPrice)}
            y2={stopLoss.price}
            fill="#f43f5e"
            fillOpacity={0.08}
            ifOverflow="extendDomain"
          />
          <ReferenceLine
            y={stopLoss.price}
            stroke="#f43f5e"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            label={{ value: `SL ${stopLoss.price.toLocaleString('vi-VN')}`, position: 'insideBottomLeft', fill: '#fb7185', fontSize: 9, fontWeight: 700 }}
          />

          {/* Target lines */}
          {targets.map((t, i) => (
            <ReferenceLine
              key={`target-${i}`}
              y={t.price}
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              label={{ value: `${t.label} ${t.price.toLocaleString('vi-VN')}`, position: 'insideTopLeft', fill: '#34d399', fontSize: 9, fontWeight: 700 }}
            />
          ))}

          {/* Support / resistance thin lines */}
          {support.slice(0, 2).map((s, i) => (
            <ReferenceLine key={`sup-${i}`} y={s} stroke="#22c55e" strokeOpacity={0.4} strokeWidth={1} />
          ))}
          {resistance.slice(0, 2).map((r, i) => (
            <ReferenceLine key={`res-${i}`} y={r} stroke="#ef4444" strokeOpacity={0.4} strokeWidth={1} />
          ))}

          {/* Current price line */}
          <ReferenceLine
            y={currentPrice}
            stroke="#f8fafc"
            strokeWidth={1.5}
            label={{ value: `Hiện tại ${currentPrice.toLocaleString('vi-VN')}`, position: 'right', fill: '#f8fafc', fontSize: 9, fontWeight: 700 }}
          />

          {/* Price area + line */}
          <defs>
            <linearGradient id="eePriceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="price" stroke="none" fill="url(#eePriceFill)" isAnimationActive={false} />
          <Line type="monotone" dataKey="price" stroke="#93c5fd" strokeWidth={1.75} dot={false} isAnimationActive={false} />

          {/* Marker dot at last close */}
          {lastIdx >= 0 && (
            <ReferenceLine x={lastIdx} stroke="transparent" />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap mt-1 px-1">
        <LegendDot color="#8b5cf6" label="Tích cực" />
        <LegendDot color="#3b82f6" label="Thận trọng" />
        <LegendDot color="#10b981" label="Breakout / Target" />
        <LegendDot color="#f43f5e" label="Dừng lỗ" />
        <LegendDot color="#f8fafc" label="Giá hiện tại" dashed={false} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}
