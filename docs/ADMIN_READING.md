# M02 — Admin riêng và biên tập bài Đọc hiểu

Người dùng duyệt ba quy tắc M02 và cổng admin riêng ngày 22/09/2026. Phạm vi lần này: văn bản Nhật, dịch thủ công từng câu, nguồn, audio Edge và nháp/xuất bản/lưu trữ. Giữ giao diện học hiện có. Chưa thêm biên tập furigana, từ vựng, ngữ pháp hoặc quiz; dữ liệu bổ trợ đã có được bảo toàn khi không đổi văn bản Nhật.

## Chạy local

Ba terminal tại thư mục dự án:

```powershell
npm run dev:server
npm run dev
npm run dev:admin
```

- Trang học: `http://localhost:3000`.
- Admin: `http://localhost:3002/admin/reading` và `/admin/kanji`; `/` chuyển đến Kanji.
- API Express: `http://127.0.0.1:3001`, PostgreSQL dùng chung.

`server/.env` cần `APP_ORIGIN=http://localhost:3000` và `ADMIN_ORIGIN=http://localhost:3002`. `.env.example` có `VITE_APP_ORIGIN`/`VITE_ADMIN_ORIGIN` để xác định liên kết giữa hai giao diện. Cấu hình local hiện tại đã cập nhật. Mỗi Vite proxy `/api` sang Express; chỉ hai origin cấu hình được ghi dữ liệu, không bật CORS wildcard.

Admin có entry HTML/React riêng (`admin/index.html`, `src/admin/main.tsx`). `npm run build` kiểm tra TypeScript và tạo hai bản build: `dist` cho trang học, `dist-admin` cho quản trị. `npm run build:admin` chỉ build admin; `npm run preview:admin` xem bản build tại cổng 3002 sau khi dừng dev admin. Hosting production cần SPA fallback và proxy API cho từng giao diện; task này nghiệm thu local.

Link `/admin/*` cũ trên cổng 3000 chuyển sang 3002. Cookie phiên theo hostname, dùng chung giữa hai cổng `localhost`; đăng xuất một bên sẽ kết thúc phiên của cả hai. Backend luôn kiểm tra role hiện hành, không coi cổng riêng là quyền truy cập. Tài khoản admin được chỉ định vẫn là `nvk05032005@gmail.com`.

Đăng nhập email/mật khẩu trực tiếp ở admin. Với Google, nút **Đăng nhập Google qua trang học** mở trang học hiện đã cấu hình Google: chọn Đăng nhập → Google rồi quay lại admin. Trang quản trị đọc lại phiên khi trở về; không yêu cầu thêm OAuth origin 3002 để dùng luồng này.

## Biên tập và xuất bản

1. Chọn **Đọc hiểu → Thêm bài đọc**, nhập tiêu đề, mô tả tùy chọn và văn bản Nhật (tối đa 3000 ký tự Unicode).
2. **Tách câu và kiểm tra bản dịch** gọi server để lấy danh sách câu. Nhập dịch Việt từng câu hoặc để trống. Không tự gán nội dung mẫu.
3. Chọn nguồn hoặc **Thêm nguồn** với xuất xứ/quyền thực tế. Nguồn nội bộ có thể dùng URI `urn:nihongo:...`; metadata nguồn bất biến như M01. Có thể lưu nháp chưa chọn nguồn.
4. **Lưu bản nháp**. F5/mở URL chi tiết lấy lại nội dung từ database; bản công khai chưa thay đổi.
5. **Tạo audio Edge TTS** từ bản đã lưu. Giọng Nanami, file MP3 từng câu và giới hạn R02 giữ nguyên. Bản nháp và audio nháp chỉ admin đọc được.
6. **Xem trước** để xem câu/dịch và nghe thử. Player chỉ cho một câu phát tại một thời điểm, đóng preview dừng phát.
7. **Xuất bản… → Xác nhận xuất bản**. Server yêu cầu tiêu đề/văn bản hợp lệ, nguồn tồn tại và audio ready khớp văn bản, gồm kiểm tra file thực tế. Bản dịch không bắt buộc. Bài xuất hiện ở `/tron-doi/doc-hieu/:id` theo giao diện cũ.

Sửa văn bản Nhật yêu cầu tách lại câu và xác nhận rà soát bản dịch. Chỉ giữ bản dịch/ruby khi câu Nhật khớp nguyên văn và duy nhất ở cả bản cũ/mới; câu mới hoặc lặp không tự ghép theo số thứ tự. Hộp thoại báo số bản dịch/chú thích/dữ liệu bổ trợ sẽ bỏ. Từ vựng/ngữ pháp/quiz cũ được bỏ khỏi bản nháp khi thay văn bản, tránh áp nội dung không khớp; bản công khai vẫn giữ nguyên đến lần xuất bản tiếp theo.

Sửa tiêu đề, bản dịch hoặc nguồn với văn bản không đổi dùng lại file audio. Đổi văn bản cần audio khớp bản mới; file của bản đang công khai vẫn hoạt động. Dùng lại hash khi quay về đúng văn bản/giọng đã có.

