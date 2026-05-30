// ─────────────────────────────────────────────────────────────
// Guide content data
// ─────────────────────────────────────────────────────────────

export interface GuideSection {
  id: string;
  title: string;
  emoji: string;
  subsections: GuideSubsection[];
}

export interface GuideSubsection {
  id: string;
  title: string;
  content: GuideBlock[];
}

export type GuideBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'steps'; items: { title: string; desc: string; tip?: string }[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'tip'; variant: 'info' | 'warning' | 'pro'; text: string }
  | { type: 'annotated-image'; src: string; alt: string; annotations: Annotation[] }
  | { type: 'code'; text: string }
  | { type: 'feature-grid'; items: { icon: string; title: string; desc: string }[] };

export interface Annotation {
  x: number;      // % from left
  y: number;      // % from top
  label: string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  position: 'top' | 'bottom' | 'left' | 'right';
}

export const GUIDE_SECTIONS: GuideSection[] = [
  // ─────────────────────────────────────────────────────────
  {
    id: 'quickstart',
    title: 'Bắt Đầu Nhanh',
    emoji: '🚀',
    subsections: [
      {
        id: 'quickstart-intro',
        title: 'Stock AI là gì?',
        content: [
          {
            type: 'paragraph',
            text: 'Stock AI là công cụ phân tích kỹ thuật dành riêng cho thị trường chứng khoán Việt Nam (HOSE). Ứng dụng tự động tính toán các chỉ báo kỹ thuật, phát tín hiệu MUA/BÁN, và cung cấp phân tích AI chuyên sâu cho từng cổ phiếu.',
          },
          {
            type: 'feature-grid',
            items: [
              { icon: '📋', title: 'Watchlist thông minh', desc: 'Tạo nhiều danh sách cổ phiếu, tự động tổng hợp vào All Tickers' },
              { icon: '📊', title: 'Chỉ báo realtime', desc: 'RSI, MACD, Stochastic, Bollinger Bands tính từ dữ liệu Yahoo Finance' },
              { icon: '🤖', title: 'AI Analysis', desc: 'Phân tích kỹ thuật chuyên sâu, kịch bản giao dịch cụ thể bằng tiếng Việt' },
              { icon: '🔥', title: 'Screener nâng cao', desc: '24 điều kiện lọc, 9 preset sẵn có, lưu preset cá nhân' },
              { icon: '🗺️', title: 'Market Heatmap', desc: 'Bản đồ nhiệt toàn thị trường, group theo danh mục của bạn' },
              { icon: '📈', title: 'Signal History', desc: 'Lưu lịch sử tín hiệu, tự động kiểm tra kết quả sau 3/7/14 ngày' },
            ],
          },
        ],
      },
      {
        id: 'quickstart-steps',
        title: '3 bước bắt đầu',
        content: [
          {
            type: 'steps',
            items: [
              {
                title: 'Thêm tickers vào watchlist',
                desc: 'Nhập mã cổ phiếu (VD: VCB, TCB, HPG) vào ô "Add ticker" trên thanh điều khiển. Có thể nhập nhiều mã cùng lúc cách nhau bằng dấu phẩy: VCB,TCB,MBB',
                tip: 'Chỉ dùng mã cổ phiếu HOSE, không thêm đuôi ".VN"',
              },
              {
                title: 'Nhấn Refresh để tải dữ liệu',
                desc: 'Nhấn nút Refresh trên thanh Market Status hoặc bật Auto Refresh (5/10/15/30 phút) để tự động cập nhật. Dữ liệu lấy từ Yahoo Finance, delay ~15 phút so với thị trường.',
                tip: 'Nên Refresh vào giờ giao dịch để có dữ liệu mới nhất',
              },
              {
                title: 'Đọc tín hiệu và phân tích',
                desc: 'Panel "Khuyến Nghị Cổ Phiếu" hiển thị tín hiệu MUA/BÁN tự động. Click vào bất kỳ cổ phiếu nào để xem biểu đồ hoặc nhấn icon Brain để chạy AI Analysis.',
              },
            ],
          },
          {
            type: 'tip',
            variant: 'info',
            text: 'Lần đầu sử dụng, ứng dụng đã có sẵn danh sách "Main Watchlist" với 7 cổ phiếu ngân hàng phổ biến. Bạn có thể xóa và thêm mới tùy ý.',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'watchlist',
    title: 'Quản Lý Watchlist',
    emoji: '📋',
    subsections: [
      {
        id: 'watchlist-create',
        title: 'Tạo và quản lý danh sách',
        content: [
          {
            type: 'paragraph',
            text: 'Bạn có thể tạo nhiều watchlist để phân loại cổ phiếu theo ngành, chiến lược, hoặc mức độ quan tâm. Watchlist "★ All Tickers" là danh sách tổng hợp tự động từ tất cả watchlist khác.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Tạo watchlist mới', desc: 'Click nút "+ New" → watchlist mới được tạo, modal quản lý mở ra để đặt tên ngay.' },
              { title: 'Đổi tên', desc: 'Click "Manage" → double-click tên watchlist → gõ tên mới → Enter.' },
              { title: 'Sắp xếp thứ tự', desc: 'Trong modal Manage, kéo thả biểu tượng ⠿ để đổi thứ tự các watchlist.' },
              { title: 'Xóa watchlist', desc: 'Trong modal Manage, click icon thùng rác. Cần giữ ít nhất 1 watchlist (ngoài All Tickers).' },
            ],
          },
          {
            type: 'tip',
            variant: 'pro',
            text: 'Đặt tên watchlist theo tên ngành (VD: "Ngân hàng", "BĐS", "Thép") — Market Heatmap sẽ tự động group cổ phiếu theo đúng sector đó.',
          },
        ],
      },
      {
        id: 'watchlist-sync',
        title: 'All Tickers & Sync',
        content: [
          {
            type: 'paragraph',
            text: '"★ All Tickers" tổng hợp tất cả mã cổ phiếu từ mọi watchlist (không trùng lặp). Dùng để xem tổng quan thị trường, chạy Screener, hoặc xem Heatmap toàn diện nhất.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Sync All Tickers', desc: 'Chọn watchlist "★ All Tickers" → click nút "Sync" để cập nhật lại danh sách từ các watchlist con.' },
              { title: 'Thêm ticker nhanh', desc: 'Nhập "VCB,TCB,MBB" (cách nhau bằng dấu phẩy) → click + để thêm nhiều mã cùng lúc.' },
            ],
          },
          {
            type: 'tip',
            variant: 'warning',
            text: 'Nhớ Sync sau khi thêm/xóa ticker ở các watchlist con để All Tickers luôn được cập nhật.',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'indicators',
    title: 'Bảng Chỉ Báo',
    emoji: '📊',
    subsections: [
      {
        id: 'indicators-reading',
        title: 'Đọc các chỉ báo kỹ thuật',
        content: [
          {
            type: 'paragraph',
            text: 'Bảng chính hiển thị tất cả chỉ báo kỹ thuật được tính tự động từ 6 tháng dữ liệu lịch sử. Dưới đây là hướng dẫn đọc từng cột quan trọng.',
          },
          {
            type: 'table',
            headers: ['Chỉ báo', 'Vùng', 'Ý nghĩa', 'Hành động tham khảo'],
            rows: [
              ['RSI', '< 30', 'Quá bán — giá giảm quá nhanh', 'Xem xét mua vào vùng hỗ trợ'],
              ['RSI', '30–70', 'Trung lập — đang tích lũy', 'Chờ thêm tín hiệu xác nhận'],
              ['RSI', '> 70', 'Quá mua — giá tăng quá nhanh', 'Cân nhắc chốt lời một phần'],
              ['Stoch %K', '< 20', 'Oversold — momentum yếu', 'Xác nhận cho tín hiệu RSI oversold'],
              ['Stoch %K', '> 80', 'Overbought — momentum mạnh quá', 'Cẩn thận pullback'],
              ['BB %B', '< 0%', 'Giá dưới dải dưới Bollinger', 'Vùng quá bán cực đoan'],
              ['BB %B', '> 100%', 'Giá trên dải trên Bollinger', 'Vùng quá mua, rủi ro cao'],
              ['MACD Hist', 'Dương ▲', 'Momentum đang tăng', 'Xu hướng tăng đang mạnh dần'],
              ['MACD Hist', 'Âm ▼', 'Momentum đang giảm', 'Xu hướng giảm hoặc pullback'],
              ['Rel Vol', '> 2x', 'Volume gấp đôi trung bình', 'Có dòng tiền lớn vào/ra'],
            ],
          },
        ],
      },
      {
        id: 'indicators-filters',
        title: 'Lọc nhanh bằng Filter',
        content: [
          {
            type: 'paragraph',
            text: 'Ba bộ lọc nhanh ở thanh điều khiển cho phép lọc watchlist theo RSI, MACD, và Stochastic chỉ bằng 1 click.',
          },
          {
            type: 'table',
            headers: ['Filter', 'Điều kiện', 'Dùng khi nào'],
            rows: [
              ['RSI: Oversold', 'RSI < 30', 'Tìm cơ hội mua ở vùng quá bán'],
              ['RSI: Overbought', 'RSI > 70', 'Tìm cổ phiếu cần chốt lời'],
              ['MACD: Bullish', 'MACD > Signal', 'Lọc cổ phiếu đang có momentum tăng'],
              ['MACD: Bearish', 'MACD < Signal', 'Cảnh báo xu hướng giảm'],
              ['Stoch: Oversold', 'K < 20', 'Xác nhận thêm cho RSI oversold'],
              ['Stoch: Bullish Cross', 'K > D', 'Momentum đang chuyển sang tăng'],
            ],
          },
          {
            type: 'tip',
            variant: 'pro',
            text: 'Kết hợp nhiều filter: RSI Oversold + MACD Bullish = tín hiệu mua với độ tin cậy cao hơn. Dùng tab Screener để kết hợp linh hoạt hơn.',
          },
        ],
      },
      {
        id: 'indicators-newfields',
        title: 'Chỉ báo thống kê giá',
        content: [
          {
            type: 'paragraph',
            text: 'Các chỉ báo thống kê giá được tính từ 6 tháng dữ liệu lịch sử, không cần API bổ sung.',
          },
          {
            type: 'table',
            headers: ['Chỉ báo', 'Ý nghĩa', 'Ví dụ'],
            rows: [
              ['% 1 tuần', 'Thay đổi giá so với ~5 phiên trước', '+3.2% = tăng 3.2% trong tuần'],
              ['% 1 tháng', 'Thay đổi so với ~21 phiên trước', '-8.5% = giảm 8.5% trong tháng'],
              ['% dưới đỉnh 6T', '% cách đỉnh 6 tháng gần nhất', '-15% = còn cách đỉnh 15%'],
              ['% trên đáy 6T', '% cao hơn đáy 6 tháng gần nhất', '+45% = đã phục hồi 45% từ đáy'],
              ['↑ Liên tiếp', 'Số phiên tăng giá liên tiếp', '↑3 = tăng 3 phiên liên tục'],
              ['Rel Vol', 'Volume hôm nay / TB 20 ngày', '2.5x = volume gấp 2.5 lần bình thường'],
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'chart',
    title: 'Biểu Đồ Kỹ Thuật',
    emoji: '📈',
    subsections: [
      {
        id: 'chart-open',
        title: 'Mở và điều hướng biểu đồ',
        content: [
          {
            type: 'steps',
            items: [
              { title: 'Mở biểu đồ', desc: 'Click icon 📊 (BarChart2) trên cột Actions của bất kỳ row nào. Biểu đồ mở ngay bên dưới row đó.' },
              { title: 'Toggle chỉ báo', desc: 'Ba nút MA10 / MA20 / BB ở góc phải trên biểu đồ để bật/tắt từng đường.' },
              { title: 'Đóng biểu đồ', desc: 'Click lại icon X trên cùng row, hoặc click row khác để mở biểu đồ mới.' },
            ],
          },
          {
            type: 'table',
            headers: ['Sub-chart', 'Đọc thế nào'],
            rows: [
              ['Candlestick', 'Nến xanh = phiên tăng, nến đỏ = phiên giảm. Bóng nến = biên độ high/low.'],
              ['Volume bars', 'Thanh xanh/đỏ dưới đáy = volume theo chiều giá. Đường vàng = MA20 volume.'],
              ['RSI (14)', 'Vượt 70 = overbought (đường đỏ), xuống dưới 30 = oversold (đường xanh).'],
              ['MACD Histogram', 'Cột xanh = momentum dương, cột đỏ = momentum âm. Đường xanh = MACD, cam = Signal.'],
              ['Stochastic RSI', 'Xanh = %K, cam = %D. Cắt nhau ở vùng <20 = tín hiệu mua, >80 = tín hiệu bán.'],
            ],
          },
          {
            type: 'tip',
            variant: 'pro',
            text: 'Tìm divergence: RSI tạo đáy cao hơn trong khi giá tạo đáy thấp hơn = bullish divergence, thường báo hiệu đảo chiều tăng mạnh.',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'ai',
    title: 'AI Analysis',
    emoji: '🤖',
    subsections: [
      {
        id: 'ai-how',
        title: 'Cách sử dụng AI Analysis',
        content: [
          {
            type: 'steps',
            items: [
              { title: 'Mở AI Analysis', desc: 'Click icon 🧠 (Brain) màu tím trên cột Actions. AI sẽ nhận dữ liệu chỉ báo hiện tại và stream phân tích.' },
              { title: 'Chờ streaming', desc: 'Phân tích được stream từng từ — thường mất 15–30 giây. Dòng đầu tiên luôn là khuyến nghị: BUY / SELL / HOLD / OBSERVABLE.' },
              { title: 'Đọc kịch bản', desc: 'Bảng "Kịch Bản Giao Dịch" có đầy đủ: Điểm vào / Dừng lỗ / Mục tiêu 1-2-3 / Tỷ lệ R:R / Độ tin cậy.' },
            ],
          },
          {
            type: 'table',
            headers: ['Khuyến nghị', 'Ý nghĩa', 'Hành động'],
            rows: [
              ['🟢 BUY', 'Cấu trúc tăng rõ ràng, tỷ lệ R:R hấp dẫn', 'Xem xét mở vị thế theo kịch bản'],
              ['🔴 SELL', 'Chỉ báo quá mua hoặc cấu trúc giảm', 'Cân nhắc thoát hoặc short'],
              ['🟡 HOLD', 'Tín hiệu hỗn hợp, đang tích lũy', 'Giữ nguyên, chờ xác nhận thêm'],
              ['⚪ OBSERVABLE', 'Tín hiệu chưa rõ', 'Theo dõi, chưa hành động'],
            ],
          },
          {
            type: 'tip',
            variant: 'warning',
            text: 'AI Analysis chỉ dựa trên chỉ báo kỹ thuật hiện tại, không có thông tin về tin tức hay sự kiện công ty. Luôn kết hợp với phân tích cơ bản trước khi ra quyết định.',
          },
        ],
      },
      {
        id: 'ai-financials',
        title: 'Báo Cáo Tài Chính',
        content: [
          {
            type: 'paragraph',
            text: 'Bên dưới AI Analysis là phần Phân Tích Cơ Bản với dữ liệu tài chính từ Yahoo Finance: P/E, EPS, P/B, Beta, Vốn hoá, Kết quả kinh doanh, Dòng tiền, Bảng cân đối kế toán.',
          },
          {
            type: 'table',
            headers: ['Chỉ số', 'Đọc thế nào'],
            rows: [
              ['P/E < 10', 'Có thể định giá thấp — nghiên cứu thêm'],
              ['P/E 10–20', 'Định giá hợp lý'],
              ['P/E > 35', 'Định giá cao — kỳ vọng tăng trưởng lớn'],
              ['EPS > 0', 'Công ty đang có lợi nhuận'],
              ['D/E < 1', 'Nợ thấp hơn vốn chủ — tài chính lành mạnh'],
              ['FCF dương', 'Sinh tiền thực sự từ hoạt động kinh doanh'],
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'signals',
    title: 'Tín Hiệu & Signal History',
    emoji: '🔔',
    subsections: [
      {
        id: 'signals-reading',
        title: 'Panel Khuyến Nghị Cổ Phiếu',
        content: [
          {
            type: 'paragraph',
            text: 'Panel MUA/BÁN tự động hiển thị dựa trên 3 điều kiện: RSI oversold/overbought, Stochastic oversold/overbought, và giá vượt BB upper/lower. Điểm conviction được tính từ 1/3 đến 3/3.',
          },
          {
            type: 'table',
            headers: ['Conviction', 'Màu sắc', 'Ý nghĩa'],
            rows: [
              ['1/3', 'Xanh nhạt', 'Chỉ 1 điều kiện khớp — tín hiệu yếu'],
              ['2/3', 'Xanh vừa', '2 điều kiện khớp — đáng chú ý'],
              ['3/3', 'Xanh đậm + viền', 'Cả 3 điều kiện — tín hiệu mạnh nhất'],
            ],
          },
          {
            type: 'tip',
            variant: 'info',
            text: 'Click vào bất kỳ chip tín hiệu nào để nhảy thẳng đến row đó trong bảng. Nếu mã không có trong watchlist hiện tại, app sẽ tự chuyển sang All Tickers.',
          },
        ],
      },
      {
        id: 'signals-history',
        title: 'Signal History & Backtesting',
        content: [
          {
            type: 'paragraph',
            text: 'Mỗi lần Refresh, tất cả tín hiệu MUA/BÁN được tự động lưu vào tab "Lịch Sử". Sau 3, 7, 14 ngày, kết quả sẽ tự điền vào — giúp bạn đánh giá độ chính xác của hệ thống.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Xem lịch sử', desc: 'Click tab "Lịch Sử" trên header → xem toàn bộ tín hiệu đã được ghi nhận.' },
              { title: 'Đọc win rate', desc: 'Stats panel trên cùng hiển thị win rate theo 3/7/14 ngày và theo conviction score.' },
              { title: 'Lọc theo loại', desc: 'Click "MUA" hoặc "BÁN" để xem riêng từng loại tín hiệu.' },
            ],
          },
          {
            type: 'tip',
            variant: 'pro',
            text: 'Conviction 3/3 thường có win rate cao hơn 1/3. Theo dõi tab Lịch Sử 1–2 tháng để tìm loại tín hiệu có độ tin cậy cao nhất với danh mục của bạn.',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'heatmap',
    title: 'Market Heatmap',
    emoji: '🗺️',
    subsections: [
      {
        id: 'heatmap-reading',
        title: 'Đọc bản đồ nhiệt',
        content: [
          {
            type: 'paragraph',
            text: 'Heatmap hiển thị toàn bộ cổ phiếu trong All Tickers dưới dạng treemap. Màu sắc thể hiện % thay đổi giá trong ngày, kích thước ô phụ thuộc vào chế độ Size được chọn.',
          },
          {
            type: 'table',
            headers: ['Màu', '% Thay đổi', 'Ý nghĩa'],
            rows: [
              ['🟩🟩 Xanh đậm', '> +4%', 'Tăng mạnh'],
              ['🟩 Xanh', '+2% → +4%', 'Tăng tốt'],
              ['🟢 Xanh nhạt', '0 → +2%', 'Tăng nhẹ'],
              ['⬜ Xám', '~ 0%', 'Đứng giá'],
              ['🔴 Đỏ nhạt', '0 → -2%', 'Giảm nhẹ'],
              ['🔴 Đỏ', '-2% → -4%', 'Giảm mạnh'],
              ['🔴🔴 Đỏ đậm', '< -4%', 'Giảm rất mạnh'],
            ],
          },
          {
            type: 'tip',
            variant: 'pro',
            text: 'Chế độ "Danh mục": ô được nhóm theo tên watchlist của bạn — dễ nhìn thấy sector nào đang dẫn dắt thị trường. Đặt tên watchlist theo ngành để heatmap chính xác nhất.',
          },
        ],
      },
      {
        id: 'heatmap-modes',
        title: 'Các chế độ hiển thị',
        content: [
          {
            type: 'table',
            headers: ['Chế độ', 'Kích thước ô', 'Dùng khi nào'],
            rows: [
              ['Đều', 'Bằng nhau', 'Xem tổng quan đều nhau, không bị bias vốn hoá'],
              ['Vốn hóa', 'Theo market cap', 'Xem bluechip chiếm bao nhiêu thị trường'],
              ['Volume', 'Theo volume hôm nay', 'Xem dòng tiền đang tập trung vào đâu'],
              ['Danh mục', 'Group theo watchlist', 'Xem performance theo sector'],
              ['Flat', 'Tất cả một level', 'Xem nhanh toàn bộ không phân nhóm'],
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'screener',
    title: 'Screener Nâng Cao',
    emoji: '🔍',
    subsections: [
      {
        id: 'screener-build',
        title: 'Xây dựng điều kiện lọc',
        content: [
          {
            type: 'steps',
            items: [
              { title: 'Mở tab Screener', desc: 'Click tab "Screener" trên header nav.' },
              { title: 'Chọn preset hoặc tự build', desc: 'Click "Dùng" trên preset sẵn có, hoặc tự thêm điều kiện bằng nút "+ Thêm điều kiện".' },
              { title: 'Chọn Field + Operator + Value', desc: 'Field: chọn chỉ báo (RSI, MACD, % 1 tháng...). Operator: < ≤ > ≥ = hoặc "trong khoảng". Value: nhập ngưỡng.' },
              { title: 'Toggle AND / OR', desc: 'Click vào badge AND/OR màu xanh/vàng để đổi logic giữa các điều kiện.' },
              { title: 'Chạy Screener', desc: 'Click nút "Chạy Screener" để lọc qua toàn bộ tickers. Kết quả hiển thị ngay bên dưới.' },
            ],
          },
          {
            type: 'tip',
            variant: 'info',
            text: 'Screener chạy trên masterData (All Tickers). Đảm bảo đã Sync và Refresh All Tickers để có kết quả đầy đủ nhất.',
          },
        ],
      },
      {
        id: 'screener-presets',
        title: '9 Preset sẵn có',
        content: [
          {
            type: 'table',
            headers: ['Preset', 'Điều kiện chính', 'Mục đích'],
            rows: [
              ['🔥 Deep Oversold', 'RSI<32 + Stoch<22 + BB%B<5%', 'Tìm cơ hội mua cực mạnh'],
              ['🚀 Momentum Xác Nhận', 'MACD>0 + RSI 50-70 + Stoch>50', 'Cổ phiếu đang tăng có xác nhận'],
              ['⚠️ Overbought Exit', 'RSI>70 + Stoch>80 + BB%B>95%', 'Danh sách cần chốt lời'],
              ['💎 Value Cơ Bản', 'P/E<15 + EPS>0 + Beta<1.5', 'Cổ phiếu giá trị'],
              ['📈 Breakout Setup', 'BB%B 75-100% + MACD>0 + RelVol>1.5', 'Chuẩn bị breakout'],
              ['📊 Volume Đột Biến', 'RelVol>2x + %ngày>1%', 'Dòng tiền vào mạnh'],
              ['🎯 Gần Đáy 6T', '% trên đáy <10% + RSI<45', 'Vùng tích lũy tiềm năng'],
              ['🏆 Uptrend Mạnh', '≥3 phiên tăng + 1T>5% + MACD>0', 'Cổ phiếu đang trong sóng tăng'],
              ['🌱 Phục Hồi', '3T<-15% + 1W>2% + RSI<50', 'Hàng rẻ bắt đầu phục hồi'],
            ],
          },
          {
            type: 'tip',
            variant: 'pro',
            text: 'Sau khi chạy screener, click vào bất kỳ ticker nào trong kết quả để nhảy về tab Watchlist và xem chart + AI Analysis ngay.',
          },
        ],
      },
      {
        id: 'screener-save',
        title: 'Lưu preset cá nhân',
        content: [
          {
            type: 'steps',
            items: [
              { title: 'Build điều kiện', desc: 'Tạo các điều kiện lọc theo ý muốn.' },
              { title: 'Click "Lưu Preset"', desc: 'Nút vàng ở góc phải query builder.' },
              { title: 'Đặt emoji + tên', desc: 'Chọn emoji và đặt tên gợi nhớ cho preset.' },
              { title: 'Sử dụng lại', desc: 'Preset cá nhân xuất hiện trong mục "Của Tôi" — 1 click để load lại bất kỳ lúc nào.' },
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'market-status',
    title: 'Giờ Thị Trường & Auto Refresh',
    emoji: '⏰',
    subsections: [
      {
        id: 'market-sessions',
        title: 'Các phiên giao dịch HOSE',
        content: [
          {
            type: 'table',
            headers: ['Thời gian (ICT)', 'Phiên', 'Trạng thái'],
            rows: [
              ['Trước 08:00', 'Chưa mở', '🔴 Đóng cửa'],
              ['08:00 – 09:00', 'Trước phiên', '🟡 Hệ thống mở nhưng chưa khớp'],
              ['09:00 – 09:15', 'Phiên ATO', '🟠 Khớp lệnh ATO'],
              ['09:15 – 11:30', 'Sáng', '🟢 Khớp liên tục (nhấp nháy)'],
              ['11:30 – 13:00', 'Nghỉ trưa', '🟡 Tạm dừng'],
              ['13:00 – 14:30', 'Chiều', '🟢 Khớp liên tục (nhấp nháy)'],
              ['14:30 – 15:00', 'Phiên ATC', '🟠 Khớp lệnh ATC'],
              ['Sau 15:00', 'Đóng cửa', '🔴 Đóng cửa'],
            ],
          },
          {
            type: 'tip',
            variant: 'info',
            text: 'Dot xanh nhấp nháy = thị trường đang mở và có thể khớp lệnh. Các ngày lễ (Tết, 30/4, 1/5, 2/9) hiển thị "Nghỉ lễ" thay vì "Đóng cửa".',
          },
        ],
      },
      {
        id: 'auto-refresh',
        title: 'Auto Refresh',
        content: [
          {
            type: 'steps',
            items: [
              { title: 'Bật Auto Refresh', desc: 'Click một trong các nút: 5m / 10m / 15m / 30m trên thanh Market Status.' },
              { title: 'Xem countdown', desc: 'Badge "⚡ 4:32" đếm ngược thời gian đến lần refresh tiếp theo.' },
              { title: 'Tắt Auto Refresh', desc: 'Click icon ZapOff (⚡ có gạch) để tắt, hoặc click lại chính nút interval đang bật.' },
            ],
          },
          {
            type: 'tip',
            variant: 'warning',
            text: 'Dữ liệu Yahoo Finance delay ~15 phút. Auto Refresh 5 phút vẫn sẽ thấy data delay — dùng cho mục đích theo dõi xu hướng, không phải giao dịch tức thời.',
          },
        ],
      },
    ],
  },
];
