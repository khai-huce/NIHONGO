# P05 — Kết quả Trắc nghiệm/Nhồi nhét Chủ động

Hoàn thiện ngày 14/09/2026. Người dùng duyệt cả ba lựa chọn: chỉ lưu lượt hoàn thành, bỏ qua từ thiếu dữ liệu của chế độ, xác nhận rồi bắt đầu lượt mới khi đổi chế độ. Người dùng cũng duyệt sửa câu hỏi Kanji thành cách đọc + nghĩa → chọn chữ đúng.

## Luồng sử dụng

1. Chọn bài và mở Trắc nghiệm hoặc Nhồi nhét. Tài khoản đọc nội dung và kết quả hoàn thành gần nhất của loại học đó; nếu đã có kết quả, hiển thị bằng màn kết quả cũ. Dùng nút **Làm lại bài này** / **Học lại lần nữa** để bắt đầu lượt mới.
2. Mỗi lượt dùng nội dung bài tại thời điểm bắt đầu, một chế độ và UUID riêng. Chỉ những từ có đủ dữ liệu mới được đưa vào câu hỏi. Hiển thị số từ bị bỏ qua; nếu không có từ hợp lệ, hiện 0/0 và thông báo, giữ các nút chọn chế độ để chuyển sang chế độ khác.
3. Mỗi từ chỉ tính điểm ở lần trả lời đầu. Gợi ý hoặc nghe phát âm vẫn được phép. Nhồi nhét trả lời sai có thể sửa và thử lại để luyện; đáp án thử lại không thay điểm lần đầu. Nút bỏ qua chuyển sang câu tiếp theo. Trắc nghiệm **Câu này bó tay** tính sai.
4. Khi hoàn tất câu cuối và tiếp tục, gửi toàn bộ câu trả lời về server để kiểm tra và tính điểm. Chỉ hiện màn hoàn thành sau khi server xác nhận đã lưu. Không nhận điểm tổng do FE tự khai.
5. Đổi chế độ mở hộp xác nhận trong ứng dụng. **Hủy** giữ lượt/kết quả hiện tại; **Bắt đầu lượt mới** tải nội dung mới nhất, xóa trạng thái lượt đang làm ở FE và tạo UUID mới. Bấm lại chế độ hiện tại không tạo lượt mới.
6. Lỗi lưu giữ câu trả lời và UUID trên màn đang mở, cho **Thử lưu lại**. Bấm lặp hoặc gửi lại cùng lượt/câu trả lời trả về đúng bản đã lưu, không tạo bản trùng. Nếu nội dung nguồn đã thay đổi, báo lỗi và cho bắt đầu lượt mới; không chấm âm thầm theo đáp án đã sửa ở tab khác.
7. F5/mở lại đọc kết quả đã lưu gần nhất. Lượt còn dở không được lưu để tiếp tục. Học lại tạo kết quả mới, không xóa kết quả trước. Xóa bài nguồn không xóa các lượt hoàn thành.

Khách chỉ có kết quả trong màn đang mở. Không nhập dữ liệu khách/localStorage vào tài khoản. Kết quả lượt học tách khỏi `vocab_progress` và sao/Ôn tập; không tự thêm thẻ, đổi lịch SRS hay cộng XP.

## Câu hỏi và chấm điểm

| Chế độ | Câu hỏi hiện có | Đáp án / dữ liệu cần có |
|---|---|---|
| Trắc nghiệm · Ý nghĩa | Nghĩa | Chọn chữ/từ; cần từ và nghĩa |
| Trắc nghiệm · Kanji | Cách đọc + nghĩa, theo duyệt | Chọn chữ/từ; cần từ, nghĩa, cách đọc |
| Trắc nghiệm · Cách đọc | Chữ/từ | Chọn cách đọc; cần từ, nghĩa, cách đọc |
| Nhồi nhét · Cách đọc | Chữ/từ + nghĩa | Gõ cách đọc; cần từ, nghĩa, cách đọc |
| Nhồi nhét · Âm Hán | Chữ/từ + nghĩa | Gõ Hán Việt; cần từ, nghĩa, Hán Việt |

Không dùng chữ gốc thay cho cách đọc còn thiếu. Trường chỉ có khoảng trắng hoặc dấu câu không được coi là dữ liệu hợp lệ. Các đáp án nhiễu Cách đọc dùng kana; không còn trộn chữ Kanji từ danh sách dự phòng vào câu hỏi chọn kana. Bài ít từ vẫn có bốn lựa chọn khác nhau bằng tập đáp án phụ nhỏ có sẵn; không nhập những từ đó vào bài học.

Quy tắc thuần dùng chung ở `shared/vocab-study.mjs` cho FE và Express. Nhồi nhét nhận kana/katakana/romaji được bộ chuyển hiện có hỗ trợ, xử lý n/nn và phụ âm kép; giữ phân biệt dấu đục và kana nhỏ. Hán Việt nhận khác biệt hoa thường, khoảng trắng và dấu tiếng Việt. Đáp án rỗng/ký hiệu không thể thành câu đúng. Đây là bộ chuyển romaji nhỏ trong dự án, không phải một IME đầy đủ.

## Lưu trữ và API

