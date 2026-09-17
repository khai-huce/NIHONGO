# P10 — Kết quả bài tập nghe chọn chữ

Triển khai local và nghiệm thu ngày 16–17/09/2026 tại `/tu-vung/bang-chu-cai`. Giữ bảng chữ và khung bài tập cũ; kết quả hoàn thành hiển thị ngay trong khung đó. Không thêm trang lịch sử.

## Quy tắc của một lượt học

- Catalog cố định `kana-v1` gồm **104 mục** hiện có: 46 âm trong, 25 âm đục/bán đục, 33 âm ghép. ID là Hiragana, nên `じ`/`ぢ` và `ず`/`づ` vẫn là các mục riêng. Giữ nguyên dữ liệu, thứ tự bảng và ô trống; mở rộng hoặc thay đổi catalog phải có quyết định phiên bản riêng.
- Mỗi lượt hỏi đủ 104 mục, mỗi mục đúng một lần, xáo thứ tự bằng Fisher–Yates. Mỗi câu có bốn lựa chọn thuộc cùng một bảng chữ, khác nhau về phát âm và có đáp án đúng. Không đặt hai chữ đồng âm làm đáp án cạnh tranh trong một câu.
- Ba chế độ: Hiragana, Katakana, Cả hai. Cả hai có đúng 52 câu Hiragana và 52 câu Katakana, xáo xen kẽ. Bảng chữ của câu được giữ cố định khi hiển thị lựa chọn, nghe lại và hiện đáp án; đổi tab bảng chữ phía trên không đổi câu đang làm.
- Mỗi câu chỉ nhận lần trả lời đầu. Phím 1–4 trả lời, Enter sang câu tiếp, R nghe lại; giữ phím hoặc bấm lặp không cộng thêm điểm hay bỏ qua câu. Đáp án đồng âm `じ`/`ぢ`, `ず`/`づ` được chấm đúng theo catalog.
- **Chỉ lưu khi đã trả lời đủ 104 câu.** Server tự chấm từ danh sách câu trả lời; không nhận điểm, tổng câu hoặc thời điểm hoàn thành do client tự khai. Lượt dở không có bản nháp trên server hay localStorage.
- Đã đăng nhập: mở lại trang lấy **kết quả hoàn thành gần nhất trên cả ba chế độ**. Làm lại tạo UUID lượt mới; kết quả trước vẫn giữ trong DB. Nếu bỏ lượt mới giữa chừng, lần mở trang sau vẫn lấy kết quả hoàn thành trước đó.
- Khách: chơi và xem kết quả trong lượt mở hiện tại, chỉ giữ trong bộ nhớ. Đăng nhập không tự nhận lượt khách vào tài khoản. Không tự thêm ⭐, lịch Ôn tập, tiến độ Kanji, lộ trình hoặc XP.

Khi câu cuối lưu lỗi, giữ nguyên 104 câu trả lời và UUID để bấm “Thử lưu lại”; không báo đã lưu và không mở lượt khác khi kết quả đang chờ lưu. Đổi tài khoản hoặc rời trang hủy quyền cập nhật của phản hồi cũ. Cảnh báo tải/lưu/lỗi dùng ngay trong khung bài tập.

## Dữ liệu và API

Migration bổ sung `server/prisma/migrations/202609160001_kana_quiz_results/migration.sql`, đã áp dụng cho DB local và DB test, không reset DB hoặc đổi dữ liệu cũ.

Một bảng `kana_quiz_results` lưu:

| Trường | Ý nghĩa |
|---|---|
| `id`, `user_id` | UUID lượt học, chủ tài khoản lấy từ phiên |
| `catalog_id`, `mode` | Phiên bản catalog và chế độ |
| `total`, `correct` | Số câu và số đúng do server tính; có ràng buộc điểm hợp lệ |
| `answers` | JSONB theo đúng thứ tự nộp: `kanaId`, `script`, `answerId`, `correct` |
| `submission_hash` | SHA-256 của catalog, chế độ và toàn bộ câu trả lời, dùng kiểm tra gửi lặp |
| `completed_at` | Thời điểm server lưu hoàn thành |

