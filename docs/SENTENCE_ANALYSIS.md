# A03 — Phân tích câu tiếng Nhật

Trang `/ngu-phap` giữ các khung phân tích hiện có. Ngày 04/10/2026 người dùng duyệt xử lý kính lúp ở backend, sửa chú thích cần mạng; kính lúp dành cho cả khách, Gemini yêu cầu đăng nhập và chưa khóa Premium.

## Cách sử dụng

1. Nhập câu tiếng Nhật tối đa 300 ký tự hoặc bấm một trong ba câu gợi ý. Bấm **Phân tích** hoặc Enter để tách từ thật. Câu gợi ý cũng đi qua cùng bộ xử lý; không có kết quả mẫu gán cho câu lạ.
2. Bấm từng từ để xem cách đọc, từ loại, dạng từ điển/biến hình, Hán Việt từng chữ và nghĩa có trong kho đã xuất bản. Nút loa dùng cài đặt phát âm hiện tại. Furigana dùng cài đặt học chung.
3. Đăng nhập rồi bấm **Phân tích cấu trúc câu (AI)**. Kết quả gồm bản dịch, cụm và vai trò/ý nghĩa, các bước dịch, câu chính, chủ ngữ/vị ngữ/trạng ngữ, giải thích cấu trúc, mẫu ngữ pháp và ghi chú cho từng từ.
4. Nút AI đổi thành **Ẩn phân tích cấu trúc câu**; mở lại kết quả đã có không gọi Gemini thêm. Khi lỗi mạng, dùng **Thử lại**. Sửa câu làm mất hiệu lực kết quả cũ; phản hồi đến muộn không được gán sang câu mới.

Nghĩa từ điển và giải thích AI được phân biệt. Từ/chữ chưa có nghĩa trong kho sẽ báo thiếu; không ghép nghĩa Hán Việt thành nghĩa từ. Chủ thể lược bỏ không mặc định luôn là “tôi”. AI có thể phân tích sai; kết quả này không tự xuất bản vào catalog.

Mẫu AI chỉ có ⭐/liên kết khi server tìm được đúng một mẫu tương ứng đang công khai trong kho ngữ pháp. Mẫu chưa khớp hoặc có nhiều mục trùng tên chỉ hiện giải thích AI, không có cấp JLPT giả hay đường dẫn giả. Chỉ bấm ⭐ mới thêm vào Ôn tập; phân tích không tự ghi tiến độ, hoàn thành bài hoặc XP.

## Dữ liệu và bộ tách từ

