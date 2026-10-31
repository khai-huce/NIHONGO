# O01 — Chuông thông báo ôn tập

Hoàn thành local 28/10/2026 theo ba lựa chọn của người dùng.

## Cách dùng và quy tắc

- Chuông trên header mở hộp thông báo. Chấm đỏ báo có nhóm chưa đọc; mở hộp chưa tự đánh dấu đã đọc.
- Mỗi loại Kanji/Từ vựng/Ngữ pháp có một nhắc ôn trong ngày, chỉ khi có thẻ đang gắn sao và `dueAt <= serverNow`. Số thẻ lấy trực tiếp từ `review_cards` của tài khoản.
- Bấm một thông báo: lưu đã đọc thành công rồi mở `/ca-nhan/on-tap?type=kanji|vocab|grammar`. Nút **Đánh dấu tất cả đã đọc** chỉ đánh dấu các nhóm đang hiển thị, không điều hướng.
- Đã đọc được giữ sau F5/đổi thiết bị. Ngày tính theo UTC+7 Việt Nam; thẻ đến hạn thêm cùng ngày chỉ tăng số lượng, không bật lại chưa đọc cho nhóm đã đọc. Sang ngày mới có thẻ đến hạn thì nhắc lại.
- Ôn hết/bỏ sao hết thẻ đến hạn thì nhóm biến mất. Gắn lại trong cùng ngày vẫn giữ đã đọc. Không có lịch sử thông báo, email, push, thông báo admin hoặc lịch chạy nền trong O01.
- Khách bấm chuông thấy lời mời đăng nhập, không có dữ liệu mẫu. Lỗi có Thử lại; lỗi lưu không tự chuyển trang/đánh dấu thành công.

## Kỹ thuật

- Bảng `notification_reads` có FK user, khóa `(user_id, category)`, lưu `read_day` mới nhất và `read_at`: tối đa ba hàng/tài khoản, không sao chép nội dung thẻ. Migration cộng thêm `202610280001_review_notifications`, không reset hoặc thay lịch ôn.
- `GET /api/notifications?expectedUserId=...`: phiên đang tồn tại, đúng tài khoản, thống kê các thẻ active đến hạn; snapshot RepeatableRead cùng trạng thái đã đọc. Trả userId/day/serverNow/nextDueAt và nhóm có count/label/read.
- `POST /api/notifications/read`: expectedUserId/day/categories. Kiểm phiên, tài khoản, Origin/JSON; từ chối ngày cũ (409), chỉ ghi nhóm hiện có thẻ đến hạn. Upsert gửi lại an toàn. Cả hai API no-store và hạn mức 180/phút/IP.
- Frontend tách trong `features/notifications/NotificationBell.tsx`, gắn vào TopHeader. Key theo tài khoản và generation bỏ phản hồi cũ; chặn gửi lặp. Tải lại sau thay đổi review trong cùng tab, khi mở chuông/focus/tab hiện và tối đa mỗi 60 giây; hẹn sớm hơn ở lịch đến hạn gần nhất hoặc nửa đêm. Tab ẩn không gọi polling. Không dùng localStorage để nhập dữ liệu vào tài khoản.
- Header z-index 45 để hộp không bị Sidebar (40) che trên điện thoại, vẫn dưới hộp đăng nhập/cài đặt (50). Giữ vị trí chuông và bố cục trang.

## Kiểm tra

- 5 kiểm thử API gồm đăng nhập/tài khoản/Origin, nhóm thẻ active đến hạn, đọc lặp/đọc tất cả, giữ đã đọc khi tăng thẻ, biến mất khi hết hạn/bỏ sao, ranh giới nửa đêm Việt Nam và stale-day.
- 186 kiểm thử FE/admin/shared, TypeScript API/tests, build API/web và check:boundaries đạt.
- UI bằng tài khoản QA trong DB test riêng: khách/đăng nhập, hai nhóm, mở đúng tab Từ vựng, chấm đỏ giảm 2→1, F5 giữ đã đọc, đánh dấu tất cả; desktop và 390px. Không tạo sao/XP hoặc dữ liệu mẫu trên DB chính.
- Migration đã áp dụng local và test. Hộp dùng dữ liệu thật khi người dùng đăng nhập.

Phiên QA đã đăng xuất, dữ liệu riêng QA đã dọn khỏi DB test và API dev đã trả lại database chính.
