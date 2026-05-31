"use client";

import { Info, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';
import type { GuideBlock } from './guideData';

// ── Tip Box ───────────────────────────────────────────────────
export function TipBox({ variant, text }: { variant: 'info' | 'warning' | 'pro'; text: string }) {
  const cfg = {
    info:    { icon: Info,          bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-300',   label: 'Lưu ý' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-300',  label: 'Cảnh báo' },
    pro:     { icon: Zap,           bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-300', label: 'Pro Tip' },
  }[variant];
  const Icon = cfg.icon;
  return (
    <div className={`flex gap-3 p-3.5 rounded-xl border ${cfg.bg} ${cfg.border} my-4`}>
      <Icon size={16} className={`${cfg.text} shrink-0 mt-0.5`} />
      <div>
        <span className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label} </span>
        <span className="text-sm text-slate-300">{text}</span>
      </div>
    </div>
  );
}

// ── Step List ─────────────────────────────────────────────────
export function StepList({ items }: { items: { title: string; desc: string; tip?: string }[] }) {
  return (
    <ol className="my-4 space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300">
            {i + 1}
          </div>
          <div className="flex-1 pt-0.5">
            <p className="text-sm font-semibold text-slate-100 mb-1">{item.title}</p>
            <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
            {item.tip && (
              <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 size={11} /> {item.tip}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Data Table ────────────────────────────────────────────────
export function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900/60 border-b border-slate-700">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-800/40 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 text-slate-300 leading-relaxed ${j === 0 ? 'font-semibold text-slate-100 whitespace-nowrap' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Feature Grid ──────────────────────────────────────────────
export function FeatureGrid({ items }: { items: { icon: string; title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-4">
      {items.map((item, i) => (
        <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-colors">
          <div className="text-2xl mb-2">{item.icon}</div>
          <p className="text-sm font-semibold text-slate-200 mb-1">{item.title}</p>
          <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ── Annotated Image ───────────────────────────────────────────
export function AnnotatedImage({ src, alt, annotations }: {
  src: string; alt: string;
  annotations: { x: number; y: number; label: string; color: string; position: string }[];
}) {
  const colorMap: Record<string, { dot: string; bg: string; text: string; border: string }> = {
    blue:   { dot: 'bg-blue-400',   bg: 'bg-blue-500/90',   text: 'text-white', border: 'border-blue-400' },
    green:  { dot: 'bg-emerald-400',bg: 'bg-emerald-500/90',text: 'text-white', border: 'border-emerald-400' },
    red:    { dot: 'bg-rose-400',   bg: 'bg-rose-500/90',   text: 'text-white', border: 'border-rose-400' },
    yellow: { dot: 'bg-yellow-400', bg: 'bg-yellow-500/90', text: 'text-slate-900', border: 'border-yellow-400' },
    purple: { dot: 'bg-violet-400', bg: 'bg-violet-500/90', text: 'text-white', border: 'border-violet-400' },
  };

  const posClass: Record<string, string> = {
    top:    'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left:   'right-full mr-2 top-1/2 -translate-y-1/2',
    right:  'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-slate-700 bg-slate-900/40">
      <div className="relative">
        {/* Fallback placeholder when no screenshot yet */}
        <div className="w-full bg-slate-800 flex items-center justify-center"
          style={{ minHeight: 240 }}>
          <img
            src={src}
            alt={alt}
            className="w-full h-auto block"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-600 text-sm italic">Screenshot: {alt}</p>
          </div>
        </div>

        {/* Annotation dots */}
        {annotations.map((ann, i) => {
          const c = colorMap[ann.color] ?? colorMap.blue;
          return (
            <div
              key={i}
              className="absolute group"
              style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              {/* Pulsing dot */}
              <span className={`relative flex h-5 w-5 cursor-pointer`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-50`} />
                <span className={`relative inline-flex rounded-full h-5 w-5 ${c.dot} border-2 border-white/30 items-center justify-center text-[9px] font-bold text-white`}>
                  {i + 1}
                </span>
              </span>
              {/* Tooltip */}
              <div className={`absolute z-10 hidden group-hover:block ${posClass[ann.position] ?? posClass.bottom} w-max max-w-[180px]`}>
                <div className={`${c.bg} ${c.text} text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-normal leading-snug border ${c.border}`}>
                  {ann.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Caption */}
      <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 italic">{alt}</span>
        {annotations.length > 0 && (
          <span className="text-[10px] text-slate-600">Hover lên số để xem chú thích</span>
        )}
      </div>
    </div>
  );
}

// ── Block renderer ────────────────────────────────────────────
export function BlockRenderer({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="text-sm text-slate-300 leading-relaxed my-3">{block.text}</p>;
    case 'steps':
      return <StepList items={block.items} />;
    case 'table':
      return <DataTable headers={block.headers} rows={block.rows} />;
    case 'tip':
      return <TipBox variant={block.variant} text={block.text} />;
    case 'annotated-image':
      return <AnnotatedImage src={block.src} alt={block.alt} annotations={block.annotations} />;
    case 'feature-grid':
      return <FeatureGrid items={block.items} />;
    case 'code':
      return (
        <pre className="my-3 p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-emerald-300 overflow-x-auto font-mono">
          {block.text}
        </pre>
      );
    default:
      return null;
  }
}