Migration cộng thêm `202609140001_vocab_study_results` tạo **một bảng** `vocab_study_results`: UUID lượt, chủ tài khoản, ID/tên/version bài lúc lưu, loại/chế độ, tổng/đúng, câu trả lời cùng kết quả chấm, mã băm nội dung gửi và thời điểm hoàn thành. Liên kết user có cascade; ID bài là tham chiếu lịch sử để xóa nguồn không xóa kết quả.

- `GET /api/vocab/results?lessonId=UUID&kind=quiz|cram`: kiểm tra bài thuộc tài khoản; trả `{userId, lesson:{id,name,words,version}, result}` với kết quả gần nhất hoặc null, trong cùng transaction/khóa tài khoản.
- `GET /api/vocab/results/:id`: đọc một kết quả đúng chủ sở hữu, kể cả khi nguồn đã xóa. Chưa thêm giao diện duyệt toàn bộ lịch sử trong P05.
- `POST /api/vocab/results`: nhận `{id, expectedUserId, lessonId, lessonVersion, kind, mode, answers:[{wordId,answer}]}`. `answer:null` là bỏ qua. Không nhận `score`/`correct` do client đưa vào.
- Server kiểm tra đúng tập từ hợp lệ, mỗi ID đúng một lần, không thiếu/thừa/ngoài bài, và version nội dung còn đúng. Giới hạn 500 câu, 500 ký tự mỗi đáp án, body riêng 512 KiB; giữ giới hạn 16 KiB của API chung và auth. Có rate limit 120 request/phút.
- Dùng transaction và khóa tài khoản chung với bài học. Cùng UUID và cùng câu trả lời trả bản cũ ngay cả khi nguồn đã sửa/xóa sau lần lưu thành công; cùng UUID nhưng nội dung hoặc tài khoản khác trả 409. Điểm lưu do server tính từ nội dung bài, không do FE báo tổng.

Không tạo bảng lượt đang làm, dịch vụ nền, hàng đợi offline hoặc dependencies mới. Hai tiến trình dùng file thuần `shared/vocab-study.mjs`; giữ thư mục `shared` cùng repository khi chạy `server/dist/index.js`.

Local đã generate Prisma Client và chạy `npm run db:migrate` bằng migrate deploy. Không reset hoặc xóa dữ liệu người dùng để áp dụng migration.

## Nghiệm thu ngày 14/09/2026

- **105/105 backend test**, 6 tệp: auth/review 40, bài học 17, import 11, tiến độ Flashcard 17, thống kê Ôn tập 5, kết quả P05 15. Chạy trên `nihongo_test` có guard tên/host; không dùng database người dùng để test suite.
- 15 case P05: năm tổ hợp loại/chế độ; phiên/Origin/schema/body; đúng chủ tài khoản và ID; tập câu đầy đủ; trường thiếu/đáp án rỗng; version cũ; F5/đăng nhập khác/khởi động app khác; kết quả gần nhất; gửi trùng/khác payload/hai tài khoản cùng UUID; nguồn sửa/xóa; rollback; không thay tiến độ Flashcard hoặc SRS.
- **30/30 FE/shared test**: 9 case mới `test:vocab-study` + 21 case hiện có (review, routes, import, vocab-progress). Bao gồm lọc từng chế độ, normalizer, romaji/kana/Hán Việt, dấu đục/kana nhỏ, lựa chọn nhiễu đúng loại và không trùng.
- Build frontend và backend đạt; Vite vẫn có cảnh báo bundle trên 500 KiB như trước.
- UI Nhồi nhét: bài 3 từ → 2 từ đủ cách đọc → câu đầu sai rồi thử đúng, câu sau đúng khi bấm đúp → kết quả **1/2**, F5 mở lại vẫn 1/2. Âm Hán bỏ từ không có Hán Việt, nhận đáp án không dấu, dùng gợi ý vẫn đúng → lượt mới **2/2**, giữ lượt cũ.
- UI Trắc nghiệm: đáp án đúng + chuyển thủ công không bị timer chuyển thêm câu; bỏ qua tính sai. Tạm gỡ **riêng bài QA** để làm lần lưu cuối bị từ chối → không hiện hoàn thành giả, giữ câu trả lời → khôi phục fixture → bấm đúp **Thử lưu lại** → kết quả **2/3**, F5 giữ đúng kết quả. Đối chiếu DB kiểm tra chỉ một bản cho lượt đó.
- Hộp xác nhận trong ứng dụng: kiểm tra **Hủy** và **Bắt đầu lượt mới** ở cả Quiz/Cram. Kanji hiển thị `がっこう` + `Trường học` → lựa chọn có `学校` theo duyệt. Khi toàn bộ cách đọc trống, hai màn hiển thị 0/0, số từ bỏ qua và vẫn cho đổi chế độ; không lưu lượt rỗng.
- Đối chiếu JSX/AST: giữ className và nhãn của màn học/kết quả thông thường. Chỉ đưa trạng thái trống vào vùng câu hỏi để giữ các nút đổi chế độ (thay early-return cũ), thêm thông báo cần thiết và hộp xác nhận đã duyệt. Thông tin câu hỏi Kanji đổi đúng phần người dùng đã đồng ý.

Tài khoản/bài QA dùng riêng và được dọn sau nghiệm thu. P06 là task kế tiếp để đề xuất; chưa triển khai lộ trình hoặc màn lịch sử kết quả mới trong P05.
