# J01/J02/J03 — Kho, tiến độ và kiểm tra JLPT

## Trạng thái hiện tại — 26/10/2026

J02/J03 đã nối database → API → trang học và admin. Theo quyết định mới của người dùng, **chỉ cần đạt bài kiểm tra cuối buổi** để hoàn thành và mở buổi tiếp theo; không yêu cầu đánh dấu đủ tài liệu. Ngưỡng mặc định 80%, admin được chỉnh 1–100%. Thi lại không giới hạn; giữ điểm cao nhất, mốc đã đạt và từng lần thi. Các mô tả “J02/J03 chưa làm” trong phần nghiệm thu J01 bên dưới là lịch sử.

Đã nhập và xuất bản lộ trình **NIHONGO N5 — Từ nền tảng đến tổng ôn** trên database chính: 40 buổi, 324 liên kết, 662 từ OpenJLPT, 103 Kanji từ kho hiện có, 62 mẫu ngữ pháp với 186 bài tập, 31 bài đọc/nghe song ngữ, 156 MP3 Edge TTS và 516 câu kiểm tra. Đây là giáo trình tham khảo do NIHONGO biên soạn có AI hỗ trợ, không phải danh mục/đề thi JLPT chính thức hay chứng nhận đã được biên tập viên bản ngữ kiểm duyệt. Chi tiết nguồn, nội dung, cách tái tạo và nhập ở [README bộ N5](../apps/api/content/jlpt-n5/README.md).

### Người học

1. Mở `http://localhost:3000/tron-doi/jlpt?level=N5`, đăng nhập để lưu tiến độ và làm kiểm tra.
2. Bấm **Vào học buổi** để mở danh sách tài liệu. Liên kết dẫn tới các trang Kanji, từ vựng, ngữ pháp, đọc hiểu và bảng chữ sẵn có. Mở trang không tự hoàn thành buổi.
3. Chọn **Làm bài kiểm tra ngay**. Mỗi lựa chọn được lưu lên server; chỉ báo đã lưu sau khi API thành công. F5 hoặc mở lại tiếp tục lượt dở cùng phiên bản đề.
4. Trả lời đủ câu rồi **Nộp bài**. Server chấm điểm; chỉ sau khi nộp mới trả đáp án và giải thích. Đạt mức quy định sẽ mở buổi kế tiếp. Chưa đạt có thể xem giải thích rồi **Làm lượt mới**.
5. **Lịch sử** tại từng buổi hiển thị các lượt đã nộp, điểm, ngưỡng và kết quả. Học lại không xóa mốc đã đạt. Không nhập tiến độ khách vào tài khoản.

Phần trăm = số buổi hiện còn trong bản xuất bản đã đạt / tổng buổi hiện còn. Kanji đã học = số ID Kanji liên kết có đánh giá trong `kanji_progress`, dù đánh giá nhớ/chưa nhớ. Streak = chuỗi ngày có nộp kiểm tra JLPT, theo giờ Việt Nam, kết thúc hôm nay hoặc hôm qua. Thời lượng là dự kiến trong giáo án, không phải số giờ đã học được đo tự động.

### Quản trị đề và mức đạt

Vào `http://localhost:3002/admin/jlpt`, chọn N5. Trường **Điểm đạt bài kiểm tra (%)** áp dụng cho lộ trình. Mở **Bài kiểm tra cuối buổi** để thêm/sửa/xếp câu: đề, đoạn đọc tùy chọn, bốn lựa chọn khác nhau, đáp án đúng và giải thích. Mỗi buổi cần ít nhất 5 câu trước khi xuất bản. Lưu nháp → xem trước cả ngưỡng/đề/đáp án → xuất bản.

Nháp không ảnh hưởng trang học. Xuất bản lại làm các lượt chưa nộp thuộc phiên bản cũ hết hiệu lực; tải lại lộ trình và bắt đầu lượt mới. Các lượt đã nộp giữ nguyên snapshot đề, đáp án, ngưỡng và điểm. Không thu hồi mốc đạt sau khi đổi mức, sửa hoặc xếp lại buổi. Buổi chưa đạt cần mọi buổi đứng trước đã đạt; buổi đã đạt vẫn mở được khi xếp lại. Lưu trữ giữ dữ liệu và lịch sử trong database; giao diện học không mở lộ trình đã lưu trữ.

