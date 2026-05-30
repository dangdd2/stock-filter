// ─────────────────────────────────────────────────────────────
// Advanced Screener — pure logic layer
// ─────────────────────────────────────────────────────────────

import type { StockIndicatorResult } from '@/app/page';

// ── Field registry ────────────────────────────────────────────

export type FieldKey =
  | 'price' | 'changePct' | 'volume'
  | 'rsi' | 'stochK' | 'stochD'
  | 'macd' | 'macdHistogram' | 'bbPct'
  | 'mfi' | 'obvTrend' | 'relVolume' | 'avgVolume20dK'
  | 'change1w' | 'change1m' | 'change3m' | 'change6m'
  | 'distFromHigh' | 'distFromLow'
  | 'consecutiveUp' | 'consecutiveDown'
  | 'pe' | 'eps' | 'beta' | 'marketCapB';

export interface FieldMeta {
  label: string; unit: string; min: number; max: number;
  step: number; decimals: number; group: string;
}

export const FIELD_META: Record<FieldKey, FieldMeta> = {
  // Kỹ thuật
  price:         { label:'Giá hiện tại',        unit:'VND', min:0,    max:200000, step:500,  decimals:0, group:'Kỹ thuật' },
  changePct:     { label:'% Thay đổi hôm nay',  unit:'%',   min:-20,  max:20,     step:0.5,  decimals:1, group:'Kỹ thuật' },
  volume:        { label:'Volume',               unit:'K',   min:0,    max:50000,  step:100,  decimals:0, group:'Kỹ thuật' },
  rsi:           { label:'RSI (14)',              unit:'',    min:0,    max:100,    step:1,    decimals:0, group:'Kỹ thuật' },
  stochK:        { label:'Stoch %K',             unit:'',    min:0,    max:100,    step:1,    decimals:0, group:'Kỹ thuật' },
  stochD:        { label:'Stoch %D',             unit:'',    min:0,    max:100,    step:1,    decimals:0, group:'Kỹ thuật' },
  macd:          { label:'MACD',                 unit:'',    min:-500, max:500,    step:1,    decimals:2, group:'Kỹ thuật' },
  macdHistogram: { label:'MACD Histogram',       unit:'',    min:-500, max:500,    step:1,    decimals:2, group:'Kỹ thuật' },
  bbPct:         { label:'BB %B',                unit:'%',   min:-50,  max:150,    step:5,    decimals:0, group:'Kỹ thuật' },
  // Dòng tiền
  mfi:           { label:'MFI (14)',              unit:'',    min:0,    max:100,    step:1,    decimals:0, group:'Dòng tiền' },
  obvTrend:      { label:'OBV Trend (momentum)', unit:'',    min:-1e8, max:1e8,    step:1e5,  decimals:0, group:'Dòng tiền' },
  relVolume:     { label:'Volume tương đối',      unit:'x',   min:0,    max:10,     step:0.5,  decimals:1, group:'Dòng tiền' },
  avgVolume20dK: { label:'Volume TB 20 ngày',     unit:'K',   min:0,    max:50000,  step:100,  decimals:0, group:'Dòng tiền' },
  // Thống kê giá
  change1w:      { label:'Thay đổi 1 tuần',   unit:'%', min:-50,  max:50,   step:1,   decimals:1, group:'Thống kê giá' },
  change1m:      { label:'Thay đổi 1 tháng',  unit:'%', min:-80,  max:80,   step:1,   decimals:1, group:'Thống kê giá' },
  change3m:      { label:'Thay đổi 3 tháng',  unit:'%', min:-80,  max:100,  step:5,   decimals:1, group:'Thống kê giá' },
  change6m:      { label:'Thay đổi 6 tháng',  unit:'%', min:-80,  max:200,  step:5,   decimals:1, group:'Thống kê giá' },
  distFromHigh:  { label:'% dưới đỉnh 6T',    unit:'%', min:-100, max:0,    step:1,   decimals:1, group:'Thống kê giá' },
  distFromLow:   { label:'% trên đáy 6T',     unit:'%', min:0,    max:300,  step:5,   decimals:1, group:'Thống kê giá' },
  consecutiveUp:   { label:'Phiên tăng liên tiếp', unit:'phiên', min:0, max:20, step:1, decimals:0, group:'Thống kê giá' },
  consecutiveDown: { label:'Phiên giảm liên tiếp', unit:'phiên', min:0, max:20, step:1, decimals:0, group:'Thống kê giá' },
  // Cơ bản
  pe:          { label:'P/E',     unit:'x',   min:0,     max:100,    step:1,    decimals:1, group:'Cơ bản' },
  eps:         { label:'EPS',     unit:'VND', min:-5000, max:20000,  step:100,  decimals:0, group:'Cơ bản' },
  beta:        { label:'Beta',    unit:'',    min:-2,    max:5,      step:0.1,  decimals:1, group:'Cơ bản' },
  marketCapB:  { label:'Vốn hoá', unit:'tỷ',  min:0,     max:500000, step:1000, decimals:0, group:'Cơ bản' },
};

