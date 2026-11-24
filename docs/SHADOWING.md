# S01–S03 — Shadowing và chép chính tả

## Trạng thái ngày 07/10/2026

Đã triển khai database, API, trình phát YouTube thật, trang học, video cá nhân và kho quản trị. Ngày 07/10 đã nghiệm thu luồng Gemini thật: video YouTube 9 phút 12 giây → 32 câu tiếng Nhật kèm bản dịch → xem trước → chỉnh một bản dịch → lưu → F5 giữ nội dung, câu đang học và bookmark. Các ca kiểm thử dùng provider giả lập được ghi riêng bên dưới. Đây là nghiệm thu chức năng tạo/lưu, không phải chứng nhận độ chính xác mọi lời thoại, bản dịch và mốc nghe của AI.

Người dùng đã chốt: kho video admin và video cá nhân; Gemini tạo phụ đề/dịch có xem trước rồi chỉnh và lưu; lưu câu đang học/bookmark/kết quả đầu theo tài khoản; ẩn video thì tạm dừng và chỉ chọn tốc độ YouTube hỗ trợ. Đồng ý YouTube Data API, quyền khách/tài khoản và hạn mức dưới đây. Sáu video và transcript mẫu cũ đã bỏ; dữ liệu chưa có hiển thị trống, không gán nội dung thay thế.

## Quyền và cấu hình

- Khách học video thư viện đã xuất bản; tiến độ khách chỉ giữ trong lượt mở, không nhập vào tài khoản khi đăng nhập.
- Thêm video, Gemini và lưu tiến độ cần đăng nhập. Chưa khóa Premium; nhãn **Gói Trọn đời** đổi thành **Cần đăng nhập** theo phê duyệt.
- Admin: `http://localhost:3002/admin/shadowing`; trang học: `http://localhost:3000/tron-doi/shadowing` và `/:id`.
- Khóa chỉ ở `apps/api/.env`: `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`; không đặt vào `VITE_*`, JSON nhập hoặc frontend. Bật YouTube Data API v3; thiếu cấu hình báo lỗi thật, không lấy metadata client thay thế.
- `SHADOWING_GEMINI_MODEL` chọn riêng model video, bỏ biến này thì dùng `GEMINI_MODEL`. Ngày 07/10 người dùng duyệt `gemini-3.5-flash-lite` riêng Shadowing sau chẩn đoán quá tải 3.8 Flash; model C03/A03 giữ nguyên. Chỉ quản trị viên cấu hình ở backend, không nhận model từ client và không tự đổi model khi lỗi.
- Chỉ dùng Gemini miễn phí đã duyệt, không có model trả phí dự phòng. Giữ chỗ lượt tạo trong database trước khi gọi dịch vụ. Giới hạn **3 video/tài khoản và 10 video/toàn hệ thống trong 24 giờ trượt**, đồng thời dùng quota Gemini chung C03/A03 (`GEMINI_DAILY_LIMIT`, `GEMINI_GLOBAL_DAILY_LIMIT`). Lượt đã gửi nhưng thất bại vẫn tính hạn mức. Retry đúng request ID/nội dung đọc lại trạng thái cũ, không tính thêm.

Chạy từ root: `npm run dev`, `npm run dev:admin`, `npm run dev:server`. Migration cộng thêm `202610050001_shadowing` đã áp dụng local và DB test; không reset dữ liệu cũ.

## Học bằng video thật

1. Chọn cấp độ hoặc mở video. Cấp độ chưa xác định không tự gán N5; số câu/thời lượng lấy từ nội dung đã lưu.
2. Trình phát nhúng YouTube giữ điều khiển nguyên bản. Phát/dừng/tua/thời gian/lỗi/tốc độ lấy từ player, không dùng TTS làm audio video.
3. Bấm câu trong **Bản chép** để tua tới câu đó. Câu trước/tiếp/phát lại dùng mốc phụ đề; **Tự ngắt câu** tạm dừng khi phát qua cuối câu. Tua có thể về keyframe gần nhất, không cam kết chính xác từng mili giây.
4. **Ẩn video** dừng trước khi ẩn; hiện lại cần bấm phát. Rời trang, mở trình sửa hoặc tab trình duyệt bị ẩn cũng dừng phát. Nút **Quay lại / Về danh sách** trong màn học chờ lưu vị trí cuối; lỗi mạng giữ màn để thử lại. Khi đang phát, vị trí được lưu mỗi 5 giây và khi tạm dừng; đóng trình duyệt đột ngột có thể mất đoạn cuối chưa lưu.
5. Furigana/tốc độ ban đầu theo P09; tốc độ chỉ áp dụng nếu video hỗ trợ. Chỉnh riêng trong màn không sửa cài đặt chung. Furigana từ Kuromoji/IPADIC; thiếu bản dịch báo rõ.
6. Phím cách phát/dừng, ←/→ chuyển câu, R phát lại, ? mở phím tắt; không chiếm phím khi nhập đáp án, mở dialog hoặc thao tác trong iframe.

