# M02/M03 — Admin và biên tập bài Đọc hiểu

M02 hoàn thành ngày 22/09/2026: văn bản Nhật, dịch thủ công từng câu, nguồn, audio Edge và nháp/xuất bản/lưu trữ. M03a/M03b hoàn thành local ngày 06/11/2026, bổ sung biên tập furigana, từ vựng, ngữ pháp và câu hỏi theo phạm vi người dùng duyệt. Giữ giao diện học hiện có và luồng xuất bản M02.

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

`apps/api/.env` cần `APP_ORIGIN=http://localhost:3000` và `ADMIN_ORIGIN=http://localhost:3002`. `apps/web/.env.example` và `apps/admin/.env.example` có `VITE_APP_ORIGIN`/`VITE_ADMIN_ORIGIN` để xác định liên kết giữa hai giao diện. Cấu hình local hiện tại đã cập nhật. Mỗi Vite proxy `/api` sang Express; chỉ hai origin cấu hình được ghi dữ liệu, không bật CORS wildcard.

Admin có entry HTML/React riêng (`apps/admin/index.html`, `apps/admin/src/app/main.tsx`). `npm run build` kiểm tra TypeScript và tạo ba bản build: `apps/web/dist` cho trang học, `apps/admin/dist` cho quản trị và `apps/api/dist` cho Express. `npm run build:admin` chỉ build admin; `npm run preview:admin` xem bản build tại cổng 3002 sau khi dừng dev admin. Hosting production cần SPA fallback và proxy API cho từng giao diện; task này nghiệm thu local.

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

M03 dùng lại JSONB `reading_articles.content`/`published_content`, nguồn và phiên bản hiện có; không thêm bảng hoặc migration. Các mục này thuộc nội dung bài đọc, không tự tạo bản ghi trong kho từ vựng/ngữ pháp hoặc thẻ Ôn tập. Bản nháp và bản công khai luôn tách riêng.

Migration `202609220001_admin_reading` chỉ thêm `reading_articles.source_id`, `published_source_id` (nullable cho dữ liệu cũ, FK `content_sources`, không xóa nguồn đang tham chiếu) và index tra audio theo bài/hash/giọng/trạng thái. Không reset hoặc thay dữ liệu cũ, không tạo CMS tổng quát.

Giữ `reading_articles.content` và `published_content` riêng; nguồn nháp/công khai cũng riêng. Câu/dịch thuộc trọn bài nên tiếp tục dùng JSONB. `reading_audio` giữ metadata/file của từng job; `article_version` là phiên bản tạo file và không bị di chuyển khi dùng lại. Hash văn bản/giọng nối audio vào đúng bản đang xem; URL media kiểm tra nội dung hiện hành và quyền. Publish trong transaction với khóa bài, kiểm tra version và audio trước khi chép nháp sang bản công khai.

Các endpoint dưới `/api/admin/reading/articles`:

| Endpoint | Dữ liệu / kết quả |
|---|---|
| `GET /`, `GET /:id` | Thư viện/chi tiết nháp, source, trạng thái, version và audio hợp lệ |
| `POST /preview` | `{expectedUserId,title,subtitle?,text}` → `{content}` tách câu; không ghi DB |
| `POST /` | `{expectedUserId,id,title,subtitle?,text,sourceId,annotations}`; tạo nháp, retry cùng ID/nội dung không nhân bản |
| `PATCH /:id` | `{expectedUserId,version,title,text,sourceId?,annotations?,translationsReviewed?,editorialText?}` cùng các danh sách bổ trợ; text đổi cần xác nhận và annotation có nguyên văn câu tiếng Nhật khớp câu |
| `POST /:id/audio` | `{expectedUserId,version}` → `{audio}`; dùng cache hoặc tạo file, kiểm tra lại phiên/role sau job dài |
| `GET /:id/audio/:audioId/:filename` | MP3 nháp cho admin, hỗ trợ Range, no-store |
| `POST /:id/publish`, `/archive`, `/restore` | `{expectedUserId,version}`; ghi có version/transaction |