export type Operator = '<' | '<=' | '>' | '>=' | '==' | 'between';
export type Logic    = 'AND' | 'OR';

export interface Condition {
  id: string; field: FieldKey; op: Operator;
  value: number; value2?: number; logic: Logic;
}

export interface Preset {
  id: string; name: string; emoji: string; desc: string;
  conditions: Omit<Condition, 'id'>[];
}

// ── Built-in presets ──────────────────────────────────────────

export const BUILT_IN_PRESETS: Preset[] = [
  // ── Oversold / Reversal ──────────────────────────────────
  {
    id: 'deep_oversold',
    name: 'Deep Oversold',       emoji: '🔥',
    desc: 'RSI + Stoch + BB đều quá bán — cơ hội bật mạnh',
    conditions: [
      { field:'rsi',    op:'<', value:32, logic:'AND' },
      { field:'stochK', op:'<', value:22, logic:'AND' },
      { field:'bbPct',  op:'<', value:5,  logic:'AND' },
    ],
  },
  {
    id: 'mfi_oversold',
    name: 'Dòng Tiền Quá Bán',   emoji: '💧',
    desc: 'MFI < 20 + RSI oversold — dòng tiền rút lui quá mức, khả năng đảo chiều',
    conditions: [
      { field:'mfi',    op:'<', value:20, logic:'AND' },
      { field:'rsi',    op:'<', value:35, logic:'AND' },
    ],
  },
  {
    id: 'mfi_exit_oversold',
    name: 'MFI Thoát Quá Bán',   emoji: '🌊',
    desc: 'MFI vừa thoát khỏi vùng quá bán (>20) + RSI bắt đầu phục hồi — tín hiệu mua sớm',
    conditions: [
      { field:'mfi',    op:'>',  value:20, logic:'AND' },
      { field:'mfi',    op:'<',  value:35, logic:'AND' },
      { field:'rsi',    op:'>',  value:30, logic:'AND' },
      { field:'rsi',    op:'<',  value:50, logic:'AND' },
    ],
  },
  // ── Overbought / Exit ─────────────────────────────────────
  {
    id: 'overbought_exit',
    name: 'Overbought Exit',     emoji: '⚠️',
    desc: 'RSI + Stoch + BB quá mua — cân nhắc chốt lời',
    conditions: [
      { field:'rsi',    op:'>', value:70, logic:'AND' },
      { field:'stochK', op:'>', value:80, logic:'AND' },
      { field:'bbPct',  op:'>', value:95, logic:'AND' },
    ],
  },
  {
    id: 'mfi_overbought',
    name: 'Dòng Tiền Quá Mua',   emoji: '🚨',
    desc: 'MFI > 80 + giá trên BB upper — dòng tiền nóng, rủi ro cao',
    conditions: [
      { field:'mfi',   op:'>', value:80,  logic:'AND' },
      { field:'bbPct', op:'>', value:100, logic:'AND' },
    ],
  },
  // ── Momentum / Trend ─────────────────────────────────────
  {
    id: 'momentum_confirm',
    name: 'Momentum Xác Nhận',   emoji: '🚀',
    desc: 'MACD dương + RSI 50-70 + MFI tăng — xu hướng tăng mạnh có dòng tiền',
    conditions: [
      { field:'macdHistogram', op:'>', value:0,  logic:'AND' },
      { field:'rsi',           op:'>', value:50, logic:'AND' },
      { field:'rsi',           op:'<', value:70, logic:'AND' },
      { field:'mfi',           op:'>', value:50, logic:'AND' },
    ],
  },
  {
    id: 'strong_uptrend',
    name: 'Uptrend Mạnh',        emoji: '🏆',
    desc: '3+ phiên tăng + 1T dương + MACD + OBV tích cực',
    conditions: [
      { field:'consecutiveUp',  op:'>=', value:3, logic:'AND' },
      { field:'change1m',       op:'>',  value:5, logic:'AND' },
      { field:'macdHistogram',  op:'>',  value:0, logic:'AND' },
      { field:'obvTrend',       op:'>',  value:0, logic:'AND' },
    ],
  },
  // ── Breakout ─────────────────────────────────────────────
  {
    id: 'breakout_setup',
    name: 'Breakout Setup',      emoji: '📈',
    desc: 'BB %B cao + MACD tích lũy + Volume đột biến — chuẩn bị breakout',
    conditions: [
      { field:'bbPct',         op:'between', value:75, value2:100, logic:'AND' },
      { field:'macdHistogram', op:'>',       value:0,              logic:'AND' },
      { field:'relVolume',     op:'>',       value:1.5,            logic:'AND' },
    ],
  },
  {
    id: 'volume_breakout',
    name: 'Volume Đột Biến',     emoji: '📊',
    desc: 'Rel Vol > 2x + giá tăng + MFI tăng — dòng tiền vào mạnh',
    conditions: [
      { field:'relVolume', op:'>', value:2,  logic:'AND' },
      { field:'changePct', op:'>', value:1,  logic:'AND' },
      { field:'mfi',       op:'>', value:50, logic:'AND' },
    ],
  },
  // ── Value / Recovery ─────────────────────────────────────
  {
    id: 'value_screen',
    name: 'Value Cơ Bản',        emoji: '💎',
    desc: 'P/E thấp + EPS dương + Beta ổn — cổ phiếu giá trị',
    conditions: [
      { field:'pe',   op:'<', value:15,  logic:'AND' },
      { field:'pe',   op:'>', value:1,   logic:'AND' },
      { field:'eps',  op:'>', value:0,   logic:'AND' },
      { field:'beta', op:'<', value:1.5, logic:'AND' },
    ],
  },
  {
    id: 'near_6m_low',
    name: 'Gần Đáy 6 Tháng',    emoji: '🎯',
    desc: 'Giá gần đáy 6T + RSI thấp + MFI chưa quá bán — vùng tích lũy',
    conditions: [
      { field:'distFromLow', op:'<', value:10, logic:'AND' },
      { field:'rsi',         op:'<', value:45, logic:'AND' },
      { field:'mfi',         op:'>', value:20, logic:'AND' },
    ],
  },
  {
    id: 'recovery_candidate',
    name: 'Phục Hồi Tiềm Năng',  emoji: '🌱',
    desc: 'Giảm sâu 3T + bắt đầu phục hồi + dòng tiền quay lại',
    conditions: [
      { field:'change3m',  op:'<', value:-15, logic:'AND' },
      { field:'change1w',  op:'>', value:2,   logic:'AND' },
      { field:'mfi',       op:'>', value:30,  logic:'AND' },
      { field:'obvTrend',  op:'>', value:0,   logic:'AND' },
    ],
  },
  {
    id: 'obv_accumulation',
    name: 'OBV Tích Lũy',        emoji: '🏦',
    desc: 'OBV tăng + giá đứng yên hoặc giảm nhẹ — cá mập đang gom hàng',
    conditions: [
      { field:'obvTrend',  op:'>',        value:0,  logic:'AND' },
      { field:'changePct', op:'between',  value:-3, value2:1, logic:'AND' },
      { field:'relVolume', op:'>',        value:1,  logic:'AND' },
    ],
  },
];