Có index `(user_id, completed_at)`. Xóa tài khoản xóa các kết quả của tài khoản qua khóa ngoại; học lại hoặc đổi chế độ không xóa lịch sử.

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/kana/results` | Không có query | `{ userId, result }`; `result: null` khi chưa có lượt hoàn thành |
| `POST /api/kana/results` | `{ id, expectedUserId, catalogId: "kana-v1", mode, answers }` | `{ userId, result }`; 201 khi tạo, 200 khi gửi lại đúng lượt đã lưu |

`answers` phải có đúng 104 phần tử `{ kanaId, script, answerId }`: đủ 104 ID catalog không trùng, đáp án tồn tại, script khớp chế độ; Cả hai bắt buộc 52/52. Response `result` gồm `id`, `catalogId`, `mode`, `total`, `correct`, `answers`, `completedAt`.

- Mọi request cần phiên còn hiệu lực; POST cần Origin đúng và JSON. `expectedUserId` chặn trang cũ khi cookie đã đổi tài khoản, không quyết định owner.
- Cùng UUID và cùng nội dung trả lại đúng kết quả, kể cả gửi đồng thời hoặc mất phản hồi rồi thử lại. Cùng UUID nhưng đổi câu trả lời, thứ tự, chế độ hoặc khác owner nhận `409 RESULT_CONFLICT`; không ghi đè kết quả cũ.
- Sai tài khoản nhận `409 ACCOUNT_CHANGED`; thiếu phiên nhận 401. Input sai bị từ chối trước khi ghi; lô không đủ/không đúng catalog nhận 400. Ghi lỗi rollback, không lưu một phần.
- Body tối đa **32 KiB** riêng route này; giới hạn chung 16 KiB vẫn giữ cho các API còn lại không có cấu hình riêng. Rate limit 120 request/phút; response `Cache-Control: no-store`.

Quy tắc dùng chung nằm trong `shared/kana-quiz.mjs` và khai báo kiểu `shared/kana-quiz.d.mts`. FE nối qua `src/hooks/useKanaQuiz.ts`, `src/pages/AlphabetPage.tsx`; backend qua `server/src/kana-results.routes.ts`.

## Bằng chứng nghiệm thu

- Build frontend và backend thành công. **64/64 test FE/shared** đạt, gồm 8 test mới cho catalog, xáo câu, lựa chọn không mơ hồ, 52/52, chấm điểm và validation.
- **12/12 test API P10** đạt với PostgreSQL test: phiên/Origin/giới hạn body, dữ liệu sai, chấm điểm, owner, kết quả gần nhất, gửi lặp/đồng thời/xung đột, rollback và không tác động sao/SRS/tiến độ khác.
- Lần chạy toàn bộ backend có 153 test đạt và 1 lỗi ở hook chuẩn bị test P05 do DB mất kết nối. Sau phục hồi, chạy lại riêng P05 đạt **15/15**. Không coi lần chạy toàn bộ ban đầu là đã đạt hoàn toàn.
- Trình duyệt, tài khoản QA: hoàn thành Cả hai 104 câu, hiển thị **24 đúng / 80 sai**. Mọi câu dùng cùng một script cho bốn lựa chọn. Sau 103 câu, DB chưa có kết quả.
- Dừng API trước câu 104: hiện lỗi và giữ các câu trả lời. Khởi động lại rồi bấm thử lưu hai lần: DB chỉ có **một kết quả**, đúng 104 đáp án, 52 Hiragana/52 Katakana, điểm 24.
- F5 đọc lại đúng 24/80. “Làm lại” về câu 1/104; phím 1 và Enter hoạt động. Trả lời một câu của lượt làm lại rồi F5 khôi phục kết quả cũ 24 đúng / 80 sai / 104 câu, không nhận lượt dở là lượt hoàn thành. API đã kiểm tra tách tài khoản và tải lại kết quả qua phiên đăng nhập mới.
- Đăng xuất trở về màn chọn chế độ, không hiện kết quả tài khoản. Khách chọn Katakana, trả lời một câu rồi F5 trở về chọn chế độ, không tiếp tục lượt dở và không nhập dữ liệu khách vào tài khoản.
- Đối chiếu source bằng AST: giữ nguyên **92/92 thuộc tính `className` cũ** của trang. Chỉ thêm phần tải/lỗi, ghi chú khách và kết quả trong khung hiện có; dữ liệu bảng chữ đối chiếu nguyên vẹn với phiên bản trước.
- Đã dọn đúng tài khoản QA theo UUID/email, một kết quả và phiên QA; xác nhận không tạo sao hoặc tiến độ Kanji. Giữ nguyên dữ liệu người dùng. Console trình duyệt không ghi nhận lỗi JavaScript trong lượt kiểm tra cuối.

Lệnh kiểm tra liên quan:

```powershell
node --test tests/kana-quiz.test.mjs
npm --prefix server test -- tests/kana-results.test.ts
npm run build:server
npm run build
```

## Giới hạn hiện tại

Trình duyệt QA chưa có giọng Nhật, nên chưa nghiệm thu nghe thực tế; đã kiểm tra script được truyền nhất quán và thông báo thiếu giọng. Phát âm tiếp tục dùng TTS trình duyệt và cấu hình tốc độ hiện có.

P10 chưa lưu lượt dở, chưa có UI xem toàn bộ lịch sử, không đồng bộ tiến độ từng câu giữa hai tab. Flashcard, luyện viết và xuất PDF của bảng chữ không thuộc task này. Kết quả khách mất khi rời trang/F5; kết quả tài khoản chỉ tồn tại sau khi server xác nhận lưu thành công.
