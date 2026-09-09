# P01 — Bài học Chủ động theo tài khoản

Triển khai local ngày 09/09/2026. Giữ nguyên màn `/ca-nhan/chu-dong`, bố cục, nhãn, khung nét vẽ và ba chế độ học. Chỉ nối dữ liệu và dùng vùng toast hiện có để báo tải/lưu/lỗi; khóa thao tác đang chờ server.

## Phạm vi và dữ liệu

- Đã đăng nhập: tạo/danh sách/đổi tên/xóa bài được lưu PostgreSQL theo tài khoản. Từ của bài được lưu cùng bài để nhập/sửa/xóa/demo và học bằng các nút hiện có vẫn hoạt động sau F5. Không chuyển riêng tên bài rồi để mất nội dung từ.
- Chưa đăng nhập: tiếp tục dùng `chu_dong_lessons` trên thiết bị như trước. Đăng nhập không đọc hoặc tự đưa dữ liệu này vào tài khoản; đăng xuất trở lại dữ liệu khách. Dữ liệu khách hỏng hoặc không ghi được localStorage báo lỗi, không tự thay bản gốc bằng danh sách rỗng.
- Bài đang chọn chỉ là lựa chọn trên thiết bị, dùng key riêng `chu_dong_selected_lesson:<userId>` cho tài khoản; key khách cũ được giữ.
- Chưa lưu tiến độ Đã biết/Chưa biết hoặc kết quả quiz/gõ (P04/P05). Nút AI Format vẫn là parser hiện có, chưa tích hợp AI (A02). Preview nhập liệu, báo lỗi từng dòng và chủ động chuyển bài khách thuộc P03.

Chỉ thêm **một bảng** `vocab_lessons`: UUID, `user_id`, tên, mảng `words` JSONB, `version`, ngày tạo/cập nhật. Đây là lựa chọn vừa đủ với màn hiện tại chỉnh sửa toàn bài; chưa cần `vocab_words` và API từng từ. Việc lưu từ trong P02 đã được thực hiện một phần tại P01, phần còn lại phải đối chiếu lại backlog để không làm trùng.

Tên tối đa 100 ký tự; một bài tối đa 500 từ, body tối đa 512 KiB. Mỗi từ có UUID ổn định, word/reading tối đa 500 ký tự, Hán Việt 200, nghĩa 2.000. Từ và nghĩa không rỗng; ID không trùng trong một bài. Mỗi lần thêm/demo tạo UUID mới; sửa/đổi tên giữ UUID. Guest cũ vẫn đọc ID cũ; không đổi hàng loạt các sourceId đã lưu.

⭐ vẫn dùng `custom:<wordId>` và API Ôn tập hiện có. Sửa/xóa bài hoặc từ **không tự thay đổi** bản chụp nội dung, trạng thái sao, lịch và lịch sử Ôn tập. Không tự gắn sao khi tạo bài hay học. P02 còn cần người dùng chốt có muốn đồng bộ sửa/xóa nguồn vào thẻ sao không; P01 giữ nguyên hành vi độc lập hiện có.

## API

Tất cả endpoint yêu cầu phiên đăng nhập. POST yêu cầu Origin đúng cấu hình và JSON. `expectedUserId` chỉ để chặn trang cũ ghi sau khi cookie đã đổi tài khoản; owner luôn lấy từ phiên.

| Endpoint | Input | Output |
|---|---|---|
| `GET /api/vocab/lessons` | — | `{ userId, lessons }` |
| `POST /api/vocab/lessons` | `{ id, name, expectedUserId }` | `{ userId, lesson }`; 201 mới, 200 nếu cùng UUID đã tạo |
| `POST /api/vocab/lessons/update` | `{ id, version, expectedUserId, name?, words? }` | `{ userId, lesson }` với version tăng |
| `POST /api/vocab/lessons/delete` | `{ id, version, expectedUserId }` | `{ userId, id }` |

- Request tạo giữ cùng UUID khi thử lại, không tạo hai bài khi phản hồi bị mất.
- Update kiểm tra owner và version trong transaction. Hai tab cùng sửa chỉ một request thành công, request cũ nhận `409 LESSON_CHANGED`; form vẫn mở để người dùng giữ nội dung đang nhập và tải lại dữ liệu. Không tự ghi đè bằng bản cũ.
- Xóa theo owner/version, từ đi cùng hàng bài. Xóa lại bài đã mất là thao tác an toàn; version cũ của bài còn tồn tại bị chặn. Không tác động bài khác hoặc review history.
- FE chỉ cập nhật bài/đóng form/xóa nội dung nhập khi server xác nhận. Có khóa gửi đồng thời, timeout API và bỏ phản hồi cũ sau khi trang/tài khoản đã đổi. Lỗi tải không rơi về danh sách khách.
- Parser 512 KiB chỉ áp dụng route bài học; các endpoint khác vẫn dùng giới hạn 16 KiB. Không thêm hàng đợi offline hay cơ chế tự ghi lại sau lỗi.

## Cài đặt và nghiệm thu

Migration: `server/prisma/migrations/202609090001_vocab_lessons/migration.sql`. Đã áp dụng vào DB local bằng migrate deploy, không reset DB. Khi lấy code ở máy khác: dừng backend, chạy `npm run db:migrate`, `npm --prefix server run db:generate`, rồi khởi động lại backend.

Kiểm thử ngày 09/09/2026:

- Frontend/backend build thành công. Vite vẫn có cảnh báo kích thước bundle trên 500 kB đã có từ trước.
- 9 test API bài học với PostgreSQL thật: phiên/Origin, dữ liệu qua restart/đăng nhập lại, tạo lặp, owner/trang cũ, hai tab sửa/xóa, validation toàn batch, giới hạn body, lỗi DB/thử lại, giữ sao/lịch sử khi sửa/xóa bài. File: `server/tests/lessons.test.ts`.
- 40 test auth/progress/review và 5 test thống kê đã qua; 2 test review FE và 2 test route đã qua. Test chạy trên `nihongo_test`, không dọn DB người dùng.
- Trình duyệt bằng tài khoản kiểm thử: tạo, nhập JSON hai từ, đổi tên, F5; ngắt API khi sửa từ thấy lỗi và form còn nội dung; sau phục hồi lưu được, các màn Flashcard/Trắc nghiệm/Nhồi nhét mở đúng bộ từ. Demo hiển thị đúng 10 từ.
- Xóa một từ demo cập nhật 10 → 9; đăng nhập lại giữ đúng bài/9 từ; xóa bài rồi F5 vẫn trống. Tạo riêng một bài khách, đăng nhập không nhận bài khách vào tài khoản, đăng xuất bài khách vẫn còn. Đã dọn cả hai bài QA vừa tạo; không xóa bài có sẵn của người dùng.
- Đối chiếu source: toàn bộ 119 thuộc tính className tĩnh của `ChuDongPage.tsx` giữ nguyên; không sửa CSS hoặc bố cục màn học. Đã xem trực tiếp UI trước/sau và trạng thái lỗi trên trình duyệt.

Lệnh kiểm thử: `npm run test:server`, hoặc riêng bài học `npm --prefix server test -- tests/lessons.test.ts`; `npm run test:review`; `npm run test:routes`; `npm run build:server`; `npm run build`.
