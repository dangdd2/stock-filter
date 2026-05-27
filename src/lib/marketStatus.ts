// ─────────────────────────────────────────────────────────────
// Vietnam stock market (HOSE/HNX) session logic
// All times are Vietnam local time (UTC+7)
// ─────────────────────────────────────────────────────────────

export type SessionState =
  | 'pre_open'     // before 09:00
  | 'ato'          // 09:00–09:15  — ATO
  | 'continuous_1' // 09:15–11:30  — continuous trading
  | 'lunch'        // 11:30–13:00  — lunch break
  | 'atc'          // 14:30–14:45  — ATC
  | 'continuous_2' // 13:00–14:30  — afternoon continuous
  | 'post_close'   // 14:45–15:00  — PT session
  | 'closed';      // outside hours / weekend

export interface MarketStatus {
  state: SessionState;
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  dot: string;          // tailwind bg color class
  nextEvent: string;    // "Mở cửa lúc 09:00" etc.
  minutesUntilNext: number | null;
  isTrading: boolean;   // true when orders can be matched
}

function vnNow(): { day: number; h: number; m: number; totalMin: number } {
  const now = new Date();
  // Vietnam is UTC+7
  const vnMs = now.getTime() + (7 * 60 - now.getTimezoneOffset()) * 60000;
  const vn   = new Date(vnMs);
  return {
    day:      vn.getDay(),          // 0=Sun, 6=Sat
    h:        vn.getHours(),
    m:        vn.getMinutes(),
    totalMin: vn.getHours() * 60 + vn.getMinutes(),
  };
}

function minsUntil(targetH: number, targetM: number, cur: number): number {
  return targetH * 60 + targetM - cur;
}

export function getMarketStatus(): MarketStatus {
  const { day, totalMin } = vnNow();

  const isWeekend = day === 0 || day === 6;
  if (isWeekend) {
    return {
      state: 'closed', label: 'Đóng cửa (cuối tuần)',
      color: 'red', dot: 'bg-red-500',
      nextEvent: 'Mở cửa thứ Hai 09:00',
      minutesUntilNext: null,
      isTrading: false,
    };
  }

  // Weekday session windows (all in minutes from midnight)
  const T = {
    preOpen:    8 * 60,           // 08:00
    ato:        9 * 60,           // 09:00
    cont1:      9 * 60 + 15,      // 09:15
    lunch:     11 * 60 + 30,      // 11:30
    cont2:     13 * 60,           // 13:00
    atc:       14 * 60 + 30,      // 14:30
    postClose: 14 * 60 + 45,      // 14:45
    end:       15 * 60,           // 15:00
  };

  if (totalMin < T.preOpen) {
    return {
      state: 'closed', label: 'Chưa mở cửa',
      color: 'red', dot: 'bg-red-500',
      nextEvent: 'Mở phiên ATO 09:00',
      minutesUntilNext: minsUntil(9, 0, totalMin),
      isTrading: false,
    };
  }
  if (totalMin < T.ato) {
    return {
      state: 'pre_open', label: 'Trước phiên',
      color: 'yellow', dot: 'bg-yellow-400',
      nextEvent: 'ATO 09:00',
      minutesUntilNext: minsUntil(9, 0, totalMin),
      isTrading: false,
    };
  }
  if (totalMin < T.cont1) {
    return {
      state: 'ato', label: 'Phiên ATO',
      color: 'orange', dot: 'bg-orange-400',
      nextEvent: 'Khớp liên tục 09:15',
      minutesUntilNext: minsUntil(9, 15, totalMin),
      isTrading: true,
    };
  }
  if (totalMin < T.lunch) {
    return {
      state: 'continuous_1', label: 'Đang giao dịch',
      color: 'green', dot: 'bg-emerald-400',
      nextEvent: 'Nghỉ trưa 11:30',
      minutesUntilNext: minsUntil(11, 30, totalMin),
      isTrading: true,
    };
  }
  if (totalMin < T.cont2) {
    return {
      state: 'lunch', label: 'Nghỉ trưa',
      color: 'yellow', dot: 'bg-yellow-400',
      nextEvent: 'Mở lại 13:00',
      minutesUntilNext: minsUntil(13, 0, totalMin),
      isTrading: false,
    };
  }
  if (totalMin < T.atc) {
    return {
      state: 'continuous_2', label: 'Đang giao dịch',
      color: 'green', dot: 'bg-emerald-400',
      nextEvent: 'Phiên ATC 14:30',
      minutesUntilNext: minsUntil(14, 30, totalMin),
      isTrading: true,
    };
  }
  if (totalMin < T.postClose) {
    return {
      state: 'atc', label: 'Phiên ATC',
      color: 'orange', dot: 'bg-orange-400',
      nextEvent: 'Giao dịch thỏa thuận 14:45',
      minutesUntilNext: minsUntil(14, 45, totalMin),
      isTrading: true,
    };
  }
  if (totalMin < T.end) {
    return {
      state: 'post_close', label: 'Thỏa thuận (PT)',
      color: 'yellow', dot: 'bg-yellow-400',
      nextEvent: 'Đóng cửa 15:00',
      minutesUntilNext: minsUntil(15, 0, totalMin),
      isTrading: true,
    };
  }
  return {
    state: 'closed', label: 'Đã đóng cửa',
    color: 'red', dot: 'bg-red-500',
    nextEvent: 'Mở cửa ngày mai 09:00',
    minutesUntilNext: null,
    isTrading: false,
  };
}