Giữ hai chế độ **Bắt chước phát âm** và **Nghe - Viết chính tả**, khung bản chép và các điều khiển. Không thêm chấm giọng nói/micro.

## Thêm video cá nhân

1. Đăng nhập, dán URL YouTube, chọn **Thêm video**. Chỉ nhận link từ host YouTube hỗ trợ, không tải URL tùy ý.
2. **Kiểm tra video** lấy tên/kênh/thời lượng thật. Video phải công khai, cho phép nhúng, đã xử lý xong, không trực tiếp/sắp phát và ngắn hơn 30 phút. Server kiểm tra lại khi lưu.
3. Chọn cấp độ hoặc chưa phân loại, mô tả và phụ đề: nhập từng câu, chọn/dán JSON/SRT/VTT hoặc chủ động bấm **AI tạo phụ đề + dịch**.
4. Tệp và kết quả Gemini đều có bước xem trước, xác nhận dùng rồi chỉnh câu/dịch/mốc. AI không tự lưu hoặc xuất bản.
5. Xác nhận đã rà soát rồi **Lưu video và bắt đầu học**. Mở lại/F5 đọc DB đúng tài khoản. Sửa/lưu trữ video cá nhân; lưu trữ giữ tiến độ/kết quả.

JSON là danh sách câu hoặc `{ "sentences": [...] }`; mỗi câu có `startMs`, `endMs` (mili giây nguyên), `text`, `translationVi` tùy chọn. Nhập mới tạo UUID mới; sửa trực tiếp giữ UUID câu. Metadata, token, quyền và điểm không lấy từ JSON client.

SRT/WebVTT chỉ nhận văn bản thuần, tối đa 1 MiB UTF-8/500 câu/300 ký tự Unicode mỗi câu; dịch tối đa 2.000 ký tự. Mốc theo thứ tự, không chồng lấn, bắt đầu nhỏ hơn kết thúc và nằm trong thời lượng đã kiểm tra. HTML/ruby/mốc trong câu và phần mở rộng chưa hỗ trợ báo lỗi để sửa. `endMs` cuối transcript không phải thời lượng video.

Gemini xử lý URL công khai ở backend, chia đoạn tối đa 10 phút và trả mốc theo video gốc. Video dùng Interactions API; text C03/A03 giữ `generateContent`. Model trả `startTime`/`endTime` theo đúng `MM:SS.mmm`; server kiểm tra rồi chuyển sang `startMs`/`endMs` cho DB/API hiện có. Không tự đoán đơn vị, kéo giãn hoặc cắt mốc sai. Schema gửi provider chỉ dùng tập thuộc tính đã kiểm chứng; validation Zod phía server vẫn giữ đầy đủ giới hạn kích thước, thứ tự, chồng lấn và thời lượng. Provider/schema lỗi, không có lời Nhật hoặc phụ đề sai làm job thất bại, không lưu mẫu thay thế. Job `pending/ready/failed` thuộc tài khoản, có thời hạn tránh treo khi server gián đoạn. Không tải video xuống repo.

## Kho admin và xuất bản