### Lưu trữ và API J02/J03

Migration cộng thêm `202610250001_jlpt_study` tạo `jlpt_enrollments`, `jlpt_session_progress`, `jlpt_attempts`; FK tới user/lộ trình/buổi hiện có. Đề nằm trong metadata phiên bản của buổi; attempt lưu snapshot để không chấm lại lịch sử bằng đề mới. Không thay `catalog_definitions/n5-v1`, các lộ trình Kanji hay hệ SRS.

- `GET /api/jlpt/study/roadmaps/:level`: tiến độ, buổi tiếp tục, mốc đạt, điểm cao nhất, lượt dở.
- `POST /api/jlpt/study/roadmaps/:level/sessions/:id/open`: lưu vị trí, không hoàn thành.
- `POST .../sessions/:id/attempts`: mở/tiếp tục lượt dở, dùng UUID chống gửi lặp.
- `GET /api/jlpt/study/attempts/:id`: chỉ tài khoản sở hữu.
- `POST .../attempts/:id/save` và `/submit`: version, `expectedUserId`, đáp án theo UUID câu; server kiểm tra đủ câu và tự chấm.
- `GET /api/jlpt/study/sessions/:id/attempts?page=1`: lịch sử riêng tài khoản, 20 lượt/trang.

Origin/phiên đăng nhập/ID tài khoản, khóa transaction theo tài khoản và version chống hai tab ghi đè. Public catalog không trả đáp án. Gửi lại cùng bài đã nộp trả kết quả cũ, không tăng lượt. Transaction có thời hạn 30 giây để chịu được lúc admin đang lưu giáo trình nhiều buổi, không giữ khóa trong khi gọi AI/audio. JLPT không tự tạo XP hoặc ⭐; học tại các trang nguồn vẫn theo quy tắc XP/SRS đã duyệt của chúng.

### Bằng chứng J02/J03 và bộ N5

- Bộ hồi quy 125 API test của 8 suite đạt, cùng 3 test cấu trúc/bao phủ dữ liệu N5 và 182 test frontend/shared/admin. Sau rà soát cuối, 22 test J01/J02/nội dung được chạy lại đều đạt; bổ sung thêm 1 test chờ khóa biên tập hơn 5 giây cũng đạt (J02/J03 hiện 10 test). TypeScript và build web/admin/API đạt; Vite vẫn cảnh báo bundle web lớn.
- UI database riêng: F5 giữ 3/10 đáp án; 7/10 chưa đạt; thi lại 8/10 đạt và mở Katakana; lịch sử giữ cả hai lượt; admin đổi 80→75, preview đúng 516 câu, xuất bản và chặn màn thi cũ. Desktop và 390px không tràn ngang.
- 31 bài có manifest audio khớp 156 câu; MP3 có thời lượng đo thật và 31/31 kiểm tra HTTP Range đạt. Đã tạo bằng Edge TTS 7.3.1; bản 7.2.8 gặp lỗi handshake và đã được nâng cấp theo bản sửa của nhà phát triển. Chưa nghe rà soát toàn bộ phát âm bởi người bản ngữ.
- Migration và import đã áp dụng database chính; chạy lại import cùng hash không tạo bản sao. So hash tất cả bản ghi trước/sau ở 40 bảng hiện có: không sửa/xóa bản ghi cũ. Giáo trình Tango của người dùng, quyền admin thật, sao/lịch ôn/XP/tiến độ và `n5-v1` giữ nguyên.
- QA dùng `nihongo_j02_ui_test`, đã đăng xuất/thu hồi role QA; 0 thẻ ôn và 0 XP. API 3001 đã trở về database chính. Ảnh và báo cáo tại `.artifacts/j02/` (không đưa vào Git).

## Mốc J01 — lịch sử 25/10/2026

Người dùng chốt ngày 24/10/2026: làm kho admin N5–N1 trước, tự xếp buổi sau. Không chuyển danh sách buổi giả lập thành giáo án đã duyệt, không nhập nội dung mẫu vào database chính.

