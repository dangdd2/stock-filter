// ─────────────────────────────────────────────────────────────
// Vietnam stock market (HOSE/HNX) session logic
// Sessions: 09:00–11:30 / 13:00–15:00  (Mon–Fri, non-holiday)
// ─────────────────────────────────────────────────────────────

export type SessionState =
  | 'pre_open'     // before 09:00
  | 'ato'          // 09:00–09:15  — ATO lệnh khớp
  | 'morning'      // 09:15–11:30  — khớp liên tục buổi sáng
  | 'lunch'        // 11:30–13:00  — nghỉ trưa
  | 'afternoon'    // 13:00–14:30  — khớp liên tục buổi chiều
  | 'atc'          // 14:30–15:00  — ATC + PT
  | 'closed';      // ngoài giờ / cuối tuần / ngày lễ

export interface MarketStatus {
  state: SessionState;
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  dot: string;             // tailwind bg color class
  nextEvent: string;
  minutesUntilNext: number | null;
  isTrading: boolean;
}

// ── Vietnamese public holidays (YYYY-MM-DD) ───────────────────
// Nguồn: quyết định nghỉ lễ của Chính phủ
const VN_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', // Tết Dương lịch
  '2025-01-27', // Tết Nguyên Đán (27 Tháng Chạp)
  '2025-01-28', // Tết Nguyên Đán (28 Tháng Chạp)
  '2025-01-29', // Tết Nguyên Đán (Mùng 1)
  '2025-01-30', // Tết Nguyên Đán (Mùng 2)
  '2025-01-31', // Tết Nguyên Đán (Mùng 3)
  '2025-02-03', // Tết bù
  '2025-04-07', // Giỗ Tổ Hùng Vương (10/3 ÂL)
  '2025-04-30', // Giải phóng Miền Nam
  '2025-05-01', // Quốc tế Lao động
  '2025-05-02', // Nghỉ bù
  '2025-09-01', // Nghỉ bù Quốc Khánh
  '2025-09-02', // Quốc Khánh
  // 2026
  '2026-01-01', // Tết Dương lịch
  '2026-02-16', // Tết Nguyên Đán (27 Tháng Chạp)
  '2026-02-17', // Tết Nguyên Đán (28 Tháng Chạp)
  '2026-02-18', // Tết Nguyên Đán (Mùng 1)
  '2026-02-19', // Tết Nguyên Đán (Mùng 2)
  '2026-02-20', // Tết Nguyên Đán (Mùng 3)
  '2026-04-27', // Giỗ Tổ Hùng Vương (10/3 ÂL)
  '2026-04-30', // Giải phóng Miền Nam
  '2026-05-01', // Quốc tế Lao động
  '2026-09-02', // Quốc Khánh
]);

// ── Get current Vietnam time (always correct, regardless of local tz) ──
function vnNow() {
  const now = new Date();
  // Convert to UTC first, then add 7h → Vietnam time
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const vn    = new Date(utcMs + 7 * 3600000);
  const dateStr = `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}-${String(vn.getDate()).padStart(2, '0')}`;
  return {
    day:      vn.getDay(),   // 0=Sun, 6=Sat
    dateStr,
    totalMin: vn.getHours() * 60 + vn.getMinutes(),
  };
}

export function getMarketStatus(): MarketStatus {
  const { day, dateStr, totalMin } = vnNow();

  // Weekend
  if (day === 0 || day === 6) {
    return {
      state: 'closed',
      label: day === 6 ? 'Nghỉ Thứ 7' : 'Nghỉ Chủ Nhật',
      color: 'red', dot: 'bg-red-500',
      nextEvent: 'Mở cửa Thứ 2 09:00',
      minutesUntilNext: null,
      isTrading: false,
    };
  }

  // Public holiday
  if (VN_HOLIDAYS.has(dateStr)) {
    return {
      state: 'closed',
      label: 'Nghỉ lễ',
      color: 'red', dot: 'bg-red-500',
      nextEvent: 'Xem lịch nghỉ lễ',
      minutesUntilNext: null,
      isTrading: false,
    };
  }

  // Session windows (minutes from midnight)
  const T = {
    preOpen:   8 * 60,           // 08:00 — sàn mở hệ thống
    ato:       9 * 60,           // 09:00 — ATO bắt đầu
    morning:   9 * 60 + 15,      // 09:15 — khớp liên tục sáng
    lunch:    11 * 60 + 30,      // 11:30 — nghỉ trưa
    afternoon:13 * 60,           // 13:00 — khớp liên tục chiều
    atc:      14 * 60 + 30,      // 14:30 — ATC
    close:    15 * 60,           // 15:00 — đóng cửa
  };

  const minsUntil = (h: number, m: number) => h * 60 + m - totalMin;

  if (totalMin < T.preOpen) {
    return {
      state: 'closed', label: 'Chưa mở cửa',
      color: 'red', dot: 'bg-red-500',
      nextEvent: 'Phiên ATO 09:00',
      minutesUntilNext: minsUntil(9, 0),
      isTrading: false,
    };
  }
  if (totalMin < T.ato) {
    return {
      state: 'pre_open', label: 'Trước phiên',
      color: 'yellow', dot: 'bg-yellow-400',
      nextEvent: 'ATO 09:00',
      minutesUntilNext: minsUntil(9, 0),
      isTrading: false,
    };
  }
  if (totalMin < T.morning) {
    return {
      state: 'ato', label: 'Phiên ATO',
      color: 'orange', dot: 'bg-orange-400',
      nextEvent: 'Khớp liên tục 09:15',
      minutesUntilNext: minsUntil(9, 15),
      isTrading: true,
    };
  }
  if (totalMin < T.lunch) {
    return {
      state: 'morning', label: 'Đang giao dịch (sáng)',
      color: 'green', dot: 'bg-emerald-400',
      nextEvent: 'Nghỉ trưa 11:30',
      minutesUntilNext: minsUntil(11, 30),
      isTrading: true,
    };
  }
  if (totalMin < T.afternoon) {
    return {
      state: 'lunch', label: 'Nghỉ trưa',
      color: 'yellow', dot: 'bg-yellow-400',
      nextEvent: 'Mở lại 13:00',
      minutesUntilNext: minsUntil(13, 0),
      isTrading: false,
    };
  }
  if (totalMin < T.atc) {
    return {
      state: 'afternoon', label: 'Đang giao dịch (chiều)',
      color: 'green', dot: 'bg-emerald-400',
      nextEvent: 'Phiên ATC 14:30',
      minutesUntilNext: minsUntil(14, 30),
      isTrading: true,
    };
  }
  if (totalMin < T.close) {
    return {
      state: 'atc', label: 'Phiên ATC',
      color: 'orange', dot: 'bg-orange-400',
      nextEvent: 'Đóng cửa 15:00',
      minutesUntilNext: minsUntil(15, 0),
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
