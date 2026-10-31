# A02 — AI Format cho bài Chủ động

## Phạm vi đã duyệt ngày 29/10/2026

- Giữ trang và nút **AI Format**. Tài khoản đăng nhập chọn bài, dán tối đa 6.000 ký tự / 50 từ, bấm AI Format để mở bản xem trước có thể sửa.
- Dùng Gemini với `GEMINI_API_KEY` / `GEMINI_MODEL` hiện có ở `apps/api/.env`; không đổi model, tự chia nhiều lượt hoặc bật thanh toán. Chỉ gửi văn bản đã dán, không gửi tên bài, nội dung bài, email hay ID tài khoản cho Gemini.
- Chỉ bổ sung cách đọc, Hán Việt, nghĩa còn thiếu; giữ từ gốc và thông tin đã cung cấp. Các ô AI bổ sung màu vàng và có nhãn cần rà soát. Người dùng có thể sửa cả bốn trường trước khi xác nhận.
- Kết quả AI không tự lưu vào bài. Bản nhập giữ nguyên đến khi xác nhận lưu thành công hoặc người dùng chủ động bỏ/sửa. Đổi bài giữ bản nhập, hủy chờ phản hồi cũ. Rời trang/F5 trước khi lưu không khôi phục hộp xem trước.
- Nhập dùng P03: chỉ thêm mới, bỏ trùng cả từ/cách đọc/Hán Việt/nghĩa sau trim; cùng từ khác nghĩa được giữ. Không tự sao, XP, tiến độ hay cập nhật kho giáo trình.

## Cách dùng

1. Đăng nhập → **Cá nhân → Chủ động** → chọn hoặc tạo bài.
2. Dán danh sách, ví dụ `学校 | trường học` và `犬` trên hai dòng riêng. JSON, bảng phân cột và văn bản tự do đều được nhận; dữ liệu có cột rõ ràng được bảo vệ chặt hơn.
3. Bấm **AI Format**. Chờ kết quả, xem đoạn gốc của mỗi dòng, kiểm tra ô vàng, sửa thông tin nếu cần. Thông tin AI chưa được biên tập viên xác minh.
4. Bấm **Xác nhận thêm … từ**. Ô từ và nghĩa bắt buộc; dòng lỗi hoặc vượt sức chứa bài sẽ chặn lưu. Khi lưu thành công, ô nhập mới được xóa.
5. Nếu bài đổi ở tab khác, dùng **Tải bài và xem lại**. Giữ các chỉnh sửa/UUID của từ, tính lại số từ trùng theo bài mới nhất, không gọi Gemini lại.

Khách vẫn dùng nhập JSON/text trực tiếp. Nếu Gemini lỗi, thiếu cấu hình hoặc hết quota, bản nhập không bị thay bằng dữ liệu mẫu.

## API và dữ liệu

`POST /api/vocab/ai-format` nhận `{id, expectedUserId, lessonId, text}`. Kiểm tra Origin/JSON, phiên sống, đúng tài khoản và bài thuộc tài khoản, giới hạn trước khi gọi dịch vụ. Sau khi Gemini trả về kiểm tra lại phiên và bài. Timeout dịch vụ 45 giây, phía trình duyệt 60 giây.

Kết quả `{userId, id, cached, result: {rows, warnings}}`; mỗi dòng có `word`, `reading`, `hanViet`, `meaning`, `sourceText`, `generatedFields`. Kiểm tra schema, số dòng, độ dài trường, từ và đoạn trích phải nằm nguyên văn trong bản nhập. JSON và bảng 2/3/4 cột giữ số dòng/thứ tự/trường đã có; máy chủ tính lại nhãn bổ sung. Không tự bỏ dòng, sửa nghĩa đã nhập hay tạo từ ngoài nguồn.

Văn bản tự do không có ranh giới trường rõ ràng: kiểm tra được từ/đoạn trích và dấu bổ sung, không chứng minh được hoàn toàn cách hiểu của AI. Hộp xem trước luôn nêu rõ cần đối chiếu. Nếu không biết nghĩa, AI có thể để trống; người dùng phải điền trước khi nhập.

