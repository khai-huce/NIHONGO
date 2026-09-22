# C01, R01, R02 — kho nội dung và audio

Triển khai local theo duyệt ngày 20/09/2026; nghiệm thu ngày 21/09/2026. Stack giữ nguyên React/Vite → Express/TypeScript → Prisma/PostgreSQL. Python chỉ là tiến trình tạo MP3 được Express gọi, không phải backend thứ hai.

## Phạm vi nội dung

- 111 Kanji đã xuất bản: giữ 35 ID cũ, bổ sung 76 ID Unicode. 103 mục từ nhóm JLPT cấp 4 trước 2010 của KANJIDIC2 được dùng làm N5 tham khảo, với Hán Việt/nghĩa Việt đã duyệt. Có 104 mục mang nhãn N5 vì giữ `体` (`k-23`) từ catalog cũ. Không gọi đây là danh sách N5 chính thức hiện hành.
- 50 bộ thủ cũ chuyển vào DB. Ví dụ/gợi nhớ/chiết tự cũ được giữ; mục mới chưa có các phần này để trống, không sinh nội dung thay thế.
- `n5-v1` vẫn 28 chữ, 10–10–8, ID/thứ tự bất biến bằng ràng buộc DB. Việc mở rộng lộ trình mặc định cần phiên bản và quyết định riêng.
- Màn Hán tự, chi tiết, luyện viết, thẻ ôn và lộ trình lấy catalog qua API. Các mảng cũ chỉ còn phục vụ đối chiếu/fixture; lỗi API có thông báo, không fallback sang mock.
- Ngữ pháp, giáo trình từ vựng, phân tích/dịch bài đọc tự động và Shadowing chưa thuộc phần hoàn thành này. M01 bổ sung [giao diện admin Kanji](ADMIN_KANJI.md); M02 bổ sung [admin Đọc hiểu và cổng riêng 3002](ADMIN_READING.md) ngày 22/09/2026. Bộ thủ mới có API quản trị, chưa có UI.

## Database và cập nhật

Hai migration cộng thêm: `202609200001_content_catalog`, `202609200002_reading`. Không reset database, không xóa tiến độ hoặc nhận bài khách vào tài khoản.

`users.role` mặc định `user`, chỉ nhận `user/admin`, độc lập với Premium. `content_sources` lưu giấy phép/nguồn/checksum; `kanji_content`, `radical_content` tách bản nháp khỏi bản xuất bản, có version và trạng thái lưu trữ; `catalog_definitions` giữ syllabus bất biến. `reading_articles` lưu chủ sở hữu, nội dung riêng/nháp/công khai, version. `reading_audio` lưu trạng thái, hash văn bản/giọng, quyền sở hữu qua bài đọc, lease và thời lượng từng đoạn MP3.

Xuất bản Kanji cập nhật nội dung các thẻ sao đang hoạt động hoặc đã bỏ sao; giữ dueAt, khoảng ôn, số lượt và lịch sử, tăng version để chặn màn đánh giá cũ. Seed cũng đồng bộ thẻ cũ theo bản **đang xuất bản trong DB**, không ghi đè phần admin đã sửa. Chỉ thao tác ⭐ mới tạo thẻ ôn.

## Cài đặt local

Từ thư mục gốc sau khi cài dependencies và PostgreSQL:

```powershell
npm --prefix server run db:generate
npm --prefix server run db:migrate
npm --prefix server run content:seed
npm --prefix server run content:seed -- --commit
python -m venv server/.venv-tts
& server/.venv-tts/Scripts/python.exe -m pip install -r server/requirements-tts.txt
npm run dev:server
# Terminal khác:
npm run dev
```

Seed mặc định chỉ xem trước. `--commit` thêm mục thiếu, không ghi đè nội dung đã biên tập. Có thể chạy lại; số thêm mới bằng 0. Python 3.12 đã được dùng để kiểm tra. Backend tự tìm `server/.venv-tts`, sau đó `python` trên PATH; có thể chỉ định `TTS_PYTHON`. `TTS_STORAGE_DIR` tùy chọn, mặc định `server/storage/reading`; không đưa thư mục này vào static/public. Cả venv và audio local được gitignore.

## API nội dung / admin

API đọc công khai:

- `GET /api/content/catalog`: Kanji đang xuất bản, Kanji đã lưu trữ phục vụ lịch sử, bộ thủ, nguồn và định nghĩa lộ trình.
- `GET /api/content/kanji/:id`: bản đã xuất bản, gồm mục lưu trữ từng được công bố; không trả nháp.

