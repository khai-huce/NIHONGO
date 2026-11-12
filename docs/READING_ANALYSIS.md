# A04 — Phân tích bài đọc cá nhân

## Phạm vi đã chốt

- Chỉ bài đọc cá nhân đã lưu trong tài khoản đang đăng nhập. Bài thư viện dùng nội dung admin đã xuất bản; bài khách trên thiết bị vẫn giữ riêng.
- Gemini bổ sung bản dịch Việt và furigana còn thiếu, giữ nguyên văn bản Nhật, thứ tự/ID câu và phần đã nhập. Không sinh từ vựng, ngữ pháp, câu hỏi của A05.
- Dùng `GEMINI_API_KEY`/`GEMINI_MODEL` và quota chung ở backend; không đổi model, tự gọi nhiều lượt, fallback hoặc bật thanh toán. Bài tối đa 3.000 ký tự Unicode, tối đa 100 câu, một yêu cầu Gemini cho cả bài.
- Người dùng duyệt thêm nút **Phân tích bài đọc** cạnh **Tạo bài đọc khác**. Kết quả mở trong hộp xem trước, sửa phần AI bổ sung rồi **Áp dụng vào bài** mới lưu.
- Dịch được coi là thiếu nếu trống/toàn khoảng trắng; furigana thiếu nếu chưa có mảng đoạn hoặc mảng rỗng. Phần đã có giữ nguyên, kể cả khi AI muốn diễn đạt khác. Không tự lấp lại từng đoạn trong một mảng furigana đã biên tập.

## Cách sử dụng

1. Đăng nhập, mở **Trọn đời → Đọc hiểu**, dán văn bản và **Tạo bài đọc**, hoặc mở một bài trong **Bài của bạn**.
2. Bấm **Phân tích bài đọc**. Văn bản Nhật và chú thích của chính bài này được gửi tới Gemini để đối chiếu ngữ cảnh; không gửi email, ID tài khoản, các bài khác hoặc lịch sử học.
3. Rà soát bản xem trước. Nguyên văn Nhật chỉ đọc; các trường đã có được khóa. Sửa bản dịch hoặc cách chia đoạn/cách đọc trong phần AI bổ sung. Ghép nguyên văn các đoạn ruby phải đúng câu gốc, kể cả khoảng trắng và dấu câu; cách đọc dùng kana.
4. Bấm **Áp dụng vào bài**. Chỉ khi server lưu thành công mới đóng xem trước và tải lại bài; F5 lấy dịch/furigana từ database. Bài đủ cả hai phần không gọi AI thêm.
5. Nếu đóng xem trước, rời trang hoặc F5 trước khi áp dụng, bài gốc chưa bị sửa. Gọi lại cùng bài/phiên bản có thể dùng kết quả cache riêng tài khoản, không tốn thêm lần gọi dịch vụ.

AI có thể đọc sai tên riêng hoặc dịch chưa sát ngữ cảnh. Bản xem trước luôn ghi cần rà soát; đây không phải nội dung đã được biên tập viên xác minh. Không tự tạo audio, thêm sao, XP hoặc đánh dấu đã học. Các file audio đã có được dùng lại vì văn bản Nhật không đổi.

## API và dữ liệu

- `POST /api/reading/articles/:articleId/analysis`: `{id, expectedUserId, version}`. Máy chủ đọc bài đang lưu, kiểm tra chủ sở hữu và phiên bản rồi tạo preview; không ghi nội dung bài.
- Phản hồi gồm `{userId, id, articleId, version, cached, result: {sentences, warnings}}`. Mỗi câu có `sentenceId`, `japanese`, `translation`, `ruby`, `generatedFields`; cờ trường bổ sung do server xác định, không tin cờ từ AI.
- `POST /api/reading/articles/:articleId/analysis/apply`: `{requestId, expectedUserId, version, annotations}`. Chỉ nhận các câu đúng thứ tự/ID/nguyên văn và phần được phép sửa. Áp dụng tất cả trong một transaction, tăng phiên bản một lần; không ghi dở rồi báo thành công.
- JSON gửi lên A04 có giới hạn 512 KiB (524.288 byte UTF-8). Trước khi áp dụng, FE đo kích thước JSON của `annotations`, dành 512 byte cho UUID tài khoản/lượt phân tích, phiên bản và các khóa bao ngoài; nếu vượt thì giữ bản xem trước, yêu cầu rút gọn phần bổ sung và chặn lưu. Backend vẫn kiểm tra toàn bộ body, trả `413 BODY_TOO_LARGE` trước khi ghi nếu vượt giới hạn; không nới giới hạn JSON của các API khác.
- Phản hồi apply chỉ trả metadata phiên bản mới. FE tải lại DTO chính thức để manifest audio khớp phiên bản mà vẫn dùng cùng file.