**Lưu trữ…** ẩn bài và chặn audio công khai, giữ bản ghi/file. **Khôi phục về nháp…** không tự đưa bài lại lên trang học: kiểm tra rồi xuất bản lại. Bài cá nhân của học viên không nằm trong danh sách quản trị thư viện.

Lỗi lưu giữ form để thử lại. Hai tab cùng sửa dùng version: tab cũ nhận xung đột và giữ nội dung đang nhập; **Tải bản mới nhất** có xác nhận bỏ phần chưa lưu. Nút trong trang và Back/Forward hỏi trước khi bỏ bản đang sửa; F5/đóng tab dùng cảnh báo trình duyệt. Các request gắn tài khoản đã mở trình sửa, hủy/loại phản hồi cũ khi phiên thay đổi. Bấm lặp bị chặn ở UI và version/transaction phía server.

## Database và API

Migration `202609220001_admin_reading` chỉ thêm `reading_articles.source_id`, `published_source_id` (nullable cho dữ liệu cũ, FK `content_sources`, không xóa nguồn đang tham chiếu) và index tra audio theo bài/hash/giọng/trạng thái. Không reset hoặc thay dữ liệu cũ, không tạo CMS tổng quát.

Giữ `reading_articles.content` và `published_content` riêng; nguồn nháp/công khai cũng riêng. Câu/dịch thuộc trọn bài nên tiếp tục dùng JSONB. `reading_audio` giữ metadata/file của từng job; `article_version` là phiên bản tạo file và không bị di chuyển khi dùng lại. Hash văn bản/giọng nối audio vào đúng bản đang xem; URL media kiểm tra nội dung hiện hành và quyền. Publish trong transaction với khóa bài, kiểm tra version và audio trước khi chép nháp sang bản công khai.

Các endpoint dưới `/api/admin/reading/articles`:

| Endpoint | Dữ liệu / kết quả |
|---|---|
| `GET /`, `GET /:id` | Thư viện/chi tiết nháp, source, trạng thái, version và audio hợp lệ |
| `POST /preview` | `{expectedUserId,title,subtitle?,text}` → `{content}` tách câu; không ghi DB |
| `POST /` | `{expectedUserId,id,title,subtitle?,text,sourceId,annotations}`; tạo nháp, retry cùng ID/nội dung không nhân bản |
| `PATCH /:id` | `{expectedUserId,version,title,text,sourceId?,annotations?,translationsReviewed?}`; text đổi cần xác nhận và annotation có nguyên văn câu tiếng Nhật khớp câu |
| `POST /:id/audio` | `{expectedUserId,version}` → `{audio}`; dùng cache hoặc tạo file, kiểm tra lại phiên/role sau job dài |
| `GET /:id/audio/:audioId/:filename` | MP3 nháp cho admin, hỗ trợ Range, no-store |
| `POST /:id/publish`, `/archive`, `/restore` | `{expectedUserId,version}`; ghi có version/transaction |

Source dùng GET/POST `/api/admin/content/sources` hiện có. Các trường editorial cũ không nằm trong UI M02 vẫn được giữ nếu text không đổi; API tiếp tục validation chúng. Phần học dùng `/api/reading/articles` và public media hiện có.

## Kiểm thử

- API: 79/79 auth/content/reading/origin đạt, thêm 5/5 ca M02 đạt (tổng 84 ca liên quan). Bao gồm nháp kín, source bắt buộc, file thiếu, cache, quyền media, hai lần publish đồng thời, bảo toàn bản public, phân quyền sau job dài, rà soát câu và khôi phục nháp.
- FE/shared: 97/97 đạt, gồm ghép câu không theo index, câu lặp, giữ/bỏ dữ liệu bổ trợ đúng lúc, phiên bản và đường dẫn audio, request theo tài khoản.
- Build trang học, admin và backend đạt ngày 22/09/2026. Bundle admin riêng 337 KB; trang học vẫn có cảnh báo kích thước bundle trên 500 KB đã có trước task này.
- Trình duyệt: tạo nháp/nguồn, dịch từng câu, F5, nghe MP3 Edge thật đến hết câu, xuất bản bấm đúp, hai tab xung đột giữ input và xác nhận tải lại; đổi thứ tự câu giữ đúng bản dịch, câu mới để trống. Bản công khai vẫn phát hết audio cũ khi nháp đổi văn bản.
- Lưu trữ làm link công khai báo không tìm thấy; khôi phục chỉ về nháp. Dừng API khi lưu báo lỗi và giữ form, khởi động lại rồi lưu thành công; DB chỉ tăng một phiên bản ở lần lưu thành công. Điều hướng Kanji vẫn tải đủ 111 mục.
- Link admin cũ trên cổng 3000 chuyển đúng sang 3002; trang đăng nhập riêng hiển thị luồng email/mật khẩu và hướng dẫn Google qua trang học. Cả trang học, admin và health API trả HTTP 200 sau nghiệm thu.
- Đã dọn đúng tài khoản, bài, nguồn và thư mục MP3 dùng kiểm thử M02. DB trở về 111 Kanji và 1 bài đọc có trước; tài khoản admin thật giữ nguyên quyền.