Các route dưới `/api/admin/content` kiểm tra phiên và role mới nhất từ DB:

- `GET /sources`, `GET /kanji`, `GET /kanji/:id`, `GET /radicals`. M01 thêm `POST /sources` để tạo nguồn bất biến với `{expectedUserId, source}`; trùng ID khác metadata bị từ chối, retry đúng nội dung không tạo trùng.
- `PUT /kanji/:id`, `PUT /radicals/:number`: `{ expectedUserId, expectedVersion: number|null, sourceId, data }`; `null` dùng cho mục mới.
- `POST /kanji/:id/publish|archive`, `POST /radicals/:number/publish|archive`: `{ expectedUserId, expectedVersion }`.
- `POST /imports/preview`: `{ expectedUserId, input }`; `input` có `kind: kanji|radicals`, `entries: [{sourceId, expectedVersion, data}]`.
- `POST /imports/commit`: thêm `previewHash` của bản vừa xem. Toàn bộ batch trong transaction; nhập lại đúng bản nháp là no-op; sai version/ID/nguồn không ghi một phần.

Lệnh local nhập nháp dùng cùng validation/service:

```powershell
npm --prefix server run content:import -- C:/path/to/input.json
npm --prefix server run content:import -- C:/path/to/input.json --commit <previewHash>
npm --prefix server run admin:role -- grant <UUID-tai-khoan-duoc-chi-dinh>
npm --prefix server run admin:role -- revoke <UUID-tai-khoan-duoc-chi-dinh>
```

Chỉ cấp admin cho tài khoản được người dùng chỉ định rõ; nếu chỉ định email thì tra đúng UUID của email trước khi cấp. CLI quản trị là công cụ của người vận hành trên máy; API không có chức năng tự thăng quyền. M01 dùng đăng nhập hiện có và `users.role` để vào `/admin/kanji`.

## R01 — bài đọc

Route trang: `/tron-doi/doc-hieu/:articleId`. Giữ khung/nhãn/kiểu chữ cũ; chỉ sửa các đoạn giới thiệu đã duyệt và thêm thông báo tải/lỗi/thiếu dữ liệu.

- `GET /api/reading/articles`: bài riêng của phiên hiện tại + bài thư viện đã xuất bản.
- `POST /api/reading/articles`: `{id: UUID, expectedUserId, title, subtitle?, text}`. Tối đa 3000 ký tự Unicode; retry cùng ID và nội dung không tạo trùng.
- `GET /api/reading/articles/:id`, `PATCH /:id` với văn bản và `{expectedUserId, version}`, `DELETE /:id` với `{expectedUserId, version}`. Xóa là lưu trữ; tài khoản khác không đọc/sửa được.
- `/api/admin/reading/articles` có list/detail/create/patch và `POST /:id/publish|archive|restore`, kiểm tra admin. M02 thêm preview tách câu, nguồn nháp/public riêng, audio bản nháp và media admin; publish cần nguồn hợp lệ cùng audio ready khớp văn bản/file. Bản nháp sửa không thay bản công khai đến khi publish. Bài riêng của học viên không biến thành bài thư viện.
- Bản dịch/ruby/từ/ngữ pháp/quiz chỉ hiển thị khi có dữ liệu biên tập hợp lệ. Render text/ruby có cấu trúc, không chèn HTML đầu vào. Dữ liệu mẫu phân tích cũ không được coi là kiến thức đã biên tập.
- Khách giữ bài thiết bị riêng. Đăng nhập không tự nhập bài khách. Khách có thể đọc/nghe bài công khai đã chuẩn bị; tạo audio cho bài riêng cần tài khoản.

## R02 — Edge TTS

