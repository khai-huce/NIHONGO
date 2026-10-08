# P07 — Học và lưu tiến độ lộ trình Kanji cá nhân

Hoàn thành ngày 15/09/2026. Phạm vi: lộ trình tự tạo trong **Lộ trình của tôi**. Người dùng đã duyệt cả ba lựa chọn: mọi chữ được đánh giá thì hoàn thành ngày; học lại giữ hoàn thành; chi tiết dùng lại khung chọn ngày/danh sách chữ, số ngày hoàn thành, phần trăm và nút quay lại, mở flashcard Kanji hiện có.

## Luồng đã triển khai

- **Học ngay** trên danh sách mở ngày chưa hoàn thành đầu tiên. Nếu đã hoàn thành toàn bộ, mở ngày cuối hợp lệ để học lại. Không hiển thị ngày vượt tổng ngày.
- Chi tiết chia đúng danh sách theo thứ tự đã nhập và số chữ/ngày; ngày cuối có thể ngắn hơn. Hai mũi tên và thanh chọn ngày chỉ thay ngày đang xem. **Đã học** là số ngày hoàn thành/tổng ngày; **Tiến độ** là phần trăm số ngày hoàn thành, không tính từ ngày đang chọn.
- **Học ngay** trong chi tiết gọi server bắt đầu rồi mở flashcard cũ. Lần bắt đầu đầu tiên ghi `startedAt`, khóa đổi số chữ/ngày. Chỉ mở chi tiết, chọn ngày hoặc nghe phát âm không ghi tiến độ.
- Ngày đang dở mở ở chữ chưa được đánh giá đầu tiên, kể cả các chữ trước đó được đánh giá Chưa thuộc. URL giữ lộ trình/ngày qua F5 và qua màn chi tiết Kanji; F5 quay về chi tiết, bấm Học ngay để tiếp tục.
- **Đã thuộc / Chưa thuộc** chỉ chuyển thẻ sau khi lưu thành công. Khi mọi chữ trong ngày có đánh giá, trở về chi tiết với thông báo hoàn thành. Học lại ngày hoàn thành mở từ đầu, chỉ cập nhật đánh giá, không xóa hoàn thành đã lưu.
- Lật/chuyển/trộn thẻ, tự động phát và nút học lại từ thẻ đầu không tự đánh giá. Bấm đúp/giữ phím không đánh giá nhiều thẻ ngoài ý muốn.
- Lỗi lưu giữ thẻ hiện tại và yêu cầu **Tải lại** tiến độ trước khi học tiếp. Tab cũ bị chặn bằng phiên bản; tải bản mới không tự gửi lại đánh giá cũ. Mất phản hồi mạng nhưng server đã lưu được khôi phục qua tiến độ đã lưu.
- Đánh giá trong lộ trình đồng thời cập nhật trạng thái Kanji của tài khoản. Tiến độ hoàn thành vẫn riêng từng lộ trình; Đã thuộc ở Hán tự hoặc ở lộ trình khác không tự hoàn thành ngày này.
- Chỉ ⭐ chủ động thêm vào Ôn tập. Bỏ sao giữ lịch/lịch sử; việc hoàn thành hoặc học lại không tác động SRS.

## Dữ liệu và API

Migration cộng thêm `202609150001_roadmap_progress` mở rộng bảng `personal_roadmaps`, không thêm hệ thống hoạt động chung hoặc bảng SRS:

- `assessments` JSONB: bản đồ ID Kanji → boolean, gồm cả đánh giá false.
- `completed_days` integer[]: những ngày đã hoàn thành; được giữ khi học lại.
- `progress_version` integer: phiên bản riêng của tiến độ, độc lập với đổi tên.

GET/CRUD lộ trình trả thêm ba trường trên (`completedDays`, `progressVersion`) và `currentDay` dẫn xuất. Không nhận completedDays/assessments tùy ý từ frontend.

| API | Input | Hành vi |
|---|---|---|
| `POST /api/roadmaps/start` | `id, expectedUserId, version, day` | Kiểm tra chủ, phiên bản nội dung, catalog/ngày; ghi startedAt lần đầu; trả lộ trình hiện tại |
| `POST /api/roadmaps/rate` | `id, expectedUserId, progressVersion, day, kanjiId, memorized` | Kiểm tra đã bắt đầu, chữ thuộc ngày, phiên bản; lưu đánh giá, hoàn thành ngày và global Kanji trong cùng transaction |