J01 quản lý và công khai **cấp độ → buổi → liên kết nội dung học**. J02 sẽ lưu tiến độ cá nhân; J03 sẽ bổ sung đề kiểm tra và điều kiện mở khóa. J01 cho mở nội dung đã liên kết, chưa ghi hoàn thành buổi chỉ vì người học bấm mở. Các khung tiến độ giữ bố cục, dùng trạng thái chưa có dữ liệu; chưa áp dụng ngưỡng 80%.

## Cách sử dụng

1. Chạy database/API/trang học/admin bằng các lệnh hiện có trong README. Mở `http://localhost:3002/admin/jlpt`, đăng nhập tài khoản admin.
2. Tạo lộ trình cho một cấp N5–N1, nhập tên/mô tả và chọn nguồn giáo án thực tế. Mỗi cấp có một lộ trình; lộ trình đã lưu trữ được khôi phục và sửa thay vì tạo trùng cấp.
3. Thêm buổi, nhập tiêu đề, mô tả và thời lượng dự kiến. Đổi thứ tự buổi bằng các nút di chuyển.
4. Trong từng buổi, chọn nội dung từ kho đã xuất bản: Kanji, bài từ vựng, mẫu ngữ pháp, bài đọc thư viện, video Shadowing thư viện hoặc bảng Hiragana/Katakana. Có tìm kiếm, lọc cấp độ và phân trang. Không cần chép nội dung hoặc nhập UUID bằng tay.
5. Lưu bản nháp, xem trước các liên kết và kiểm tra thông báo. Mỗi buổi phải có nội dung hợp lệ trước khi xuất bản. Nguồn giáo án phải được khai báo; nguồn của từng kiến thức vẫn được quản lý tại kho gốc.
6. Xác nhận xuất bản. Trang học `http://localhost:3000/tron-doi/jlpt` lấy đúng dữ liệu của từng cấp. Chọn cấp, mở buổi, bấm nội dung muốn học. Có thể giữ cấp trong URL, ví dụ `?level=N5`.
7. Sửa nháp không đổi bản đang học. Xuất bản lại mới cập nhật cấu trúc buổi. Lưu trữ ẩn lộ trình khỏi trang học; khôi phục trở về nháp để rà soát rồi xuất bản lại.

Nếu nội dung chưa xuất hiện trong bộ chọn, kiểm tra trạng thái xuất bản ở kho tương ứng. Bài cá nhân không được dùng làm nội dung công khai của lộ trình. Có thể dùng nội dung cấp khác khi giáo án cần ôn lại; bộ lọc cấp độ hỗ trợ tìm kiếm, không tự gán lại cấp của kiến thức.

## Dữ liệu và quan hệ

J01 dùng ba bảng mới, không nhân bản kho kiến thức:

| Bảng | Vai trò |
|---|---|
| `jlpt_roadmaps` | Một cấp độ duy nhất; metadata nháp/xuất bản, phiên bản biên tập, trạng thái lưu trữ và khóa ngoại nguồn. |
| `jlpt_sessions` | UUID buổi ổn định, khóa ngoại tới lộ trình; metadata/thứ tự nháp và xuất bản tách riêng. |
| `jlpt_resources` | UUID mục trong buổi, khóa ngoại tới buổi và đúng một nội dung gốc; thứ tự nháp/xuất bản tách riêng. |

Các khóa ngoại nội dung trỏ đến `kanji_content`, `curriculum_lessons`, `grammar_patterns`, `reading_articles`, `shadowing_videos`. Bảng chữ dùng mã `hiragana`/`katakana` thuộc catalog ứng dụng hiện có. Ràng buộc database kiểm tra loại nội dung tương ứng với khóa ngoại; không chỉ lưu một cặp `type/id` không được database kiểm chứng.

Một mục không được đổi sang nội dung khác nhưng giữ nguyên UUID. Muốn thay nội dung, bỏ mục cũ và thêm mục mới. Bỏ buổi/mục khỏi bản nháp hoặc bản xuất bản không xóa identity. Cách này dành chỗ cho J02 liên kết tiến độ đúng buổi và đúng mục sau này. Chưa tạo bảng tiến độ JLPT giả hoặc một hệ SRS mới.

Nội dung được đọc từ bản xuất bản của kho gốc. Admin sửa và xuất bản kiến thức thì liên kết dùng nội dung mới; sửa nháp của kiến thức chưa ảnh hưởng người học. Nếu nội dung bị lưu trữ hoặc bỏ khỏi giáo trình, mục trong lộ trình báo không còn khả dụng và không mở liên kết. Không lấy bản nháp hoặc dữ liệu riêng tư để thay thế.