Migration cộng thêm `202611060001_reading_analysis` tạo `reading_analysis_requests` liên kết FK tới tài khoản và bài đọc. Giữ hash nội dung/model/prompt/phiên bản, trạng thái, kết quả xem trước, dấu có gọi provider và hash/phiên bản đã áp dụng. Dịch/ruby cuối cùng vẫn nằm trong JSONB của `reading_articles`; không tạo kho kiến thức khác hoặc sửa nội dung xuất bản.

Quota được tính chung với các chức năng Gemini hiện có: mặc định 20 lượt/tài khoản và 100 lượt toàn hệ thống trong 24 giờ, theo cấu hình. Gọi provider bị lỗi vẫn tính lượt. Cache-hit không tính thêm nhưng vẫn ghi UUID để chống dùng lại cho nội dung khác. Chờ provider tối đa 90 giây, FE 105 giây, giữ yêu cầu pending 120 giây; không tự retry.

## Bảo toàn và lỗi

- Kiểm tra phiên, tài khoản, bài cá nhân, chưa xóa và version trước gọi AI; kiểm tra lại sau khi AI trả lời. Bài hoặc tài khoản đổi trong lúc chờ thì không áp dụng phản hồi cũ.
- Apply khóa bài và kiểm tra lại snapshot. Hai tab áp dụng cùng lúc chỉ một bản được ghi. Gửi lại cùng request và nội dung đã lưu trả thành công mà không tăng version; đổi payload hoặc bài đã thay đổi sẽ báo xung đột.
- Lỗi mạng khi chưa biết apply có thành công không: giữ nguyên payload, khóa chỉnh sửa và cho thử lưu lại đúng nội dung đó hoặc tải lại bài để kiểm tra.
- Kiểm tra đủ câu, đúng nguyên văn, ruby ghép chính xác, giới hạn độ dài và các trường đã biên tập. Không dùng HTML do AI trả về; nội dung hiển thị bằng text/ruby React.
- F5 không khôi phục hộp xem trước chưa xác nhận. Nội dung đã áp dụng lưu theo tài khoản; không nhập bài khách vào tài khoản.

## Nghiệm thu

Nghiệm thu local ngày **11/11/2026**:

- Gemini thật `gemini-3.8-flash` (model chung đã cấu hình) trả dịch và ruby cho bài ba câu tiếng Nhật. Một lượt trước đó trả 503 được báo lỗi, không ghi nội dung; không tự retry/fallback. Hai lần mở lại bản xem trước dùng cache, `providerCalled=false`.
- UI desktop và 390px: chỉnh đoạn ruby lệch nguyên văn làm nút áp dụng bị khóa; đóng xem trước giữ bài ở version 0. Sửa bản dịch câu đầu, áp dụng tăng lên version 1, F5 giữ bản dịch đã sửa và ruby. Sau đăng xuất không còn đọc được bài cá nhân đó.
- Tạo ba MP3 Edge trước khi áp dụng; sau áp dụng/F5 audio vẫn sẵn sàng, không cần tạo lại vì văn bản Nhật không đổi. Đây là kiểm tra tích hợp, không phải chứng nhận chất lượng phát âm.
- 219 kiểm thử FE/admin/shared đạt, gồm 12 kiểm thử A04 về tài khoản/phiên bản, dữ liệu cũ, ruby, lỗi mạng/gửi lại và kích thước UTF-8. TypeScript cho API/tests, build web/admin/API và kiểm tra ranh giới 246 file nguồn đều đạt. Vite còn cảnh báo kích thước bundle trên 500 kB đã có từ trước.
- 171/171 kiểm thử API đạt: A04 24, Reading 27, A02 15, A06 20, A03 41, C03 13, Shadowing provider/quota 31. Bao gồm giữ phần đã nhập/nội dung bổ trợ/audio, tài khoản và phiên bản, hai tab/gửi lặp, provider lỗi/quota/cache, Unicode 3.000 ký tự và lưu trên 128 KiB/chặn trên 512 KiB mà không ghi dở.
- Migration cộng thêm đã áp dụng ở database local chính; 32 bài đọc trước/sau giữ hash `be583ff933d3989a81a79cb39611e737`. Không reset hoặc thay nội dung đã lưu. UI và Gemini dùng database riêng `nihongo_a04_ui_test`; sau kiểm thử có 0 XP/0 thẻ sao, đã đăng xuất và thu hồi phiên QA.

Bằng chứng local trong `.artifacts/a04/`: `preview-desktop.png`, `preview-mobile.png`, `saved-desktop.png`, `qa-final.json`, `frontend-tests.log`, `api-tests.json` và `build-final.log`. Ảnh/kết quả thử chỉ dùng dữ liệu QA tự biên soạn. Phạm vi này không bao gồm A05 sinh từ/ngữ pháp/quiz hoặc R03 lưu kết quả đọc hiểu.
