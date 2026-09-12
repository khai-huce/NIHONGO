# P03 — Nhập từ JSON/text

Quyết định ngày 10/09/2026: chỉ thêm vào bài đang chọn; bỏ bản trùng cả từ/cách đọc/Hán Việt/nghĩa sau khi bỏ khoảng trắng đầu/cuối. Cùng từ nhưng khác một trường vẫn giữ riêng. Người dùng duyệt hộp thoại xem trước; giữ bố cục, nhãn, nút và CSS trang Chủ động. Bài khách tiếp tục riêng trên thiết bị, không chuyển vào tài khoản.

## Sử dụng

1. Chọn bài, dán JSON hoặc text vào ô nhập hiện có.
2. Bấm **Nhập dữ liệu vào hệ thống** để xem từ mới, từ trùng và lỗi theo dòng nguồn. Chưa có thao tác ghi ở bước này.
3. Nếu có lỗi, quay lại sửa. Nếu hợp lệ, **Xác nhận thêm … từ** lưu cả đợt; chỉ đóng và xóa ô nhập khi lưu thành công.
4. Lỗi mạng giữ nội dung, preview và UUID để thử lại. Nếu bài thay đổi ở tab khác, **Tải bài và xem lại** đọc dữ liệu hiện tại và yêu cầu xác nhận lại. Nếu bài bị xóa, giữ nội dung ở bài còn lại hoặc sau khi tạo bài mới.

Không tự ghi một phần các dòng hợp lệ khi còn dòng lỗi. Dòng trùng được ghi rõ là bỏ qua. Import không thay nội dung từ cũ, không tạo ⭐, không sửa lịch hoặc lịch sử ôn.

## Định dạng

JSON phải là mảng đối tượng, có thể bọc trong khối `json` với ba dấu backtick:

```json
[
  {"word":"学校","reading":"がっこう","hanViet":"HỌC HIỆU","meaning":"Trường học"},
  {"word":"先生","reading":"せんせい","meaning":"Giáo viên, thầy/cô"}
]
```

- Bắt buộc `word` và `meaning` là chuỗi không rỗng. `reading`, `hanViet` có thể bỏ qua hoặc là chuỗi rỗng; không tự suy đoán cách đọc/nghĩa.
- Hỗ trợ tên trường cũ `kanji`/`term` cho từ, `kana`/`furigana` cho cách đọc, `definition` cho nghĩa. Trường chính được ưu tiên; mọi trường được nhận diện nếu có đều phải là chuỗi. ID từ đầu vào không được nhập; mỗi từ mới nhận UUID riêng.
- JSON sai cú pháp không chuyển sang parser text. Lỗi đối tượng chỉ rõ dòng bắt đầu của mục trong bản nhập; JSON sai cú pháp báo lỗi toàn đợt.

Text không có hàng tiêu đề, mỗi dòng một từ:

```text
ありがとう - Cảm ơn
先生 | せんせい | Giáo viên, thầy/cô
学校 | がっこう | HỌC HIỆU | Trường học
コンビニ,コンビニ,"Cửa hàng tiện lợi, mở cả đêm"
```

- 2 cột: từ / nghĩa; 3 cột: từ / cách đọc / nghĩa; 4 cột: từ / cách đọc / Hán Việt / nghĩa.
- Ngăn bằng tab, `|`, dấu phẩy hoặc ` - ` (có khoảng trắng hai bên). Dấu ngăn đầu tiên ngoài ngoặc kép xác định cách tách dòng đó.
- Trường chứa chính dấu ngăn phải nằm trong ngoặc kép; `""` biểu diễn một dấu ngoặc kép bên trong. Không cắt tùy tiện dấu gạch nối của từ như `Đô-rê-mon`.
- Bỏ qua dòng trắng, vẫn giữ số dòng gốc. Mỗi mục text nằm trên một dòng; dùng JSON nếu nội dung cần xuống dòng.
- Giới hạn 500 dòng mỗi đợt, 500 từ sau nhập mỗi bài, 512 KiB đầu vào và request. Từ/cách đọc tối đa 500 ký tự, Hán Việt 200, nghĩa 2.000.

Nút **AI Format** giữ nguyên trên trang và thông báo chưa kết nối dịch vụ; không còn thay dữ liệu bằng kết quả mô phỏng. Dịch vụ AI thuộc A01/A02, chưa được triển khai trong P03.

## API và lưu dữ liệu

