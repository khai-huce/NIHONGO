# P04 — Tiến độ Flashcard Chủ động

Triển khai và kiểm chứng ngày 13/09/2026 theo cả ba lựa chọn người dùng đã chốt. Giữ bố cục, màu, nhãn, nút, phím tắt và màn kết quả hiện có.

## Hành vi

1. Chọn bài và **Bắt đầu Flashcard**: tài khoản tải nội dung cùng tiến độ từ server, mở từ đầu tiên chưa được đánh giá. Nếu tất cả đã được đánh giá, mở màn kết quả hiện có.
2. **Đã biết (Z)** / **Chưa biết (X)** lưu trạng thái của UUID từ. Chỉ chuyển tiếp sau khi server xác nhận. Đánh giá lại thay trạng thái cũ, không cộng trùng số lượng. Cả hai trạng thái đều được tính là đã đánh giá.
3. Sau mỗi lần lưu, tìm từ chưa đánh giá tiếp theo, có quay vòng tới những từ đã bỏ qua. Xem, lật, phát âm, chuyển, xáo trộn hoặc tự động phát không ghi đánh giá và không tạo sao.
4. **Học lại từ đầu** / nút bắt đầu lại hiện có hỏi xác nhận tên bài và số từ đã đánh giá. Chỉ xóa trạng thái Flashcard của bài đó; các bài khác và toàn bộ sao/lịch Ôn tập giữ nguyên.
5. Sửa từ, cách đọc, Hán Việt hoặc nghĩa giữ tiến độ theo UUID. Từ mới bắt đầu chưa đánh giá; xóa từ/bài chỉ dọn tiến độ của nguồn đó, vẫn giữ thẻ Ôn tập độc lập theo P02. Cùng nội dung ở hai bài có UUID khác nhau và tiến độ riêng.
6. F5 rồi mở lại Flashcard tiếp tục từ dữ liệu server. Khi quay lại tab và kiểm tra phiên, nạp lại tiến độ và xác định lại vị trí/màn kết quả. Không ghi phản hồi cũ sang tài khoản hoặc bài mới.

Khách tiếp tục học bằng state trong lượt đang mở, không nhập tiến độ khách vào tài khoản hoặc tạo dữ liệu tài khoản từ localStorage. P04 không lưu lượt quiz/gõ, lịch sử phiên Flashcard, XP hoặc thứ tự xáo trộn; các phần này không phải lựa chọn đã duyệt.

## Lưu trữ và API

- Migration cộng thêm `202609120001_vocab_progress`: bảng `vocab_progress` với khóa `(user_id, word_id)`, `lesson_id`, `memorized`, `updated_at`; thêm `vocab_lessons.progress_version`. Không thay/xóa dữ liệu đã có.
- `version` tiếp tục bảo vệ nội dung bài; `progress_version` bảo vệ trạng thái học. Đánh giá không làm tăng version nội dung, nên việc học không tự gây xung đột với màn sửa bài đang mở.
- `GET /api/vocab/progress?lessonId=UUID`: trả `userId`, `lessonId`, `lessonVersion`, `progressVersion`, `words`, `progress: [{wordId, memorized}]` trong cùng một snapshot.
- `POST /api/vocab/progress/rate`: nhận `lessonId`, `expectedUserId`, `lessonVersion`, `progressVersion`, `wordId`, `memorized`.
- `POST /api/vocab/progress/reset`: nhận cùng định danh/version và `confirmedCount` là số từ **đã đánh giá**, không phải tổng số từ trong bài.
- Hai POST trả snapshot đầy đủ sau lưu. Dùng kiểm tra phiên, Origin, JSON, schema và tài khoản hiện có; không nhận ID từ ngoài bài. Giới hạn body mặc định 16 KiB và 120 request/phút.
- Đọc/ghi dùng transaction và cùng khóa theo tài khoản với sửa/nhập bài và sao. Reset tăng progress version, kể cả khi chưa có đánh giá; màn cũ không thể ghi ngược tiến độ.

