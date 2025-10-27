# Báo cáo thực hiện đề tài Omnichannel Ordering

## 1. Thông tin đề tài
- **Đề tài:** Nền tảng đặt món đa kênh (QR-first, omnichannel) cho nhà hàng.
- **Nhóm phụ trách:** Omnichannel Ordering.
- **Đối tượng sử dụng:** Khách tại bàn (không cần đăng nhập truyền thống) và nhân viên quản trị (chủ/quản lý nhà hàng).
- **Mục tiêu giai đoạn này:** Hoàn thiện đầy đủ luồng core từ tạo phiên khách, đặt món, xử lý đơn tới bảng điều khiển quản trị; các tính năng nâng cao (chatbot tư vấn, engine gợi ý) chỉ ở mức thử nghiệm và không tính vào phạm vi báo cáo tiến độ core.

## 2. Kiến trúc repo & công nghệ
- **Monorepo pnpm** (`pnpm-workspace.yaml`) gồm các gói:
  - `be/`: Backend Node.js + Express + Sequelize (MySQL) với kiến trúc service/controller, phát SSE realtime.
  - `fe-customer/`: Ứng dụng React 18 dành cho khách, tối ưu mobile, React-Bootstrap, Context API.
  - `fe-administrator/`: Ứng dụng React 18 dành cho quản trị, Redux Toolkit + axios interceptor.
  - `chat-infrastructure/`: Dịch vụ RAG (FastAPI) hỗ trợ trợ lý hội thoại tùy chọn.
  - `minio/`: Dịch vụ Node/TypeScript mẫu tích hợp MinIO để lưu trữ asset menu.
- **Công nghệ chính:** Express 4, Sequelize 6, JWT, SSE, React Router v6, React-Bootstrap, Toastify, Redis/Qdrant/Ollama (cho chatbot tùy chọn), Docker Compose cho MinIO.

## 3. Chức năng core hiện có

### 3.1 Backend `be/`
| Nhóm chức năng | Mô tả | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| Quản lý đăng nhập quản trị (`src/api/routes/adminAuth.routes.js`) | JWT + refresh token, mời nhân viên, reset mật khẩu | Hoàn thành | Đã có middleware `authenticateAdmin` và luồng rotate token |
| Phiên khách & đặt món (`customer.routes.js`) | Khởi tạo phiên QR, duyệt menu, đặt hàng, quản lý giỏ, theo dõi trạng thái | Hoàn thành | Dùng `guest_sessions`, validate bằng Joi |
| Xử lý đơn & KDS (`order.routes.js`) | CRUD đơn, cập nhật trạng thái, SSE cho kitchen/customer | Hoàn thành | `streamOrdersController` phát sự kiện realtime |
| Thanh toán mock (`payment/`) | Gateway mô phỏng Stripe, tạo `paymentIntent`, cập nhật trạng thái | Hoàn thành (mock) | Sẵn sàng thay bằng Stripe thật qua biến môi trường |
| Thành viên & Loyalty (`customer.controller.js`) | Đăng ký/verify membership, mã PIN, xác thực 2FA | Hoàn thành (đang thử nghiệm) | Gửi email xác thực qua `email.service.js` |
| Khuyến mãi & Voucher (`management.routes.js`) | CRUD promotion, gửi email chiến dịch, khách claim voucher | Hoàn thành | Có token claim qua email & API `/vouchers` |
| Analytics dashboard (`dashboard.service.js`) | Tổng hợp orders, doanh thu, top menu, session hoạt động | Hoàn thành | Cung cấp dữ liệu cho dashboard admin |
| Gợi ý giỏ hàng (`recommendation.service.js`) | Gợi ý món theo lịch sử (luồng `/customer/recommendations`) | Beta | Thuật toán dựa trên cặp món, cần dữ liệu thực để tinh chỉnh |
| Lưu trữ asset (`storage.service.js`) | Kết nối MinIO/S3, upload ảnh menu | Hoàn thành | Cấu hình qua `STORAGE_*` |
| Hạ tầng thông báo | Gửi email (SMTP), SSE thông báo khách, lộ trình push/SMS | Hoàn thành (cần cấu hình SMTP) | Table `notifications` hỗ trợ mở rộng |

### 3.2 Ứng dụng khách `fe-customer/`
| Khu vực | Mô tả | Trạng thái | Đường dẫn chính |
| --- | --- | --- | --- |
| Khởi tạo phiên QR | Lấy `qrSlug`, lookup bàn, lưu session token | Hoàn thành | `context/SessionContext.jsx`, `components/common/SessionSetup.jsx` |
| Duyệt menu & giỏ hàng | Render danh mục, thêm/xóa món, tính tổng | Hoàn thành | `pages/MenuPage.jsx`, `context/CartContext.jsx` |
| Checkout & thanh toán | Gửi đơn, nhận phản hồi, reset giỏ | Hoàn thành | `pages/CheckoutPage.jsx`, `services/orders.js` |
| Theo dõi đơn realtime | Nghe SSE, rung âm báo READY/COMPLETED, thông báo trình duyệt | Hoàn thành | `pages/OrdersPage.jsx`, `hooks/useOrderStream.js` |
| Quản lý voucher & khuyến mãi | Liệt kê, claim, áp mã | Hoàn thành | `pages/VouchersPage.jsx`, `services/promotions.js` |
| Hồ sơ & bảo mật | Cập nhật membership, thiết lập/disable authenticator | Hoàn thành | `pages/ProfilePage.jsx` |
| Chat assistant | Giao diện hỏi đáp dựa trên RAG | POC (ngoài phạm vi core) | `components/chat/ChatAssistant.jsx`, `services/chat.js` |

