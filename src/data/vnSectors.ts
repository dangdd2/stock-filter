// Vietnamese stock market sector definitions
// Sources: HOSE/HNX sector classification

export interface SectorDef {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  tickers: string[];
}

export const VN_SECTORS: SectorDef[] = [
  {
    id: 'banking',
    name: 'Ngân hàng',
    nameEn: 'Banking',
    color: '#3b82f6',
    tickers: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'VPB', 'ACB', 'HDB', 'STB', 'LPB', 'MSB', 'OCB', 'TPB', 'SHB', 'VIB'],
  },
  {
    id: 'real_estate',
    name: 'Bất động sản',
    nameEn: 'Real Estate',
    color: '#f59e0b',
    tickers: ['VHM', 'NVL', 'PDR', 'KDH', 'DXG', 'BCM', 'NLG', 'DIG', 'CEO', 'HDG', 'AGG', 'HBC', 'SCR', 'TDC'],
  },
  {
    id: 'steel',
    name: 'Thép & Vật liệu',
    nameEn: 'Steel & Materials',
    color: '#6b7280',
    tickers: ['HPG', 'NKG', 'HSG', 'TLH', 'VGS', 'SMC', 'POM', 'DTL'],
  },
  {
    id: 'tech',
    name: 'Công nghệ',
    nameEn: 'Technology',
    color: '#8b5cf6',
    tickers: ['FPT', 'CMG', 'ELC', 'VNG', 'ITD', 'SAM', 'SGT', 'TST'],
  },
  {
    id: 'consumer',
    name: 'Tiêu dùng',
    nameEn: 'Consumer Goods',
    color: '#10b981',
    tickers: ['VNM', 'MSN', 'SAB', 'MCH', 'QNS', 'PAN', 'KDC', 'ANV', 'HNG', 'BAF'],
  },
  {
    id: 'energy',
    name: 'Năng lượng & Dầu khí',
    nameEn: 'Energy & Oil',
    color: '#ef4444',
    tickers: ['GAS', 'PLX', 'PVD', 'PVS', 'BSR', 'OIL', 'PVT', 'PGV', 'NT2', 'PPC'],
  },
  {
    id: 'securities',
    name: 'Chứng khoán',
    nameEn: 'Securities',
    color: '#ec4899',
    tickers: ['SSI', 'VND', 'HCM', 'MBS', 'VCI', 'CTS', 'APG', 'AGR', 'TVS', 'SBS'],
  },
  {
    id: 'industrial',
    name: 'Công nghiệp',
    nameEn: 'Industrials',
    color: '#14b8a6',
    tickers: ['REE', 'GEX', 'SCS', 'ACV', 'GMD', 'TCO', 'DVP', 'VSC', 'HAH', 'VTO'],
  },
  {
    id: 'pharma',
    name: 'Dược phẩm & Y tế',
    nameEn: 'Healthcare & Pharma',
    color: '#06b6d4',
    tickers: ['DHG', 'IMP', 'TRA', 'DBD', 'PME', 'DCL', 'OPC', 'VMD', 'SPM'],
  },
  {
    id: 'retail',
    name: 'Bán lẻ',
    nameEn: 'Retail',
    color: '#f97316',
    tickers: ['MWG', 'FRT', 'PNJ', 'DGW', 'AST', 'VRE', 'CRE'],
  },
];

// Map ticker → sector
export const TICKER_TO_SECTOR: Record<string, string> = {};
VN_SECTORS.forEach(s => {
  s.tickers.forEach(t => { TICKER_TO_SECTOR[t] = s.id; });
});