Hai API giữ session/Origin, JSON strict, body 16 KiB và hạn mức có sẵn. Dùng chung khóa transaction theo tài khoản với tạo/sửa/xóa P06 để chặn xung đột mục tiêu. Đổi tên không làm mất lượt học; đổi mục tiêu sau bắt đầu bị chặn. Gửi lại đánh giá với phiên bản cũ trả 409 `ROADMAP_PROGRESS_CHANGED`, không áp dụng lại. Xóa lộ trình xóa tiến độ riêng của lộ trình đó, giữ trạng thái Kanji và SRS hiện có.

`packages/shared/src/study/roadmap.mjs` chia ngày; `packages/shared/src/study/roadmap-study.mjs` tính tiến độ dùng chung FE/BE. Không thêm thư viện.

## Khách và giao diện

Khách lưu trong key cũ `nhai_kanji_custom_roadmaps`, kiểm tra snapshot/phiên bản và Web Locks như P06. Không tự nhập vào tài khoản. Dữ liệu khách cũ chưa có đánh giá khởi tạo tiến độ rỗng khi đọc, không viết lại storage chỉ vì mở trang; `currentDay` cũ không chứng minh đã học. Chữ chưa có catalog được giữ nguyên, báo rõ và chặn học toàn lộ trình thay vì bỏ chữ làm lệch ngày.

Giữ giao diện danh sách/tạo/sửa/xóa, nhãn Học ngay và flashcard. Chi tiết mới nằm trong phạm vi đã duyệt, dùng màu/font/khung hiện có. Không sao chép Streak/số mẫu từ tab mặc định. JSX tab mặc định được đối chiếu với HEAD và giữ nguyên; nội dung/tiến độ thật của tab này thuộc P08.

## Nghiệm thu

- `npm run test:server`: **132/132 test đạt**, gồm 16 P06 và 11 P07. Bao phủ session/tài khoản/Origin, giả mạo trường, ngày/chữ sai, ngày cuối, false, học lại, hai lộ trình trùng chữ, khởi động lại API, hai tab, bắt đầu đồng thời đổi mục tiêu, xóa và rollback toàn transaction.
- Toàn bộ 7 file test FE/shared: **39/39 đạt**; gồm 5 chia ngày/catalog và 4 quy tắc tiến độ. Có script `npm run test:roadmap-study`.
- `npm run build`, `npm run build:server`, typecheck backend tests: đạt. Vite vẫn có cảnh báo bundle trên 500 kB đã tồn tại; không thêm chia bundle ngoài phạm vi P07.
- UI trên tài khoản QA riêng: tạo 6 chữ/5 mỗi ngày; chuyển ngày hiển thị đúng 5+1 chữ và 0%; tự động phát không tính đánh giá; bấm đúp Chưa thuộc chỉ lưu một chữ; F5 mở lại từ chữ thứ hai.
- Đánh giá đủ ngày 1 gồm cả false → 1/2 ngày, 50%; trở về danh sách rồi Học ngay mở ngày 2. Đánh giá ngày cuối → 2/2, 100%; học lại vẫn giữ hoàn thành.
- Hai tab cùng ngày: tab thứ hai nhận 409, nút đánh giá khóa, Tải lại về kết quả mới đúng. Tạm dừng riêng API → báo lỗi và giữ thẻ; khởi động lại → Tải lại và lưu tiếp thành công. PostgreSQL không bị dừng.
- Kiểm tra nút sao/bỏ sao, mở đúng chi tiết Kanji và quay về đúng lộ trình; mục tiêu/ngày bị khóa sau bắt đầu. DB đối chiếu trước gắn sao có 6 đánh giá nhưng **0 thẻ sao**; gắn/bỏ sao tạo đúng thẻ Kanji rồi giữ inactive.
- Khách học một chữ Chưa thuộc → hoàn thành; F5 vẫn 1/1 và 100%. Đăng nhập lại chỉ thấy lộ trình tài khoản, không nhận lộ trình khách. Đăng xuất quay về dữ liệu khách riêng.
- Đối chiếu screenshot chi tiết/flashcard: đủ khung đã duyệt, lật nội dung trong khung đứng yên. Tài khoản/phiên/lộ trình/thẻ QA và lộ trình khách QA đã dọn; không xóa dữ liệu người dùng. API local hoạt động trở lại.

P07 hoàn thành. Ngày 16/09/2026, P08 đã nối tab mặc định với 28 chữ N5 theo phạm vi được duyệt; xem [DEFAULT_ROADMAP.md](DEFAULT_ROADMAP.md). P07/P08 dùng chung logic phiên học và overlay flashcard; tiến độ từng lộ trình vẫn riêng.