Khi hai tab dùng version cũ, API trả `409 PROGRESS_CHANGED`. FE giữ thẻ, khóa đánh giá và cho **Tải lại tiến độ**. Lỗi lưu hoặc phản hồi thành công bị thất lạc không tự gửi lại; đọc lại server rồi mới tiếp tục. Chặn gửi đồng thời bằng ref, bỏ click thứ hai của double-click và phím giữ lặp. Không cần bảng receipt hoặc hàng đợi offline.

Môi trường local đã chạy `prisma generate` và `npm run db:migrate` (migrate deploy). Máy khác sau khi lấy thay đổi chạy hai bước này trước khi khởi động API.

## Bằng chứng nghiệm thu

- `npm run test:server`: **90/90 đạt**, 5 tệp trên database được bảo vệ `nihongo_test`: auth/review 40, P04 17, lessons 17, import 11, review stats 5.
- 17 kiểm thử P04 bao gồm phiên/tài khoản/Origin/input; đọc lại sau đăng nhập khác và khởi động app khác; UUID giữa bài/tài khoản; đánh giá thay thế; sửa/xóa/nhập; reset đúng bài và đúng số xác nhận; giữ SRS; hai đánh giá đồng thời, rate/reset và xóa nguồn/rate; rollback khi lỗi xảy ra sau ghi.
- FE: `test:vocab-progress` **6/6**, `test:import` **11/11**, `test:review` **2/2**, `test:routes` **2/2**. Kiểm thử bộ đếm, trạng thái false, sửa/xóa/thêm ID và tìm từ chưa đánh giá có quay vòng.
- `npm run build` và `npm run build:server` đạt. Vite vẫn cảnh báo bundle trên 500 KiB như trước; không thay cấu trúc bundle trong task này.
- Trình duyệt local với tài khoản QA riêng: đăng nhập → bài 3 từ → bấm đúp Đã biết chỉ qua 1 từ → Chưa biết → F5/mở lại đúng từ thứ 3 → hoàn thành → đánh giá lại đổi số đếm từ 2/1 thành 1/2, tổng vẫn 3. Mở tab khác đọc đúng kết quả; đối chiếu database đúng 3 trạng thái và progress version.
- Reset qua API ở phiên khác → màn cũ đánh giá nhận lỗi, không chuyển thẻ → **Tải lại tiến độ** trở về từ đầu, thao tác học được mở lại. Lỗi tải lần đầu do bài không tồn tại hiển thị nút tải lại hoạt động; khôi phục riêng fixture và bấm tải lại đọc được dữ liệu, không bị khóa vĩnh viễn.
- Sau khi thu hồi phiên QA, mở Flashcard từ danh sách đang giữ trên FE nhận thông báo đăng nhập lại và khóa đánh giá; F5 trở về khách với danh sách riêng trống, không nhận bài QA vào thiết bị. Xác nhận tài khoản QA không có thẻ Ôn tập tự phát sinh.
- Đối chiếu AST với `HEAD` trước P04: giữ đủ **74 className tĩnh** và mọi nhãn JSX cũ của Flashcard. Chỉ thêm 2 className của thông báo/trợ giúp lỗi và nhãn **Tải lại tiến độ**. Đã xem trực tiếp mặt trước, mặt sau và kết quả.
- Hộp xác nhận học lại trên UI hiện đúng tên bài và **3 từ đã đánh giá**. Công cụ trình duyệt bị timeout khi điều khiển hộp `window.confirm`, nên thao tác bấm xác nhận/hủy trong UI chưa được nghiệm thu tự động; API reset, kiểm tra số lượng, rollback và giữ SRS đều đã qua kiểm thử. Không thay hộp thoại hay giao diện để né lỗi công cụ.

Dữ liệu QA được tạo riêng và dọn sau kiểm thử; không dùng hoặc xóa bài học của người dùng. Task kế tiếp trong backlog là P05, cần chốt phạm vi lưu kết quả quiz/gõ trước khi triển khai.