Source dùng GET/POST `/api/admin/content/sources` hiện có. Phần học dùng `/api/reading/articles` và public media hiện có. `editorialText` phải khớp chính xác văn bản gửi lên để ràng buộc danh sách vừa biên tập với bài mới; client cũ không gửi binding vẫn theo quy tắc xóa bổ trợ khi đổi văn bản. Annotation `ruby: []` xóa chú thích; bỏ trường ruby trong PATCH giữ chú thích cũ. Danh sách `[]` xóa toàn bộ nhóm tương ứng. Cả preview/save và publish đều validation; publish kiểm tra lại nội dung lưu trong DB, cấu trúc câu, đáp án và ID an toàn.

## M03a/M03b — Cách nhập nội dung bổ trợ

Mở **Đọc hiểu → chọn bài** tại admin cổng 3002. Nhập/tách câu như M02, sau đó:

1. **Furigana:** dưới mỗi bản dịch, bấm **Nhập furigana**. Chia câu thành các đoạn liên tiếp, nhập cách đọc cho đoạn Kanji; để trống cách đọc ở kana/dấu câu. Ví dụ `学校です。` gồm đoạn `学校` với cách đọc `がっこう`, tiếp theo `です。` không cần cách đọc. Ghép các đoạn phải đúng nguyên văn, kể cả khoảng trắng. Có thêm, xóa, đổi thứ tự và **Bỏ furigana**; bản xem trước hiện ruby ngay.
2. **Từ vựng:** bấm **Thêm từ vựng**, nhập từ Nhật, cách đọc, Hán Việt và nghĩa. Từ Nhật bắt buộc; các phần chưa có có thể để trống, hệ thống không tự điền.
3. **Ngữ pháp:** bấm **Thêm mẫu ngữ pháp**, nhập mẫu, trình độ nếu đã xác định, ý nghĩa, ví dụ Nhật và dịch ví dụ. Mẫu bắt buộc; không tự nối vào kho ngữ pháp hoặc gán trình độ.
4. **Câu hỏi:** bấm **Thêm câu hỏi**, nhập đề và 2–6 lựa chọn không trùng; chọn đúng một radio **Đáp án đúng**, nhập giải thích. Mỗi lựa chọn phải có nội dung. Đổi thứ tự vẫn giữ đáp án tương ứng; nếu xóa đáp án đúng, phải chọn lại trước khi lưu. ID câu hỏi giữ nguyên khi sửa hoặc đổi thứ tự.
5. **Lưu bản nháp → Xem trước → Xuất bản… → Xác nhận xuất bản**. Preview cho admin hiển thị cả đáp án đúng và giải thích. Nếu chưa có audio khớp văn bản, tạo audio trước khi xuất bản. Sửa riêng bổ trợ không phải tạo lại audio.

Mỗi nhóm từ vựng/ngữ pháp/câu hỏi tối đa 100 mục. Mỗi câu tối đa 500 đoạn ruby. Mọi phần dùng nguồn và quyền sử dụng của bài đọc; người biên tập chịu trách nhiệm nhập nội dung đã rà soát. Không gọi AI trong M03.

Khi sửa văn bản Nhật, phải tách lại câu và xác nhận; danh sách từ/ngữ pháp/câu hỏi cũ được xóa khỏi **bản nháp** trước khi biên tập lại. Có thể nhập bổ trợ mới sau bước này và lưu cùng văn bản mới. Bản đã xuất bản vẫn giữ nội dung/audio cũ đến khi xuất bản lại. Lỗi nhập liệu giữ nguyên form để sửa; không âm thầm bỏ hàng lỗi.

M03 chỉ quản trị đề và nội dung hiển thị. Quiz trang học dùng đáp án đã xuất bản để kiểm tra trong lượt mở; lưu kết quả/tiến độ quiz theo tài khoản thuộc **R03**, chưa triển khai trong task này. Không thêm XP hay tự gắn sao.