// ── Field extractor ───────────────────────────────────────────

export function extractField(item: StockIndicatorResult, field: FieldKey): number | null {
  switch (field) {
    case 'price':         return item.price ?? null;
    case 'changePct':     return item.changePct ?? null;
    case 'volume':        return item.volume ? item.volume / 1000 : null;
    case 'rsi':           return item.rsi ?? null;
    case 'stochK':        return item.stochK ?? null;
    case 'stochD':        return item.stochD ?? null;
    case 'macd':          return item.macd ?? null;
    case 'macdHistogram': return item.macdHistogram ?? null;
    case 'bbPct': {
      const { bbUpper, bbLower, price } = item;
      if (!bbUpper || !bbLower || bbUpper === bbLower) return null;
      return ((price - bbLower) / (bbUpper - bbLower)) * 100;
    }
    case 'mfi':           return item.mfi ?? null;
    case 'obvTrend':      return item.obvTrend ?? null;
    case 'relVolume':     return item.relVolume ?? null;
    case 'avgVolume20dK': return item.avgVolume20d ? item.avgVolume20d / 1000 : null;
    case 'change1w':      return item.change1w ?? null;
    case 'change1m':      return item.change1m ?? null;
    case 'change3m':      return item.change3m ?? null;
    case 'change6m':      return item.change6m ?? null;
    case 'distFromHigh':  return item.distFromHigh ?? null;
    case 'distFromLow':   return item.distFromLow ?? null;
    case 'consecutiveUp':   return item.consecutiveUp ?? null;
    case 'consecutiveDown': return item.consecutiveDown ?? null;
    case 'pe':          return item.pe ?? null;
    case 'eps':         return item.eps ?? null;
    case 'beta':        return item.beta ?? null;
    case 'marketCapB':  return item.marketCap ? item.marketCap / 1e9 : null;
    default:            return null;
  }
}