`content_sources` được dùng lại cho nguồn giáo án. Metadata nguồn bất biến; không tự gán nguồn giáo án là nguồn của toàn bộ kiến thức được tham chiếu. Lộ trình Kanji `catalog_definitions`/`n5-v1` và tiến độ Kanji cũ giữ nguyên.

## API và bảo vệ

- Public: `GET /api/jlpt/roadmaps`, `GET /api/jlpt/roadmaps/:level` chỉ trả lộ trình đã xuất bản, chưa lưu trữ. Không có fallback sang N5 khi cấp khác chưa có dữ liệu.
- Admin: `/api/admin/jlpt/roadmaps` và các thao tác xem trước/lưu/xuất bản/lưu trữ/khôi phục; `/api/admin/jlpt/resources` tìm nội dung đã xuất bản.
- Dùng quyền admin hiện hành, phiên đăng nhập và Origin hiện có. Thao tác ghi gửi `expectedUserId` và phiên bản; bản mở cũ không được ghi đè thay đổi từ phiên khác.
- Xuất bản chạy trong transaction, kiểm tra nguồn và các liên kết. Phía public kiểm tra lại khả dụng của nội dung gốc mỗi lần đọc.
- Không tự thêm ⭐, XP hoặc sửa tiến độ học. Khi người học thực hiện hoạt động trong trang nội dung gốc, quy tắc học/XP hiện có của trang đó vẫn áp dụng.

## Nghiệm thu

Hoàn thành local ngày 25/10/2026, sau triển khai và kiểm tra trên database riêng. Không dùng dữ liệu QA làm giáo án thật.

- **116/116 API test** của 7 suite đạt: J01 (10), content (19), curriculum (27), grammar (13), default-roadmaps (10), reading (23), shadowing (14). J01 kiểm tra cả sáu loại liên kết, public/private/draft, quyền admin hiện hành/Origin/tài khoản, phiên bản và ghi đồng thời, ID bất biến, retry, lưu trữ/khôi phục, CHECK/FK PostgreSQL, không phát sinh XP/SRS. Không gọi nhà cung cấp AI/audio thật trong lượt này.
- **180/180 test frontend/shared/admin** đạt; build web/admin/API và kiểm tra ranh giới import đạt. Web còn cảnh báo kích thước bundle Vite, không có lỗi build.
- Trình duyệt: tạo N5 → thêm hai buổi → chọn Kanji và Katakana từ kho → đổi thứ tự → lưu → xem trước → xuất bản → F5. Trang học mở đúng `/kanji/k-1` và bảng Katakana; nháp sửa tên không đổi tên đang xuất bản. Hai tab cùng sửa: phiên cũ nhận xung đột và giữ nội dung đang nhập, tải bản mới có xác nhận. Lỗi mất API: giữ nháp, báo lỗi thật, lưu/thử tải lại thành công sau phục hồi. Lưu trữ ẩn khỏi public; khôi phục chỉ trở về nháp và giữ buổi/liên kết.
- Đã đối chiếu desktop và chiều rộng **390px** ở admin/trang học; không tràn ngang. Ảnh QA local ở `.artifacts/j01/admin-desktop.png`, `learner-desktop.png`, `admin-mobile.png`, `learner-mobile.png` (thư mục bỏ qua Git).
- Hai migration `202610240001_jlpt_catalog` và `202610240002_jlpt_target_check` đã áp dụng trên database chính và test. Đối chiếu số bản ghi 13 bảng hiện có trước/sau không thay đổi; `n5-v1` vẫn 28 chữ, 10 chữ/ngày. Database chính có **0 lộ trình JLPT mới**, chờ admin tự xếp nội dung; không nhập giáo án thử hoặc reset dữ liệu.
- QA dùng database `nihongo_j01_ui_test` riêng; đã đăng xuất/thu hồi quyền tài khoản QA và xác nhận 0 thẻ ôn, 0 XP. API cổng 3001 đã chuyển lại cấu hình/database chính; tài khoản admin thật giữ nguyên.

Phần J02/J03 từng để lại tại mốc J01 đã được xử lý theo quyết định và nghiệm thu mới ở đầu tài liệu.