Migration cộng thêm `202610290001_vocab_ai_format` tạo `vocab_ai_requests`, FK tới `users`. Bảng giữ hash phiên bản prompt/model/input, trạng thái pending/ready/failed, kết quả riêng tài khoản, dấu có gọi dịch vụ, thời điểm. Không lưu khóa API hoặc thêm nội dung vào `vocab_lessons` ở bước AI. Không có lịch sử AI riêng trên giao diện; cache được dùng khi gửi lại cùng văn bản/model.

Quota dùng chung C03/A03/Shadowing/A06: mặc định 20 lần/tài khoản và 100 lần/toàn hệ thống trong 24 giờ, theo cấu hình sẵn có. Gọi lỗi vẫn tính lượt; kết quả cache không tính thêm. Khóa transaction ngăn vượt quota do bấm đồng thời. UUID ràng buộc tài khoản/hash, cache-hit UUID cũng được ghi nhận; không dùng lại UUID cho nội dung khác. Khi lỗi mạng chưa biết kết quả, FE giữ UUID để thử lấy lại. Lỗi đã xác định cần lượt mới khi người dùng bấm lại. Giới hạn chờ provider 90 giây, FE 105 giây; pending giữ 120 giây để không tạo hai lượt khi server còn xử lý. Không tự retry, chia nhỏ nhiều lượt, fallback model hoặc bật thanh toán.

## Mã nguồn

- API: `apps/api/src/modules/vocabulary/vocab-ai{,.schema,.routes}.ts`.
- FE: `useVocabAiFormat`, `AiFormatPreviewDialog`, `vocab-ai-format` trong feature vocabulary; trang Chủ động chỉ nối hành động.
- Lưu cuối: `/api/vocab/lessons/import` hiện có, cùng transaction/chống phiên bản cũ/dedup P03.
- Kiểm thử: `apps/api/tests/vocab-ai.test.ts`, `apps/web/tests/vocab-ai-format.test.mjs` và hồi quy import/Gemini chung.

## Nghiệm thu

Hoàn thành local 30/10/2026:

- 15/15 API A02, 7/7 FE A02; bộ FE/admin/shared tổng 198/198 và hồi quy API trước đó đạt. Sau chỉnh thời gian chờ, chạy lại 15 API +12 FE A02/A06, build web/API và TypeScript test đều đạt; boundaries 234 file.
- Gemini thật `gemini-3.8-flash`: nhập `学校` và `先生`, nhận đúng hai dòng, cách đọc/Hán Việt/nghĩa bổ sung được đánh dấu. Hai lượt đầu timeout ở 45 giây; tăng biên chờ có giới hạn, lượt xác minh trả ready sau khoảng 42 giây. Không đổi model hay xóa quota để thử lại.
- UI desktop và 390px: sửa nghĩa `先生` thành `Thầy/cô giáo`, xác nhận thêm đúng 2 từ, F5 giữ dữ liệu. Gửi lại bản nhập lấy cache không gọi provider; ban đầu 1 trùng/1 mới do nghĩa đã sửa, chỉnh lại nghĩa giống bài thành 2 trùng/0 mới và nút xác nhận bị khóa. Đóng preview giữ bản nhập gốc.
- QA trên database test riêng: 2 từ được lưu theo xác nhận; 0 XP, 0 sự kiện ôn, không tạo thẻ sao. Hai thẻ có sẵn là fixture A06. Đã đăng xuất/dọn đúng tài khoản QA, API trở về DB chính; không thay dữ liệu người dùng.
- Bằng chứng `.artifacts/a02/ai-format-preview.png`, `ai-format-mobile-duplicates.png` và `.artifacts/a06/acceptance.json`. Đây là nghiệm thu luồng, không cam kết mọi nghĩa/cách đọc AI sinh ra đều chính xác; luôn cần rà soát trước nhập.