// ── Condition evaluator ───────────────────────────────────────

function evalCondition(val: number, cond: Condition): boolean {
  switch (cond.op) {
    case '<':       return val < cond.value;
    case '<=':      return val <= cond.value;
    case '>':       return val > cond.value;
    case '>=':      return val >= cond.value;
    case '==':      return Math.abs(val - cond.value) < 0.0001;
    case 'between': return cond.value2 != null && val >= cond.value && val <= cond.value2;
    default:        return false;
  }
}

export function applyScreener(
  items: StockIndicatorResult[],
  conditions: Condition[],
): StockIndicatorResult[] {
  if (conditions.length === 0) return items;
  return items.filter(item => {
    if (item.error) return false;
    let result = true;
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      const val  = extractField(item, cond.field);
      const pass = val !== null ? evalCondition(val, cond) : false;
      result = i === 0 ? pass : cond.logic === 'AND' ? result && pass : result || pass;
    }
    return result;
  });
}

// ── localStorage helpers ──────────────────────────────────────

const PRESETS_KEY = 'vn_stock_screener_presets';

export function loadUserPresets(): Preset[] {
  if (typeof window === 'undefined') return [];
  try { const r = localStorage.getItem(PRESETS_KEY); return r ? JSON.parse(r) as Preset[] : []; } catch { return []; }
}

export function saveUserPresets(presets: Preset[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function newCondition(logic: Logic = 'AND'): Condition {
  return { id: `c_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, field: 'rsi', op: '<', value: 30, logic };
}

export function conditionLabel(cond: Condition): string {
  const meta = FIELD_META[cond.field];
  const opStr = cond.op === 'between' ? `${cond.value}–${cond.value2}` : `${cond.op} ${cond.value}`;
  return `${meta.label} ${opStr}${meta.unit ? ' ' + meta.unit : ''}`;
}