Dùng [edge-tts](https://github.com/rany2/edge-tts) `7.2.8` và `mutagen` `1.48.1`; giọng `ja-JP-NanamiNeural`. Đây là thư viện cộng đồng dùng dịch vụ trực tuyến của Microsoft Edge, không phải Azure Speech có SLA. Không cấu hình Google/billing/key hoặc dùng browser speech làm audio giả khi lỗi.

- Bấm phát khi chưa có audio gọi `POST /api/reading/articles/:id/audio` với `{expectedUserId,version}`. Chỉ văn bản cần đọc và giọng gửi ra dịch vụ; không gửi email/phiên/tiến độ.
- MP3 theo câu, thời lượng đo từ file; manifest nối tổng thời lượng và offset. Một `HTMLAudioElement` phát tuần tự; play/pause/seek/chuyển câu/lặp/tốc độ dùng sự kiện media. Có thể có khoảng đệm ngắn giữa các file câu, không cam kết đọc liền mạch như một file thu âm.
- Audio đúng văn bản/giọng được dùng lại, kể cả đổi tiêu đề. F5/phát lại/đổi tốc độ không tạo file mới. M02 tra cache theo bài/hash/giọng và không di chuyển metadata phiên bản tạo file: sửa nháp giữ audio của bản công khai cũ hoạt động; sau xuất bản mới, URL public chỉ phục vụ hash của bài hiện hành.
- Media `GET /:id/audio/:audioId/:filename` kiểm tra owner hoặc bản công khai hiện hành, hỗ trợ HTTP Range; không cho dùng đường dẫn tùy ý. Lưu trữ/xóa bài chặn URL media cũ.
- Tối đa 2 job đang tạo toàn hệ thống local, 12 yêu cầu tạo/giờ/tài khoản gọi API, 30.000 ký tự tạo mới/24h theo tài khoản sở hữu bài; tối đa 3000 ký tự và 100 câu/bài. Với thư viện, admin khác tạo audio vẫn dùng hạn mức của chủ bài, tránh đổi người gọi để vượt giới hạn. Timeout tiến trình 180 giây. Quota ký tự đếm các bản audio mới; retry cùng bản không cộng bản quota mới, vẫn chịu giới hạn request/giờ.
- Single-flight trong process và claim/lease DB chống gọi trùng giữa các process. Ghi metadata ready chỉ sau khi xác minh tất cả file; lỗi giữ bài đọc, dọn phần tạo dở và cho thử lại. Không giữ transaction trong khi gọi mạng và không tắt kiểm tra TLS.

## Nguồn và giấy phép

Dữ liệu nền KANJIDIC2 © James William BREEN and the Electronic Dictionary Research and Development Group (EDRDG), [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html). [Nguồn tải](https://www.edrdg.org/kanjidic/kanjidic2.xml.gz), phiên bản 17/09/2026, SHA-256 file nén `8c8089ad06b6fa27ef2de65b2c136043c9e76f2cbe065843aa917fa20c91adba`. Phần lựa chọn/chuẩn hóa và nghĩa tiếng Việt là bản biên tập đã duyệt, không phải bản dịch chính thức của EDRDG. Metadata ghi trong DB và API catalog; tài liệu/bản trích đối chiếu tại `docs/data` và `KANJI_N5_REVIEW.md`. Các mục legacy được ghi nguồn nội bộ riêng, không gán nhầm cho KANJIDIC2.

## Bằng chứng nghiệm thu

- Migration cộng thêm đã chạy trên DB local và test. Seed 111 Kanji/50 bộ thủ/1 lộ trình; chạy lại không thêm trùng. Thẻ cũ được đồng bộ chữ mà giữ lịch/lịch sử.
- Edge thật tạo 2 MP3 mẫu, tổng 4,992 giây. Trình duyệt tài khoản QA tạo bài riêng 6 câu, MP3 tổng 21,936 giây theo DB, thời gian chạy theo file; pause giữ vị trí, chuyển câu/seek/tốc độ hoạt động. F5/phát lại giữ 1 bản audio trong DB, không tạo mới. Đã kiểm tra file/media events, chưa đánh giá chủ quan chất lượng phát âm. Tài khoản QA, bài/thẻ/lịch sử/phiên của QA và 6 MP3 tương ứng đã dọn; dữ liệu người dùng được giữ nguyên.
- Bộ kiểm thử API kiểm tra owner, admin, bản nháp/publish, import/version/rollback, bảo toàn lịch sử, lộ trình, quota/cache/Range, lỗi provider, hai yêu cầu cùng lúc và logout trong khi tạo audio. Bộ player dùng media double để kiểm tra sự kiện/thời gian xác định; có kiểm tra Edge thật riêng như trên.
- Build FE/BE đạt; 76/76 FE/shared đạt. API C01 đạt 16/16, R01/R02 đạt 18/18 ở lượt cuối, gồm catalog publish/archive đồng thời, lỗi DB vẫn dọn MP3 và quota giữa hai admin. 40 auth/SRS đã chạy lại thành công; 114 hồi quy khác đạt ở lượt toàn bộ trước đó. Chi tiết các lượt chạy và sửa fixture tại [FEATURE_BACKLOG.md](FEATURE_BACKLOG.md). Vite còn cảnh báo bundle trên 500 kB; không cản build và chưa tối ưu bundle trong phạm vi này.