### 3.3 Ứng dụng quản trị `fe-administrator/`
| Khu vực | Mô tả | Trạng thái | Đường dẫn chính |
| --- | --- | --- | --- |
| Xác thực quản trị | Login, accept invitation, reset password | Hoàn thành | `pages/LoginPage.jsx`, `pages/InvitationAcceptPage.jsx` |
| Dashboard tổng quan | KPI trong ngày, phân bố trạng thái, top món | Hoàn thành | `pages/DashboardPage.jsx`, `services/dashboard.service.js` |
| Theo dõi đơn realtime | Board cập nhật SSE, thay đổi trạng thái, ghi chú khách | Hoàn thành | `pages/OrdersPage.jsx`, `services/orders.service.js` |
| Quản lý menu | CRUD item, danh mục, upload ảnh | Hoàn thành | `pages/ManagementPage.jsx` |
| Quản lý bàn | Danh sách, cập nhật QR slug, trạng thái phiên | Hoàn thành | `pages/TablesPage.jsx` |
| Quản lý khách & membership | Tạo/sửa hội viên, đồng bộ loyalty | Hoàn thành | `pages/ManagementPage.jsx` |
| Chiến dịch promotion | Lập chương trình, gửi email, theo dõi thống kê | Hoàn thành (cần SMTP) | `services/promotions.service.js` |
| Gợi ý menu | Bảng phân tích attach-rate từ recommendation service | Beta | `services/recommendations.service.js` |

### 3.4 Hạ tầng bổ trợ
- **`chat-infrastructure/rag_service/`**: FastAPI + Redis + Qdrant + Ollama. Hỗ trợ chatbot cho khách; tài liệu setup chi tiết trong `chat-infrastructure/README.md`. Hiện đóng vai trò POC, chưa bắt buộc cho core.
- **`minio/`**: Service TypeScript mẫu để chạy MinIO cục bộ phục vụ upload ảnh menu từ backend/admin. Có Docker Compose và API test sẵn.

## 4. Tiến độ triển khai (tính năng core)
| Mốc | Hạng mục | Kết quả | Trạng thái |
| --- | --- | --- | --- |
| Tuần 1-2 | Phân tích nghiệp vụ, mô hình dữ liệu | ERD, luồng use-case customer/admin, chuẩn hóa bảng MySQL | ✓ Hoàn thành |
| Tuần 3 | Thiết kế kiến trúc backend & hạ tầng realtime | Hoàn thiện skeleton Express, mô-đun hóa service, SSE hub | ✓ Hoàn thành |
| Tuần 4 | Luồng khách (session → menu → giỏ → đơn) | React customer app, API `/customer/*`, giỏ hàng & checkout | ✓ Hoàn thành |
| Tuần 5 | Luồng quản trị đơn & dashboard | Admin app, SSE kitchen, bảng điều khiển tổng quan | ✓ Hoàn thành |
| Tuần 6 | Loyalty, promotion, voucher | Backend membership + email token, UI quản trị voucher | ✓ Hoàn thành (đang tinh chỉnh UX) |
| Tuần 7 | Thanh toán mock + thông báo | Payment intent, cập nhật trạng thái chi trả, email xác nhận | ✓ Hoàn thành (cần kiểm thử thêm) |
| Tuần 8 | Recommendation + chatbot POC | Service gợi ý giỏ hàng, tích hợp chat assistant | Đang thử nghiệm (ngoài phạm vi core) |

Các lỗi còn mở: tối ưu hiệu năng danh mục lớn, template email (HTML) cần chuẩn hóa, bổ sung test tự động cho luồng hủy/hoàn tiền.

## 5. Báo cáo giữa kỳ & demo Topic
- **Nội dung báo cáo giữa kỳ:** trình bày kiến trúc tổng thể, demo luồng khách và quản trị, kết quả kiểm thử, phân tích ghi nhận từ dashboard.
- **Demo video:** hiện lưu tại `../Report1/demo/Omnichannel Ordering - Customer.mp4` và `../Report1/demo/Omnichannel Ordering - Administrator.mp4` (cùng cấp repo).
- **Phản hồi hội đồng:** luồng core ổn định; đề nghị bổ sung biểu đồ realtime và kiểm tra tải với nhiều bàn hoạt động đồng thời.

## 6. Công việc ưu tiên trước khi nghiệm thu
- Chuẩn hóa template email/SMS, cấu hình SMTP thực để kiểm thử end-to-end.
- Bổ sung kiểm thử tích hợp (API + UI) cho các luồng quan trọng: thanh toán thất bại, hủy đơn, gửi voucher.
- Tối ưu tải menu lớn (pagination/filter phía server, cache).
- Đóng gói script triển khai MinIO và chat RAG cho môi trường staging (nếu sử dụng).
- Hoàn thiện tài liệu hướng dẫn vận hành cho quản trị viên và checklist QA.

## 7. Đề xuất
- **Hạ tầng:** Nhờ bộ phận DevOps hỗ trợ pipeline deploy Docker (backend + 2 frontend) và dịch vụ MinIO.
- **Dữ liệu:** Thiết lập cron ETL đơn giản thu thập thống kê cho recommendation trước khi nâng cấp thuật toán.
- **Bảo mật:** Đánh giá lại vòng đời token, bổ sung rate-limit cho endpoint nhạy cảm (`/customer/auth/*`).
- **Mở rộng tương lai:** Sau khi core ổn định, cân nhắc mở UAT với nhà hàng thử nghiệm để thu thập insight; chatbot & recommendation chỉ bật khi có nguồn lực vận hành RAG service ổn định.
