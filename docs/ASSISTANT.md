# A06 — Trợ lý hỗ trợ NIHONGO

## Quyết định ngày 30/10/2026

- Giữ nút hoa và khung chat; đổi tên thành **Trợ lý NIHONGO**, bỏ chữ **Đang online** và chấm xanh.
- Đăng nhập để hỏi Gemini, dùng `GEMINI_MODEL`/`GEMINI_API_KEY` hiện có, hạn mức AI chung và mức miễn phí. Không tự chọn model Shadowing hoặc bật thanh toán.
- Hỗ trợ toàn web bằng hướng dẫn chức năng từ source và kho đã xuất bản; có liên kết thật để người học tự mở.
- Chỉ đọc dữ liệu học của chính tài khoản khi câu hỏi hiện tại yêu cầu. Trợ lý không ghi bài, gắn sao, ghi tiến độ/XP, làm bài, mua gói hay đổi quyền.
- Hội thoại chỉ giữ trong bộ nhớ trang. Đóng/mở khung hoặc chuyển trang trong ứng dụng vẫn giữ; F5 hoặc đổi tài khoản sẽ xóa. Không lưu hội thoại vào database/localStorage.

## Cách dùng

Đăng nhập, bấm biểu tượng hoa ở góc dưới và nhập câu hỏi, ví dụ:

- “Bỏ ngôi sao có làm mất lịch ôn tập không?”
- “Hướng dẫn nhập từ bằng AI Format.”
- “Làm sao học và mở khóa buổi tiếp theo trong JLPT?”
- “Tôi cần ôn gì hôm nay?”
- “Thống kê các bài Chủ động của tôi.”
- “XP của tôi bao nhiêu?” hoặc “Tóm tắt tiến độ học của tôi.”

Liên kết dưới câu trả lời dẫn tới trang tương ứng. Trợ lý chỉ hướng dẫn; người dùng tự thực hiện thao tác. Khi lỗi mạng/quota/provider, câu hỏi và lỗi vẫn hiện, có **Thử lại**; không dùng câu trả lời mô phỏng thay thế. Khách thấy lời nhắc đăng nhập.

Mỗi câu hỏi tối đa 1.000 ký tự. Hiển thị 10 lượt trao đổi gần nhất; gửi tối đa 5 cặp hỏi/đáp đã thành công (10 tin, 16.000 ký tự) làm ngữ cảnh. Tin lỗi/đang chờ không được coi là câu trả lời thành công. Enter khi đang chọn chữ bằng bộ gõ tiếng Nhật không gửi nhầm.

## Nguồn và dữ liệu cá nhân

`assistant-knowledge.ts` giữ các hướng dẫn chức năng đã đối chiếu với source. Khi tìm nội dung hoặc hỏi trang chi tiết, tái sử dụng `jlpt.resources.ts` để lấy Kanji, bài từ vựng, mẫu ngữ pháp, bài đọc thư viện, Shadowing đã xuất bản. Không lấy bản nháp, nội dung lưu trữ hoặc bài cá nhân qua kho công khai. Tối đa 10 nguồn công khai; không tải toàn bộ catalog vào prompt.

`assistant-personal.ts` nhận diện yêu cầu dữ liệu cá nhân thận trọng từ câu hỏi hiện tại; không suy quyền từ lịch sử chat hoặc trang đang mở. Câu hỏi cách dùng thông thường không truy vấn dữ liệu học riêng. Câu chưa rõ có thể cần người dùng nói cụ thể “của tôi”. Luôn lấy `userId` từ phiên server, không dùng ID tài khoản do AI chọn.

Thông tin hỗ trợ gồm: thẻ đang sao/đến hạn theo loại; số bài/từ và tên tối đa 10 bài Chủ động gần nhất; đánh giá flashcard; ngày hoàn thành lộ trình Kanji; mốc/điểm cao nhất JLPT; số bài giáo trình/mẫu ngữ pháp có tiến độ và hoàn thành; tối đa 3 kết quả Kana; số/tên bài đọc cá nhân; số video/trạng thái/kết quả Shadowing; XP tổng/hôm nay/tháng theo ngày Việt Nam. Đây là số liệu đã lưu, không suy diễn thời gian học, năng lực, streak hoặc thứ hạng khi không có nguồn.

