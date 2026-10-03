# C03 — Kho ngữ pháp và bài tập

## Phạm vi và quy tắc đã chốt

- Giáo trình → bài → mẫu câu → bài tập dùng route, Express API và PostgreSQL. Không tự nhập Minna hoặc chuyển mảng mẫu cũ thành nội dung thật. Người dùng nhập nội dung qua admin.
- Giữ nền giấy, font và khung nét vẽ trang học. Chi tiết gồm Cấu trúc, Giải nghĩa, Phạm vi sử dụng, Lưu ý, mẫu liên quan và Ví dụ. Bỏ nút **Audio trực quan**; nút phát âm từng ví dụ dùng cơ chế phát âm/cài đặt đang có.
- Bài tập có Việt → Nhật, Nhật → Việt và Sắp xếp ★. Số lượng lấy từ dữ liệu, không cố định 10 câu. Nhóm thiếu câu hỏi báo chưa có dữ liệu.
- **Kiểm tra** đối chiếu trên server với các đáp án admin chấp nhận. Bỏ khác biệt khoảng trắng, chữ hoa/thường và dấu câu cơ bản; không bỏ dấu tiếng Việt, không tự đồng nhất kana với Kanji. Bản dịch chưa khớp không bị kết luận chắc chắn sai ngữ nghĩa.
- **AI đánh giá** dùng Gemini phía server cho hai dạng dịch. Người dùng chọn mức miễn phí và cho AI quyết định đúng/sai, tính tiến độ. `correct` tính đúng, `partly_correct`/`incorrect` chưa đúng; hiển thị góp ý và bản sửa. Không có dịch vụ thay thế tự động.
- Lần chấm thành công đầu tiên, bằng Kiểm tra hoặc Gemini, quyết định điểm câu đó. Lần thử sau chỉ luyện thêm. Xem đáp án trước ghi nhận đã xem, không tính đúng. Lỗi mạng/AI không tự ghi sai hoặc hoàn thành.
- Lưu từng câu theo tài khoản, F5 tiếp tục. Làm đủ mọi câu thuộc ba dạng đang có dữ liệu hoàn thành mẫu; học lại giữ mốc hoàn thành. Khách chỉ giữ kết quả trong lượt mở và không dùng AI. Đăng nhập không nhập dữ liệu khách.
- Chỉ chủ động ⭐/Thêm vào ghi nhớ mới thêm thẻ SRS. Bỏ sao giữ lịch/lịch sử; sửa nội dung và xuất bản đồng bộ thẻ đang/từng gắn sao. Hoàn thành bài không tự sao hoặc cộng XP.

## Dùng trang admin

1. Chạy API và hai trang như trước: `npm run dev:server`, `npm run dev`, `npm run dev:admin`.
2. Mở **http://localhost:3002/admin/grammar** → **Thêm giáo trình**.
3. Nhập tên, slug chữ thường/số/gạch nối, trình độ và nguồn thực tế. Chưa chọn nguồn vẫn lưu nháp; xuất bản phải có nguồn.
4. **Thêm bài** → **Thêm mẫu câu**. Điền mẫu câu, nghĩa, cấu trúc, giải nghĩa, phạm vi sử dụng, lưu ý. Thêm ví dụ Nhật/Việt và Furigana nếu có. Liên kết mẫu liên quan trong giáo trình bằng checkbox.
5. Thêm câu hỏi bằng ba nút Việt → Nhật / Nhật → Việt / Sắp xếp ★. Hai dạng dịch nhận nhiều đáp án, mỗi dòng một đáp án. Sắp xếp có bốn mảnh, thứ tự đúng và vị trí ★; chọn đủ bốn mảnh khác nhau trong phần thứ tự.
6. **Lưu bản nháp → Xem trước nội dung → Xuất bản… → Xác nhận xuất bản**. Nháp sửa không thay trang học cho tới khi xuất bản.
7. Mở **http://localhost:3000/ngu-phap**, chọn giáo trình, bài rồi mẫu câu. **Làm bài tập** mở trang riêng.

Nhập JSON: chọn file/dán → Kiểm tra và xem trước → Xác nhận dùng bản nhập → Lưu bản nháp → Xuất bản. Xác nhận nhập thay nội dung trình sửa, không tự ghi DB. Bảng xem trước cho biết số mục bị bỏ. Tải JSON bản đang sửa để giữ ID khi chỉnh bên ngoài. Mục thiếu ID được cấp UUID một lần; ID sai hoặc trùng báo lỗi theo trường.

Mỗi giáo trình tối đa 200 bài, 1.000 mẫu và 5.000 câu hỏi; mỗi mẫu tối đa 100 ví dụ và 150 câu hỏi; JSON tối đa 4 MiB. Khi bỏ bài/mẫu/câu hỏi, ID và lịch sử đã lưu vẫn giữ. Lưu trữ ẩn giáo trình; khôi phục chỉ về nháp.

## Cấu trúc JSON

Khung bản nháp tối thiểu, chưa đủ xuất bản:

```json
{
  "title": "Tên giáo trình ngữ pháp của bạn",
  "subtitle": "",
  "description": "",
  "level": "N5",
  "sourceId": null,
  "lessons": []
}
```

