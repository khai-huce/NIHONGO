# Tiến độ flashcard Kanji theo tài khoản

Phạm vi T8–T12: lưu trạng thái đã thuộc/chưa thuộc của flashcard Kanji trong màn Hán tự. Dùng Express, session và PostgreSQL hiện có; thêm một bảng, không thêm dependency.

## Rà soát dữ liệu (T8)

| Dữ liệu hiện tại | Nơi lưu | Xử lý đợt này |
|---|---|---|
| Flashcard Kanji: `memorizedIds` | React state, mất khi đóng flashcard | Chuyển sang API khi đăng nhập |
| Kanji yêu thích, cài đặt | localStorage | Giữ nguyên |
| Bài học chủ động, từ đánh dấu | localStorage | Giữ nguyên |
| Lộ trình cá nhân, cấp JLPT, bài đọc tự tạo | localStorage | Giữ nguyên |
| Flashcard chủ động, trang ôn tập tổng hợp | Luồng riêng | Chưa nối API tiến độ Kanji |

Không có tiến độ flashcard Kanji cũ được lưu bền để nhập. Không dùng favorites hoặc dữ liệu giả ở trang ôn tập làm bằng chứng đã thuộc. Học thử giữ trạng thái trong lần mở flashcard; đăng nhập bắt đầu từ dữ liệu tài khoản, không tự nhận trạng thái khách.

## Database và API (T9–T10)

`kanji_progress`: khóa chính `(user_id, kanji_id)`, `memorized` boolean, `reviewed_at` thời gian server. FK user xóa cascade. Không lưu lại tên/nghĩa Kanji, không lưu bộ đếm có thể tính từ danh sách.

- `GET /api/progress/kanji`: trả userId và toàn bộ tiến độ của phiên hiện tại; no-store.
- `POST /api/progress/kanji`: `{ kanjiId, memorized, expectedUserId }`, cập nhật hoặc tạo một dòng. Chỉ chấp nhận ID có trong catalog.
- Quyền sở hữu lấy từ session; `expectedUserId` chỉ đối chiếu để chặn trang cũ ghi nhầm khi tab khác đổi tài khoản. Không khớp trả 409, không ghi dữ liệu.
- Session thiếu/hết hạn hoặc tài khoản đã xóa trả 401. Origin/JSON kiểm tra như API auth. Lỗi hạ tầng trả 503 và không lộ chi tiết.
- Lần đánh giá ghi thành công sau cùng quyết định trạng thái. Thử lại cùng đánh giá không tạo thêm dòng. Không có hàng đợi offline hoặc cập nhật trực tiếp giữa tab; mở lại flashcard/tải trang để lấy dữ liệu mới.

Catalog backend: `server/src/kanji-ids.ts`. Khi thêm/bỏ Kanji trong `src/data/kanjiData.ts`, cập nhật danh sách ID này cùng thay đổi; kiểm thử tự động đối chiếu hai danh sách.

## Giao diện (T11)

Mở Hán tự → Flashcard. Khi đăng nhập, tải tiến độ từ server và đếm các Kanji đã thuộc trong danh sách đang học. Mỗi lần bấm Đã thuộc/Chưa thuộc phải được API xác nhận trước khi chuyển thẻ. Chưa thuộc bỏ trạng thái đã thuộc trước đó; nút mũi tên chỉ chuyển thẻ.

Trong lúc tải/lưu, khóa nút đánh giá. Lỗi tải có nút tải lại; lỗi lưu giữ thẻ để người dùng thử lại. Đổi tài khoản remount flashcard, bỏ dữ liệu và phản hồi cũ. Modal có thể cuộn trên màn hình thấp.

## Nghiệm thu (T12)

- Test PostgreSQL riêng: yêu cầu phiên hợp lệ, lưu qua restart/phiên đăng nhập khác, request đồng thời không tạo trùng, tách hai tài khoản, chặn expectedUserId cũ, cascade khi xóa user, validation và Origin, lỗi lưu rồi thử lại.
- Test đối chiếu catalog frontend/backend; giữ toàn bộ test auth cũ.
- UI: học thử → đăng nhập không nhập nhầm tiến độ; đánh dấu đã thuộc → tải trang mới vẫn giữ tiến độ; đánh dấu chưa thuộc cập nhật về chưa thuộc.
- Lệnh: `npm run test:server`, `npm run build:server`, `npm run build`.

Kết quả ngày 08/09/2026: hoàn thành T8–T12. 27/27 kiểm thử PostgreSQL đạt (21 auth + 6 progress); frontend/backend build thành công. Vite vẫn báo bundle lớn hơn 500 kB như trước đợt này.

UI đã thử bằng tài khoản QA: học thử không nhập nhầm vào tài khoản, lưu đã thuộc và mở trang mới khôi phục đúng; Chưa thuộc cập nhật DB về false. Ngắt API khi đang học: báo lỗi, giữ thẻ và số đã thuộc; khởi động API rồi thử lại lưu thành công. Kiểm thử API xác nhận dữ liệu giữ qua restart và phiên đăng nhập khác, tách hai tài khoản và không tạo trùng bản ghi.

Không thay đổi dữ liệu học của tài khoản Google của người dùng trong lượt QA. Hai bản ghi flashcard thử nghiệm thuộc tài khoản QA `ui-test-20260908@example.com`.

## Giao diện flashcard theo mẫu

Khung xanh đậm và thanh công cụ giữ cố định; chỉ nội dung ở giữa xoay 3D trong 580 ms khi bấm chữ hoặc Space. Có chế độ giảm chuyển động theo thiết lập hệ điều hành. Hai chiều JP→VI/VI→JP, xem chi tiết Kanji, nghe phát âm, yêu thích trên thiết bị, học lại từ đầu (giữ tiến độ), trộn thẻ và tự động lật/chuyển thẻ. Tự động phát không đánh giá thay người học.

Phím tắt: Space lật, ←/A và →/D chuyển thẻ, ↑/Z đã thuộc, ↓/X chưa thuộc, C yêu thích, P tự động phát, Esc đóng. Bảng hướng dẫn mở từ thanh phím tắt; cài đặt chọn 3/5/8 giây mỗi mặt. Nút đánh giá vẫn chờ API lưu thành công trước khi chuyển thẻ.