1. **Shadowing → Thêm video**: URL, cấp độ, mô tả. **Kiểm tra video / Xem trước** lấy metadata thật, không cho nhập giả tên/kênh/thời lượng.
2. Thêm/sửa từng câu hoặc **Nhập JSON / SRT / VTT → Xem trước → xác nhận dùng phụ đề**. Chỉ thay bản đang nhập, chưa ghi server. Gemini cũng có bước xem trước và đưa vào trình sửa.
3. Chọn/**Thêm nguồn** với xuất xứ/quyền thực tế của video/phụ đề/dịch. Mã nguồn chữ thường/số/gạch nối; tái sử dụng `content_sources` bất biến. Link YouTube không tự chứng minh quyền sở hữu.
4. **Lưu bản nháp**; cho phép chưa có phụ đề/nguồn. Bản public giữ nguyên khi sửa nháp. Nghe đối chiếu, tích xác nhận rà soát; **Xuất bản…** cần bản đã lưu, nguồn và ít nhất một câu.
5. Xác nhận xuất bản đưa snapshot vào thư viện. **Lưu trữ…** ẩn nhưng giữ nội dung/lịch sử; **Khôi phục về nháp…** không tự công khai lại.

Lỗi lưu giữ form, version/request ID chặn ghi đè và gửi lặp. Hai tab xung đột: **Tải bản mới nhất** cần xác nhận bỏ phần chưa lưu. Request gắn tài khoản mở màn, loại phản hồi cũ khi đổi tài khoản. Admin dùng phong cách đơn giản riêng, không thiết kế lại trang học.

## Tiến độ và chép chính tả

- Câu/vị trí/bookmark/lượt phát lại riêng tài khoản/video. Không có bookmark giả; bookmark không phải ⭐ Ôn tập.
- **Ghép câu** dùng chỉ số mỗi lần xuất hiện token, giữ từ lặp; đổi chỗ token có cùng chữ không bị sai vì ID. **Gõ chính tả** chuẩn hóa NFKC, khoảng trắng/dấu câu. Lỗi là khoảng cách chỉnh sửa ký tự, không phải AI đánh giá phát âm.
- Server chấm transcript/phiên bản hiện hành. Lần lưu thành công đầu của mỗi câu/nội dung/chế độ được giữ; thử lại luyện thêm, ghi nhận đã dùng gợi ý.
- Sửa nội dung giữ snapshot/hash kết quả cũ, không gán đáp án cũ vào câu mới. Đổi dịch/mốc mà câu/token giữ nguyên không xóa lịch sử. Phiên bản cũ bị chặn chấm.
- Mạng lỗi giữ đáp án. Retry cùng request ID tránh nhân kết quả/lượt phát lại khi mất phản hồi. Client xếp hàng ghi; server khóa theo tài khoản/video.
- Không tự sao, SRS hoặc XP; không ghi âm/chấm giọng nói/xếp hạng trong phạm vi này.

## Database và API

| Bảng | Trách nhiệm |
|---|---|
| `shadowing_videos` | Owner/scope, nháp/public snapshot, nguồn/version/lưu trữ |
| `shadowing_studies` | Câu/vị trí/bookmark/lượt phát lại/version theo tài khoản/video |
| `shadowing_grades` | Kết quả đầu unique tài khoản/video/câu/hash/chế độ, giữ snapshot |
| `shadowing_attempts` | ID/hash/kết quả yêu cầu để chống gửi lặp |
| `shadowing_ai_requests` | Chủ sở hữu, quota, trạng thái/kết quả AI và thời hạn job |

Migration chỉ thêm bảng/index/FK; thư viện owner null, video cá nhân phải có owner. Express kiểm tra quyền, cổng admin không thay role. Mutation có `expectedUserId`; học có videoVersion/study version khi cần.

| Endpoint | Chức năng |
|---|---|
| `GET /api/shadowing/videos`, `GET /:id` | Thư viện public + video riêng; nội dung và tiến độ được phép đọc |
| `POST /api/shadowing/videos/prepare` | Kiểm tra metadata/transcript/token, chưa ghi video |
| `POST /api/shadowing/videos`, `PATCH /:id` | Lưu/sửa video cá nhân đã rà soát |
| `POST /api/shadowing/videos/:id/archive` | Lưu trữ video cá nhân |
| `POST /api/shadowing/videos/:id/study` | Vị trí/câu/bookmark/phát lại |
| `POST /api/shadowing/videos/:id/check` | Chấm ghép/gõ; khách không ghi DB, tài khoản giữ kết quả đầu |
| `POST /api/shadowing/ai`, `GET /:id` | Tạo/đọc job riêng tài khoản |
| `GET/POST /api/admin/shadowing/videos`, `GET/PATCH /:id` | Kho và nháp admin |
| `POST /api/admin/shadowing/videos/prepare` | Kiểm tra nháp, cho phép chưa có câu |
| `POST /api/admin/shadowing/videos/:id/publish`, `/archive`, `/restore` | Quyền admin/version; publish yêu cầu `transcriptReviewed: true` |

`prepare` chỉ nhận `expectedUserId,url,level,description,sentences`, không nhận source/review hay metadata client. Nguồn dùng endpoint quản trị hiện có.

## Bằng chứng nghiệm thu và giới hạn

### Chẩn đoán Gemini ngày 07/10/2026

- Lỗi 400 cũ do định dạng gửi video/mốc thời gian đã sửa: Interactions API, offset là chuỗi giây có hậu tố `s`. Bỏ `temperature` của request video vì thuộc tham số deprecated trong OpenAPI; thay đổi này không làm hết lỗi 503 hiện tại.
- Cùng key/model `gemini-3.8-flash`: đọc metadata model trả 200; yêu cầu văn bản tối thiểu `Return only OK.` qua cả generateContent và Interactions đều trả 503, thông báo nhu cầu cao. Lỗi tái hiện khi không có video/schema/transcript/DB, nên không thể xử lý bằng sửa mốc phụ đề hoặc xóa dữ liệu. Đây là bằng chứng cho cấu hình/dự án đang dùng, không khẳng định Gemini lỗi toàn cầu.
- Cùng key, đối chứng Interactions bằng `gemini-3.5-flash-lite` trả 200/completed và `OK`; sau đó người dùng duyệt model này riêng Shadowing. Nguồn chính thức: [khả năng video](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [mức miễn phí](https://ai.google.dev/gemini-api/docs/pricing), [ý nghĩa lỗi 503](https://ai.google.dev/gemini-api/docs/api-errors).
- Model mới vẫn trả 400 với schema cũ. Đối chứng video tối thiểu và video có offset đều 200; text với schema cũ 400, bỏ nhóm ràng buộc `maxLength/maxItems/minimum/additionalProperties` thì 200. Đã thu gọn schema sinh kết quả, giữ kiểm tra nghiêm ngặt phía server. Không quy lỗi này cho quota hay YouTube.
- Lượt sau đó trả 200 nhưng 10/23 mốc vượt thời lượng 552 giây; backend từ chối, không tự sửa hay lưu. Đã đổi hợp đồng provider từ số mili giây dễ nhầm sang chuỗi `MM:SS.mmm` và parser xác định đơn vị. Log đối chứng schema/video trong `.artifacts/logs/shadowing/*diagnosis.json`.
- Backend hiện phân biệt yêu cầu sai (400/416/422), quyền key (401/403), yêu cầu thanh toán (402), model/tài nguyên không có (404), hạn mức (429), quá tải (503). Thông báo tĩnh, không lộ body/key; lỗi quyền provider không biến thành phiên đăng nhập hết hạn của người dùng. Giữ quota và không tự retry provider.
- Lượt cuối **31/31 provider tests**, **68/68 API hồi quy** (14 Shadowing + 41 A03 + 13 ngữ pháp), TypeScript toàn bộ API/tests và API build đạt. Test tự động dùng response provider giả lập có kiểm soát; log `provider-diagnosis-tests.log`, `diagnosis-regression.log`, `build-diagnosis.log`.

### Gemini và giao diện thật ngày 07/10/2026

- `gemini-3.5-flash-lite` trả **200/completed**, job `ready`, **32 câu tiếng Nhật có bản dịch Việt** cho `CouOtXJnXjg` — *Useful Japanese Greetings for Japanese Learners*, kênh JapanesePod101, thời lượng YouTube xác nhận 552.000 ms. Mốc từ 33.208 đến 524.827 ms; kiểm tra độc lập xác nhận đúng thứ tự, không chồng lấn, trong thời lượng và khớp chính xác nội dung job sau chuyển đổi.
- UI thật: xem trước 32 câu → dùng kết quả → sửa dịch câu 2 từ “Buổi sáng.” thành “Chào buổi sáng.” → xác nhận rà soát → lưu video cá nhân → chọn/bookmark câu 2 → F5. Màn học khôi phục **Câu 2 / 32**, bản dịch đã sửa và bookmark. Phát lại câu 2 tua đến đoạn lời chào và dừng ở khoảng 0:47 theo mốc cuối câu; console không có lỗi/cảnh báo. Nội dung chỉ nằm trong DB test, không xuất bản lên thư viện thật.
- Dùng server nghiệm thu riêng 3010/3011 trên `nihongo_test`, cùng mã nguồn/provider/key thật và hạn mức thường; không reset quota, dữ liệu hoặc quyền người dùng ở DB chính. Tài khoản QA có đúng 3 job (2 failed, 1 ready), 1 video riêng, **0 XP, 0 thẻ SRS**. Không có lượt gọi AI khi lưu/F5. Cuối nghiệm thu đã lưu trữ video QA, giữ nội dung/lịch sử, đăng xuất và đóng phiên kiểm thử.
- Bằng chứng: `.artifacts/logs/shadowing/live-ui-provider-response.json`, `live-acceptance-state.json`, `gemini-preview-success.png`, `gemini-saved-f5.png`. Ảnh màn học desktop 1280×720 giữ bố cục hai cột; đây không phải bài kiểm tra nghe đầy đủ toàn bộ video.
- Video có cả phần dẫn tiếng Anh; prompt chỉ chép lời Nhật. AI có thể bỏ sót hoặc dịch chưa tự nhiên, nên bước nghe/rà soát trước lưu/xuất bản vẫn bắt buộc. Chưa xác nhận độ chính xác toàn bộ 32 câu/mốc bằng nghe trực tiếp; không coi kết quả AI là dữ liệu biên tập đã duyệt.

### Bằng chứng nền ngày 06/10/2026

- 14/14 API Shadowing đạt, gồm đăng xuất khi metadata đang chờ và thu hồi quyền trước publish. 16/16 provider đạt sau sửa payload video; 54/54 hồi quy C03/A03 đạt. Các provider trong kiểm thử tự động được thay thế có kiểm soát, không gọi dịch vụ thật.
- Lượt cuối **170/170 FE/admin/shared** đạt, gồm parser, YouTube controller, hàng đợi theo tài khoản, lịch sử theo token và checkpoint khi mạng chậm/lỗi. Build cả ba ứng dụng đạt; kiểm tra ranh giới 190 file đạt. Log: `.artifacts/logs/shadowing/frontend-final.log`, `build-final.log`, `provider-final-tests.log`, `related-api-tests.log`.
- UI thật: tài khoản QA nhập JSON → xem trước → rà soát → lưu video; metadata YouTube thật trả tên/kênh/thời lượng. Nhúng video phát thật tới mốc câu rồi tự dừng; ẩn video khóa phát và báo đã dừng. Bookmark/câu hiện tại còn sau F5; gõ sai lần đầu → thử lại đúng vẫn giữ điểm đầu; F5 khôi phục câu sai đầu. Ghép đúng được lưu riêng và mở lại vẫn đúng. Cuối lượt đếm 1/3 câu đã làm đúng thực tế; quay lại chờ lưu rồi về danh sách.
- Admin UI: metadata thật → nhập SRT → preview 2 câu → xác nhận → lưu nháp → F5 giữ nội dung → lưu trữ. Chưa có nguồn thì nút xuất bản bị khóa. Luồng xuất bản/giữ snapshot/public/quyền/version được kiểm tra ở API; chưa xuất bản dữ liệu QA lên thư viện thật.
- Màn trình duyệt thực tế rộng 476px không tràn ngang. Công cụ đổi viewport không tác động kích thước cửa sổ trong lượt này; chưa nghiệm thu trực quan desktop rộng. Không tuyên bố đã nghe kiểm tra chất lượng âm thanh hay đồng bộ với một bản transcript thực đầy đủ: ba câu learner QA là dữ liệu tự nhập có nhãn kiểm thử, không phải phụ đề video.
- Hai video QA đã lưu trữ, không công khai; 2 kết quả đầu còn trong DB, 0 XP, 0 thẻ SRS. Quyền admin tạm của tài khoản QA đã thu hồi và đăng xuất; không đổi tài khoản admin thật. Log `.artifacts/logs/shadowing/qa-final-state.log`; ảnh `learner-result.jpg` là màn ghép câu với nội dung QA.
- Mốc lịch sử 06/10: YouTube Data API thật trả metadata đúng; Gemini `gemini-3.8-flash` trả **503 do nhu cầu cao**, log `.artifacts/logs/shadowing/live-provider-verified.log`. Giới hạn chưa được gọi thêm/model khác ở mốc này đã được quyết định 07/10 và bằng chứng thành công bên trên thay thế; không tự fallback hoặc bật thanh toán.

Cập nhật bằng chứng cuối ở [FEATURE_BACKLOG.md](FEATURE_BACKLOG.md), giữ rõ các giới hạn chưa kiểm tra được.