Không gửi email, mật khẩu, API key, cookie, đáp án đề thi, toàn bộ nội dung bài riêng hoặc mặt thẻ. Những tên bài và số liệu cần thiết để trả lời yêu cầu cá nhân được gửi tới Gemini. Chỉ dẫn hoặc nội dung trong tên bài, kho nội dung, lịch sử và câu hỏi đều được coi là dữ liệu, không cấp quyền thao tác.

## API, quota và chống phản hồi cũ

`POST /api/assistant/chat` nhận `{id, expectedUserId, message, history, currentRoute?}`; trả `{userId, id, cached, reply: {text, sources:[{id,title,url}]}}`.

Server kiểm tra Origin/JSON/phiên/tài khoản, giới hạn dữ liệu, chuẩn hóa route và chỉ lấy nguồn được phép. Không chuyển query/hash/ID bài riêng chưa công khai làm ngữ cảnh trang. Gemini trả văn bản và ID nguồn; server kiểm tra ID thuộc tập nguồn đã cung cấp, dựng liên kết từ dữ liệu thật, không cho model tạo URL tùy ý. FE không render HTML/Markdown của model. Trước khi trả, server kiểm tra lại phiên và dữ liệu nguồn; nguồn bị lưu trữ hoặc tiến độ đổi trong lúc chờ sẽ yêu cầu gửi lại, không trình bày số liệu cũ như hiện tại.

Migration cộng thêm `202610300001_assistant` tạo `assistant_requests`: chỉ UUID, user FK, hash, model, trạng thái và thời điểm, không có nội dung hội thoại/kết quả. Bảng này dùng chung khóa quota với C03/A03/A02/Shadowing, mặc định 20 lần/tài khoản và 100 lần/toàn ứng dụng/24 giờ (tôn trọng cấu hình hiện có). Lỗi provider vẫn tính lượt; bấm gửi lặp đang chờ không gọi lại.

Kết quả phục vụ thử lại do mất mạng chỉ nằm trong bộ nhớ API tối đa 10 phút, tối đa 100 bản, ràng buộc tài khoản/UUID/hash. Không có API xem lịch sử. Restart hoặc hết thời gian sẽ yêu cầu một lượt mới do người dùng bấm; không tự gọi lại. Timeout provider 45 giây, trình duyệt 60 giây. UUID giữ khi kết quả mạng chưa rõ hoặc `AI_BUSY`; lỗi terminal dùng UUID mới ở lần thử thủ công.

## Kiểm thử

- API: `apps/api/tests/assistant.test.ts`, `assistant-knowledge.test.ts`.
- FE: `apps/web/tests/assistant-chat.test.mjs`.
- Hồi quy AI Format và quota/Shadowing; TypeScript, build và `check:boundaries`.
- 30/10/2026: 36/36 API A06 (20 account/provider +16 nguồn/route), 15/15 AI Format và 31/31 Shadowing provider/quota đạt; 198/198 FE/admin/shared. Build web/API, TypeScript tests và kiểm tra ranh giới import đạt. Sau chỉnh chống Enter IME/rút gọn tổng quan, build web/API và 36 API A06 chạy lại đạt.
- Gemini thật theo `GEMINI_MODEL=gemini-3.8-flash`: câu hỏi về bỏ sao trả đúng giữ lịch/lịch sử; câu hỏi “Tôi cần ôn gì hôm nay?” trả đúng 1 Kanji +1 từ vựng từ tài khoản QA trên DB test. Không đổi model, không reset quota để thử. Lượt ban đầu timeout được hiển thị lỗi; lượt sau thành công, không có câu trả lời dự phòng giả.
- UI desktop 1280×720 và mobile 390×844: không còn online/chấm xanh; liên kết mở đúng Ôn tập, đóng/mở/chuyển route giữ chat, F5 xóa chat; câu hỏi rỗng không gửi. Khung mobile nằm trong viewport, không tràn ngang. Ảnh `.artifacts/a06/assistant-desktop.png`, `assistant-mobile.png`.
- Đăng xuất xóa cả bản nháp câu hỏi; mở lại là khách với ô nhập vô hiệu và nút đăng nhập, không còn số liệu/chat cũ. Console ở lượt cuối không có lỗi/cảnh báo. Metadata kiểm chứng tại `.artifacts/a06/acceptance.json`: 2 ready +2 failed ban đầu, 0 XP/0 sự kiện ôn, hai thẻ fixture không tăng. Đã dọn đúng hai tài khoản QA A02/A06 trong DB test và trả API về DB chính; main không có request/QA của lượt thử. Không reset hoặc thay đổi dữ liệu học chính.
