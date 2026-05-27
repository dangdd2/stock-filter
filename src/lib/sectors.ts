// Vietnamese stock sector classification
// Source: HOSE sector groupings

export const SECTOR_MAP: Record<string, string> = {
  // Ngân hàng
  VCB: 'Ngân hàng', BID: 'Ngân hàng', CTG: 'Ngân hàng', TCB: 'Ngân hàng',
  MBB: 'Ngân hàng', ACB: 'Ngân hàng', VPB: 'Ngân hàng', STB: 'Ngân hàng',
  HDB: 'Ngân hàng', LPB: 'Ngân hàng', SHB: 'Ngân hàng', TPB: 'Ngân hàng',
  MSB: 'Ngân hàng', OCB: 'Ngân hàng', SSB: 'Ngân hàng', VIB: 'Ngân hàng',
  EIB: 'Ngân hàng', NVB: 'Ngân hàng', BAB: 'Ngân hàng', BVB: 'Ngân hàng',
  ABB: 'Ngân hàng', KLB: 'Ngân hàng', NAB: 'Ngân hàng', PGB: 'Ngân hàng',
  SGB: 'Ngân hàng', VBB: 'Ngân hàng',

  // Bất động sản
  VHM: 'Bất động sản', VIC: 'Bất động sản', NVL: 'Bất động sản', PDR: 'Bất động sản',
  KDH: 'Bất động sản', DXG: 'Bất động sản', NLG: 'Bất động sản', DIG: 'Bất động sản',
  CEO: 'Bất động sản', HDC: 'Bất động sản', TDC: 'Bất động sản', IDC: 'Bất động sản',
  LDG: 'Bất động sản', SGR: 'Bất động sản', NBB: 'Bất động sản', ITA: 'Bất động sản',
  HQC: 'Bất động sản', PTL: 'Bất động sản', QCG: 'Bất động sản', TDH: 'Bất động sản',
  VRE: 'Bất động sản', SZC: 'Bất động sản', PHR: 'Bất động sản', BCM: 'Bất động sản',
  KBC: 'Bất động sản', SIP: 'Bất động sản', VGC: 'Bất động sản', SNZ: 'Bất động sản',
  GVR: 'Bất động sản', HBC: 'Bất động sản',

  // Chứng khoán
  SSI: 'Chứng khoán', VND: 'Chứng khoán', HCM: 'Chứng khoán', MBS: 'Chứng khoán',
  VCI: 'Chứng khoán', CTS: 'Chứng khoán', BSI: 'Chứng khoán', ACBS: 'Chứng khoán',
  SHS: 'Chứng khoán', FTS: 'Chứng khoán', AGR: 'Chứng khoán', VDS: 'Chứng khoán',
  TVS: 'Chứng khoán', EVS: 'Chứng khoán', PSI: 'Chứng khoán',

  // Thép & Vật liệu
  HPG: 'Thép & VL', HSG: 'Thép & VL', NKG: 'Thép & VL', TLH: 'Thép & VL',
  SMC: 'Thép & VL', POM: 'Thép & VL', VIS: 'Thép & VL', DTL: 'Thép & VL',
  CSV: 'Thép & VL', TIS: 'Thép & VL',

  // Dầu khí & Năng lượng
  GAS: 'Dầu khí', PVD: 'Dầu khí', PVS: 'Dầu khí', BSR: 'Dầu khí',
  OIL: 'Dầu khí', PLX: 'Dầu khí', PVT: 'Dầu khí', PVC: 'Dầu khí',
  CNG: 'Dầu khí', GEG: 'Dầu khí', REE: 'Dầu khí', PC1: 'Dầu khí',
  POW: 'Dầu khí', NT2: 'Dầu khí', TBC: 'Dầu khí', VSH: 'Dầu khí',

  // Tiêu dùng & Bán lẻ
  MWG: 'Tiêu dùng', PNJ: 'Tiêu dùng', FRT: 'Tiêu dùng', DGW: 'Tiêu dùng',
  MSN: 'Tiêu dùng', SAB: 'Tiêu dùng', VNM: 'Tiêu dùng', MCH: 'Tiêu dùng',
  ANV: 'Tiêu dùng', VHC: 'Tiêu dùng', IDI: 'Tiêu dùng', ABT: 'Tiêu dùng',
  CII: 'Tiêu dùng', HAG: 'Tiêu dùng', HNG: 'Tiêu dùng', BAF: 'Tiêu dùng',
  SFG: 'Tiêu dùng', GTN: 'Tiêu dùng', LSS: 'Tiêu dùng', SBT: 'Tiêu dùng',
  BHN: 'Tiêu dùng', QNS: 'Tiêu dùng',

  // Công nghệ & Viễn thông
  FPT: 'Công nghệ', CMG: 'Công nghệ', ELC: 'Công nghệ', VGI: 'Công nghệ',
  ICT: 'Công nghệ', ITD: 'Công nghệ', SAM: 'Công nghệ', SGT: 'Công nghệ',

  // Hàng không & Vận tải
  HVN: 'Vận tải', VJC: 'Vận tải', ACV: 'Vận tải', GMD: 'Vận tải',
  HAH: 'Vận tải', VSC: 'Vận tải', PVP: 'Vận tải', MVN: 'Vận tải',
  TMS: 'Vận tải', VTO: 'Vận tải',

  // Xây dựng & Hạ tầng
  CTD: 'Xây dựng', HHV: 'Xây dựng', FCN: 'Xây dựng', LCG: 'Xây dựng',
  VCG: 'Xây dựng', CC1: 'Xây dựng', C4G: 'Xây dựng', HUT: 'Xây dựng',
  CCP: 'Xây dựng', DPG: 'Xây dựng', TCO: 'Xây dựng',

  // Bảo hiểm
  BVH: 'Bảo hiểm', BMI: 'Bảo hiểm', BIC: 'Bảo hiểm', MIG: 'Bảo hiểm', PVI: 'Bảo hiểm',

  // Dược phẩm & Y tế
  DHG: 'Dược & Y tế', IMP: 'Dược & Y tế', DMC: 'Dược & Y tế', TRA: 'Dược & Y tế',
  DBD: 'Dược & Y tế', SPM: 'Dược & Y tế', VMD: 'Dược & Y tế', TNH: 'Dược & Y tế',
};

export const SECTOR_COLORS: Record<string, string> = {
  'Ngân hàng':      '#3b82f6',
  'Bất động sản':   '#8b5cf6',
  'Chứng khoán':    '#06b6d4',
  'Thép & VL':      '#f97316',
  'Dầu khí':        '#eab308',
  'Tiêu dùng':      '#10b981',
  'Công nghệ':      '#6366f1',
  'Vận tải':        '#14b8a6',
  'Xây dựng':       '#f59e0b',
  'Bảo hiểm':       '#ec4899',
  'Dược & Y tế':    '#84cc16',
  'Khác':           '#64748b',
};

export function getSector(ticker: string): string {
  return SECTOR_MAP[ticker.toUpperCase()] ?? 'Khác';
}