- `lessons[]`: `id`, `title`, `japanese`, `patterns`.
- `patterns[]`: `id`, `pattern`, `meaning`, `structure`, `explanation`, `usage`, `notes`, `relatedIds`, `examples`, `exercises`.
- `examples[]`: `id`, `japanese`, `vietnamese`, `ruby`.
- `ruby[]`: `{ "text": "chữ gốc", "reading": "kana" }`; bỏ reading cho đoạn không chú thích. Ghép `text` phải bằng câu tiếng Nhật gốc.
- Bài dịch: `id`, `kind: "vi-ja" | "ja-vi"`, `prompt`, `answers` (mảng đáp án), `hint`, `explanation`; `ruby` cho đề Nhật → Việt. Không nhập mảnh câu cho bài dịch.
- Bài sắp xếp: `id`, `kind: "arrange"`, `prompt`, `prefix`, `suffix`, `tokens` (bốn mảnh), `correctOrder` (hoán vị chỉ số 0–3), `starIndex` (vị trí 0–3), `translation`, `hint`, `explanation`. Ví dụ thứ tự `[3,2,0,1]` nghĩa là mảnh 4 → 3 → 1 → 2. Không dùng `answers` cho bài sắp xếp.

## Cấu hình Gemini mức miễn phí

Chỉ cấu hình trong **server/.env**, không đặt key vào frontend, `VITE_*`, file JSON giáo trình hoặc chat:

```dotenv
GEMINI_API_KEY=<key-cua-ban>
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_DAILY_LIMIT=20
GEMINI_GLOBAL_DAILY_LIMIT=100
```

Lấy key từ [Google AI Studio](https://aistudio.google.com/api-keys) của dự án **chưa bật Cloud Billing**. Model phải khả dụng ở dự án và thuộc mức miễn phí; đối chiếu [bảng giá chính thức](https://ai.google.dev/gemini-api/docs/pricing). Ứng dụng không bật thanh toán và không đổi sang model khác khi lỗi, nhưng không thể biến key thuộc dự án trả phí thành key miễn phí. Khởi động lại API sau khi lưu cấu hình.

Hạn mức trong ứng dụng là số lần gọi mới trong 24 giờ, không phải hạn mức Google cam kết; Google có thể giới hạn thấp hơn. Gửi lại cùng request không gọi lại nếu đã có kết quả. Lượt lỗi đã gửi tới nhà cung cấp vẫn chiếm hạn mức; không tự retry mạng để tránh gọi ngoài ý muốn. API key/model để trống thì AI báo chưa cấu hình, Kiểm tra vẫn hoạt động.

Chỉ mẫu ngữ pháp, đề, đáp án tham chiếu và bản dịch người học được gửi sang Google, không gửi email/cookie/ID tài khoản. Dữ liệu mức miễn phí có thể được Google dùng để cải thiện sản phẩm theo [điều khoản Gemini](https://ai.google.dev/gemini-api/terms). Nút AI là thao tác chủ động. Phản hồi JSON được kiểm tra schema và hiển thị dưới dạng text. [Tham chiếu API](https://ai.google.dev/api/generate-content).

## Database và API

Migration cộng thêm `202610030001_grammar_catalog`, không reset:

| Bảng | Vai trò |
|---|---|
| grammar_courses | Slug, nguồn nháp/public, draft JSON và metadata xuất bản/version |
| grammar_lessons | Bài có UUID và thứ tự công khai |
| grammar_patterns | Mẫu với content JSON, UUID ví dụ/bài tập được giữ, version |
| grammar_progress | Điểm lần đầu mỗi câu và mốc hoàn thành theo tài khoản/mẫu |
| grammar_attempts | Lịch sử lần kiểm tra/xem đáp án/AI, mã gửi chống trùng |
| grammar_ai_requests | Nhận lượt AI trước khi gọi mạng, cache kết quả và hạn mức |

Public: `GET /api/grammar/courses`, `/courses/:slug`, `/patterns/:id`. Nội dung public không chứa đáp án/thứ tự đúng/giải thích đáp án bài tập.

Học: `GET /api/grammar/progress`, `/patterns/:id/progress`; `POST /patterns/:id/check|reveal|ai`. Body gồm `id` mã gửi UUID, `expectedUserId`, `patternVersion`, `progressVersion`, `exerciseId`, `answer`. Kiểm tra/xem đáp án cho khách dùng `expectedUserId:null`, không lưu DB. Gemini yêu cầu phiên.

Admin: `/api/admin/grammar/courses`: list/detail/create/patch, `/preview`, `/:id/publish|archive|restore`. Dùng quyền admin hiện hành, Origin, tài khoản kỳ vọng và version; metadata nguồn dùng API C01 hiện có.

Xuất bản và chấm bài dùng lock cùng giáo trình. Hai tab cùng ghi tiến độ cũ chỉ một tab thành công. Gọi Gemini nằm ngoài transaction; trả về phải kiểm tra lại phiên, phiên bản nội dung và tiến độ rồi mới lưu. Cache/hạn mức nằm ở DB nên giữ khi khởi động lại API.

Thẻ legacy dùng sourceId dạng chữ cũ được giữ nguyên, không tự gộp sang UUID mới. C03 dùng `grammar:<UUID>` với snapshot đọc từ DB. Phân tích câu mẫu/Bảng chia thể trên trang đầu thuộc A03/phạm vi cũ, chưa được thay bằng AI trong C03.

## Nghiệm thu

Kết quả và giới hạn nghiệm thu được ghi tại `FEATURE_BACKLOG.md`. Nội dung test chỉ dùng database test và được dọn theo ID riêng; kho ngữ pháp thật chưa được tự nhập/xuất bản.