`POST /api/vocab/lessons/import` nhận `{ id, version, expectedUserId, words }`; `words` gồm UUID và bốn trường đã chuẩn hóa. Trả `{ userId, lesson, importedCount, duplicateCount }`.

- Session/Origin/JSON/owner và tài khoản kỳ vọng dùng cơ chế hiện có. Không dùng user ID do client gửi để xác định owner.
- Server kiểm tra toàn batch, khóa theo tài khoản, đọc bài, lọc trùng, kiểm tra phiên bản/sức chứa/UUID và ghi một transaction. Chỉ tăng phiên bản một lần khi có từ mới.
- Gửi cả các dòng preview cho rằng trùng để server đối chiếu lại với bài hiện tại. Nếu vẫn cần thêm từ mà phiên bản đã đổi, trả `409 LESSON_CHANGED`.
- Nếu tất cả nội dung đã có, trả kết quả không thêm từ và không tăng phiên bản, kể cả retry với phiên bản cũ sau khi mất phản hồi thành công. Không cần bảng receipt hoặc migration mới.
- Guest dùng cùng parser và khóa nội dung; đọc lại localStorage trước ghi, báo xung đột nếu nội dung bài đã đổi, ghi một lần trước khi cập nhật React. Không đọc dữ liệu khách trong nhánh tài khoản.

## Kiểm tra

- `npm run test:import`: parser, kiểu/trường/aliases, JSON hỏng, số dòng, ngoặc kép, dấu ngăn, từ trùng, nghĩa khác, giới hạn.
- `npm --prefix server test -- tests/lessons.import.test.ts`: transaction, xác thực/account isolation, batch lỗi, import lặp, hai request đồng thời, phiên bản cũ, UUID, giới hạn, rollback, dữ liệu ôn không đổi.
- `npm run test:server`, `npm run test:review`, `npm run test:routes`, `npm run build:server`, `npm run build` cho kiểm tra tích hợp.

P04/P05 vẫn là task riêng: chưa lưu trạng thái Đã biết/Chưa biết hoặc kết quả quiz/gõ.

## Nghiệm thu 10–12/09/2026

- 11 test parser, 11 test API import, 62 test backend trước đó và 4 test FE review/route đều đạt (88 test tổng, ngày 10/09). Build frontend/backend đạt; build frontend cuối ngày 12/09 đạt sau sửa đường khôi phục lỗi tải lại. Vite còn cảnh báo bundle trên 500 kB đã có từ trước.
- Trình duyệt bằng tài khoản QA riêng: JSON có 2 từ mới, 1 bản trùng và 1 dòng sai kiểu → khóa lưu; sửa lỗi → thêm đúng 3 từ. Cùng chữ khác nghĩa giữ riêng. Nhập lại bằng text → nhận đúng bản trùng.
- Kiểm tra dấu phẩy trong ngoặc kép và gạch nối trong Đô-rê-mon giữ nguyên. Hai tab đổi bài trong lúc xem trước → server chặn phiên bản cũ; tải lại preview xác định lại đúng từ mới/trùng, xác nhận sau đó lưu đúng.
- Khởi động lại cả Docker/API/trình duyệt sau hai ngày: bài QA còn đủ 6 từ, không có review card tự tạo. Mô phỏng xóa đúng bài QA trong lúc preview đang mở → lỗi giữ bản nhập, tải lại rồi tạo bài mới vẫn giữ 花 / はな / Hoa để xác nhận lại.
- Xác nhận lại lưu đúng một từ vào bài mới; F5 vẫn còn từ đó. Đã đăng xuất và dọn tài khoản/bài QA tạm với kiểm tra đúng owner/nội dung trước khi xóa; không chạm dữ liệu học có sẵn.
- Đối chiếu source: 119 thuộc tính className tĩnh và toàn bộ phần JSX trang cũ từ khối học trở xuống giữ nguyên. Hộp thoại mới dùng RoughCard/RoughButton, đã xem trực tiếp bằng screenshot.
- Docker local ngày 12/09 gặp socket tạm không truy cập được khi khởi động. Đã dừng Docker, đổi tên giữ bản sao `Docker/run.p03-backup-20260912` và `docker-secrets-engine.p03-backup-20260912` trong LocalAppData, rồi khởi động lại. PostgreSQL healthy và dữ liệu QA còn nguyên; không reset/xóa volume hay đổi cấu hình Docker. Đây là xử lý môi trường local, không phải migration của P03.