- `kuromoji@0.1.2` cùng IPADIC chạy ở Express. Từ điển nạp một lần trong tiến trình; không tải dữ liệu bên ngoài cho mỗi câu. Tách từ theo hình thái nên động từ biến hình có thể được chia thành nhiều token hơn ảnh mẫu. Giữ nguyên chuỗi sau NFC/trim và vị trí UTF-16, gồm khoảng trắng, ký hiệu và từ chưa nhận diện.
- Kuromoji cung cấp cách đọc, từ loại và dạng gốc, không có nghĩa tiếng Việt theo ngữ cảnh. Nghĩa tra từ bài giáo trình đã xuất bản và ví dụ Kanji đã xuất bản; phải khớp cách viết/cách đọc. Hán Việt dùng bản Kanji công khai. Không đọc nháp, bài cá nhân hoặc tự nhập bộ N5 chưa duyệt.
- Thư viện dùng Apache-2.0; dữ liệu IPADIC có thông báo NAIST/ICOT riêng đi kèm gói. Khi đóng gói phải giữ `node_modules/kuromoji/LICENSE-2.0.txt` và `NOTICE.md`. [Mã nguồn và cách dùng](https://github.com/takuyaa/kuromoji.js), [thông báo IPADIC](https://github.com/takuyaa/kuromoji.js/blob/master/NOTICE.md).

## Gemini và hạn mức

Trong `apps/api/.env`, điền `GEMINI_API_KEY` và `GEMINI_MODEL`, sau đó khởi động lại API. Chọn model còn được cấp miễn phí trong dự án Google AI Studio **không bật thanh toán**. Không gửi khóa vào chat hoặc đặt trong biến `VITE_*`. Ứng dụng không tự đổi sang model/dịch vụ trả phí; hạn mức ứng dụng không thay thế chế độ thanh toán của dự án Google.

`GEMINI_DAILY_LIMIT` mặc định 20 lượt/tài khoản và `GEMINI_GLOBAL_DAILY_LIMIT` mặc định 100 lượt toàn ứng dụng trong 24 giờ gần nhất, **dùng chung giữa chấm bài ngữ pháp và phân tích câu**. Yêu cầu đã gửi kể cả lỗi provider tính một lượt; cache và retry cùng yêu cầu thành công không gọi/tính lại. Hạn mức thật của Google có thể thấp hơn.

Chỉ câu đang phân tích và thông tin token được gửi tới Gemini; không gửi tài khoản, email, cookie hoặc bài học riêng khác. API dùng phản hồi JSON có schema, sau đó kiểm tra lại câu, token, cụm và đoạn dẫn chứng. Chưa có key/model, timeout, hết quota, bị chặn hoặc JSON sai đều báo lỗi thật; không dựng kết quả thay thế. [Tài liệu phản hồi có cấu trúc của Gemini](https://ai.google.dev/gemini-api/docs/structured-output).

## API và lưu trữ

- `POST /api/sentence-analysis/analyze`: `{ sentence, expectedUserId }`, khách dùng `null`; trả `{ userId, analysis }`. Không lưu câu kính lúp vào database.
- `POST /api/sentence-analysis/ai`: `{ id, sentence, expectedUserId }`, `id` là UUID chống gửi lặp; trả `{ userId, analysis, cached }`. Kiểm tra phiên/Origin/độ dài ở server, kiểm tra lại phiên sau khi Gemini trả về.
- Migration cộng thêm `202610040002_sentence_analysis`; bảng `sentence_analysis_requests` lưu người sở hữu, model, hash câu/token/phiên bản prompt, trạng thái và kết quả JSON, thời điểm. Kết quả chứa câu gốc, là cache riêng theo tài khoản; không dùng cache của người khác. Chưa có trang lịch sử hoặc tự khôi phục câu sau F5.
- Khóa quota cùng transaction đặt chỗ chống hai tab vượt hạn mức. Gọi Gemini ngoài transaction. Link/sao public được đối chiếu lại lúc trả kết quả, kể cả khi lấy cache, để mẫu đã lưu trữ không tiếp tục có link/sao.
- Code nằm trong `apps/api/src/modules/sentence-analysis/` và `apps/web/src/features/grammar/`. `integrations/gemini.ts` chỉ chia sẻ kết nối provider; mỗi chức năng sở hữu prompt, kiểm tra và cách lưu riêng. Không xây dịch vụ AI, queue hoặc vector database mới.

## Nghiệm thu local 04/10/2026

A03 đã kiểm tra Gemini thật với model cấu hình local `gemini-3.8-flash` cho hai câu `先生に日本語を教えていただきました。` và `この電車は京都まで行きますか。`. Cả hai có kết quả ready; UI hiển thị bản dịch, 3 cụm, các bước dịch, cấu trúc và ghi chú từng token. Mẫu AI chưa khớp catalog không có link/sao. Kiểm tra khách/đăng nhập, câu rỗng, đổi câu, chọn token, ẩn/hiện và F5 rồi nhập lại để dùng cache đều đạt. Desktop 1440 và mobile 390 không tràn ngang, không có cảnh báo/lỗi JavaScript trong tab nghiệm thu.

Trước khi dọn dữ liệu QA, database có 5 request của lượt kiểm tra: 3 failed ban đầu và 2 ready; gọi lại sau F5/cache không tăng số request. Không phát sinh XP, sao hoặc tiến độ ngữ pháp. Đã kiểm tra đăng xuất xóa kết quả riêng khỏi màn hình và dọn đúng tài khoản QA cùng các phiên/kết quả của nó. Lỗi provider 400 ban đầu được xử lý bằng schema gửi Gemini gọn hơn, vẫn giữ đầy đủ kiểm tra Zod ở server; sau đó gặp 503 do nhu cầu cao, thử lại đã có kết quả thật.

115/115 FE/shared, build cả ba ứng dụng và kiểm tra ranh giới 161 file đạt. Lượt cuối TypeScript test và 60/60 ca backend liên quan đều đạt, không lỗi transaction; xem bằng chứng chi tiết mới nhất tại [FEATURE_BACKLOG.md](FEATURE_BACKLOG.md). Kết quả A03 không thay thế nghiệm thu trực tiếp Gemini chấm bài C04. Bảng chia thể và trợ lý nổi không thuộc lượt triển khai này.