### Nghiệm thu M03 — 06/11/2026

- `reading.test.ts`: **27/27** (23 hồi quy + 4 ca M03), TypeScript API/tests đạt. Kiểm tra CRUD, xóa ruby/danh sách, ràng buộc văn bản mới, nguồn/phiên/version, preview không ghi, draft/public/audio độc lập và validation trước publish.
- Frontend/admin/shared: **207/207**, gồm 9 ca mới cho nội dung bổ trợ và 5 hồi quy editor. Build web/admin/API và `check:boundaries` (239 file) đạt. Vite cảnh báo bundle web 833,37 KB/admin 500,55 KB; không phải lỗi build.
- Browser trên DB riêng: nhập đủ bốn nhóm → chặn câu hỏi chưa chọn đáp án → đổi thứ tự lựa chọn → preview → lưu → F5 → tạo Edge MP3 thật → xuất bản → trang học hiển thị ruby/từ/ngữ pháp/quiz và giải thích đúng. Sửa nghĩa và xóa ruby ở nháp rồi F5 vẫn giữ; bản công khai vẫn giữ ruby/nghĩa cũ.
- Desktop và 390px: form/preview dùng được, không tràn ngang. Ảnh trong `.artifacts/m03/`. Không nghe đối chiếu chất lượng phát âm trong lượt M03.
- Kiểm tra tương thích database chính bằng transaction chỉ đọc: 31 bài thư viện, 31 bản nháp và 31 bản công khai đều qua validator mới. Kiểm thử ghi dữ liệu chỉ ở `nihongo_test` và `nihongo_m03_ui_test`, không sửa nội dung hay quyền admin thật.
- Đã đăng xuất, thu hồi role admin và phiên của tài khoản QA trong database riêng; dừng các server 3100–3102. Giữ dữ liệu kiểm thử riêng để đối chiếu, không đưa vào thư viện chính. Các server local 3000/3001/3002 đã khởi động lại để sử dụng.

## Nghiệm thu M02 — 22/09/2026 (lịch sử)

- API: 79/79 auth/content/reading/origin đạt, thêm 5/5 ca M02 đạt (tổng 84 ca liên quan). Bao gồm nháp kín, source bắt buộc, file thiếu, cache, quyền media, hai lần publish đồng thời, bảo toàn bản public, phân quyền sau job dài, rà soát câu và khôi phục nháp.
- FE/shared: 97/97 đạt, gồm ghép câu không theo index, câu lặp, giữ/bỏ dữ liệu bổ trợ đúng lúc, phiên bản và đường dẫn audio, request theo tài khoản.
- Build trang học, admin và backend đạt ngày 22/09/2026. Bundle admin riêng 337 KB; trang học vẫn có cảnh báo kích thước bundle trên 500 KB đã có trước task này.
- Trình duyệt: tạo nháp/nguồn, dịch từng câu, F5, nghe MP3 Edge thật đến hết câu, xuất bản bấm đúp, hai tab xung đột giữ input và xác nhận tải lại; đổi thứ tự câu giữ đúng bản dịch, câu mới để trống. Bản công khai vẫn phát hết audio cũ khi nháp đổi văn bản.
- Lưu trữ làm link công khai báo không tìm thấy; khôi phục chỉ về nháp. Dừng API khi lưu báo lỗi và giữ form, khởi động lại rồi lưu thành công; DB chỉ tăng một phiên bản ở lần lưu thành công. Điều hướng Kanji vẫn tải đủ 111 mục.
- Link admin cũ trên cổng 3000 chuyển đúng sang 3002; trang đăng nhập riêng hiển thị luồng email/mật khẩu và hướng dẫn Google qua trang học. Cả trang học, admin và health API trả HTTP 200 sau nghiệm thu.
- Đã dọn đúng tài khoản, bài, nguồn và thư mục MP3 dùng kiểm thử M02. DB trở về 111 Kanji và 1 bài đọc có trước; tài khoản admin thật giữ nguyên quyền.
