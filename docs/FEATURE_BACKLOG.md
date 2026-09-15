# Kế hoạch hoàn thiện chức năng NIHONGO

Rà soát ngày 09/09/2026, từ source tại commit `ce063cc`. Đây là danh sách công việc để lựa chọn và triển khai từng task, không phải yêu cầu triển khai tất cả ngay. Lượt rà soát này đọc source, API, schema và tài liệu; không chạy lại toàn bộ nghiệm thu runtime.

## Quyết định đã chốt với người dùng

- Ưu tiên **dữ liệu học cá nhân: bài học → tiến độ → lộ trình**.
- Chưa có bộ nội dung hoàn chỉnh; **chốt nguồn riêng trước mỗi nhóm nội dung**.
- Giữ React/Vite/React Router và Express/TypeScript/Prisma/PostgreSQL; mốc hiện tại là local.
- Giữ giao diện, nhãn, thông tin và bố cục đã có. Hoàn thiện hành vi phía sau; phần UI cần bổ sung phải phục vụ trực tiếp task. Không tự thiết kế lại trang.
- Chỉ bấm ⭐ mới đưa nội dung vào đúng mục Ôn tập. Bỏ sao giữ lịch và lịch sử; gắn lại tiếp tục lịch cũ. Đã thuộc hoặc hoàn thành bài không tự gắn sao.
- Không tự nhập dữ liệu localStorage dùng chung thiết bị vào tài khoản. Không xóa dữ liệu học hoặc dùng database reset để triển khai.
- Nội dung cố định, vẽ canvas, trộn thẻ, chấm bài theo đáp án và phát âm bằng trình duyệt có thể chạy thật ở FE. Chỉ thêm backend khi cần lưu theo tài khoản, quản lý nội dung, quyền truy cập hoặc dịch vụ bên ngoài.

## Cách chọn task trong những lần làm việc sau

1. Đọc tài liệu này và `git status`; đối chiếu lại source liên quan vì code có thể đã thay đổi.
2. Bỏ qua task đã hoàn thành. Trong nhóm ưu tiên, chọn task nhỏ đầu tiên có đủ phụ thuộc; nêu ID, kết quả người dùng nhận được, phạm vi và điều còn cần chốt.
3. Nếu một task đang chờ dữ liệu/nhà cung cấp/quy tắc nghiệp vụ, đề xuất task độc lập có thể làm; không tự giả định câu trả lời và không chặn cả dự án.
4. Khi người dùng chỉ hỏi “đề xuất task”, đưa **một task chính**, tối đa hai lựa chọn khác. Chỉ triển khai sau khi người dùng yêu cầu làm.
5. Khi được yêu cầu “làm task X”: kiểm tra quyết định cần thiết → triển khai đúng phạm vi → kiểm thử → cập nhật trạng thái, file thay đổi, kết quả và phần còn lại vào tài liệu này.
6. Không đánh dấu hoàn thành chỉ vì đã có UI hoặc API. Task nối dữ liệu cần đi hết FE → API → DB → tải lại/đổi phiên. Task nội dung cần dữ liệu đúng và có nguồn.

Trạng thái: **Sẵn sàng** = đã đủ định hướng để lên chi tiết; **Cần chốt** = có câu hỏi nghiệp vụ ghi rõ; **Phụ thuộc** = làm sau task khác; **Xong** = có bằng chứng nghiệm thu. “Sẵn sàng” chưa có nghĩa người dùng đã yêu cầu triển khai.

## Nền tảng đã có — không lập lại thành việc chưa làm

| Nhóm | Hiện trạng kiểm chứng trong source | Tài liệu |
|---|---|---|
| Tài khoản và phiên | Email/mật khẩu, Google, me/logout, session PostgreSQL, Origin/validation, tách tài khoản | [BACKEND_AUTH_PLAN.md](BACKEND_AUTH_PLAN.md) |
| Tiến độ Hán tự | `kanji_progress`, GET/POST tiến độ; flashcard Đã thuộc/Chưa thuộc chờ server xác nhận | [KANJI_PROGRESS_PLAN.md](KANJI_PROGRESS_PLAN.md) |
| Ôn tập | `review_cards`, `review_events`; sao, lịch, đánh giá, reset, thống kê và giao diện cũ đã nối API | [REVIEW.md](REVIEW.md) |
| Route | URL cho trang chính/chi tiết, tab Ôn tập theo query, trang không tồn tại | [ROUTES.md](ROUTES.md) |
| Chủ động P01 | Bài và mảng từ tự nhập lưu tài khoản; CRUD, version chống ghi đè; giao diện cũ | [VOCAB_LESSONS.md](VOCAB_LESSONS.md) |
| Chủ động P02 | Sửa từ đồng bộ thẻ sao, giữ lịch/lịch sử; xóa nguồn giữ thẻ; nút ⭐ trên thẻ Ôn tập đã được duyệt | [VOCAB_LESSONS.md](VOCAB_LESSONS.md) |
| Chủ động P03 | Nhập JSON/text có xem trước, kiểm tra từng dòng, bỏ trùng đủ 4 trường và lưu atomic | [VOCAB_IMPORT.md](VOCAB_IMPORT.md) |
| Chủ động P04 | Tiến độ Flashcard theo UUID/tài khoản; mở lại từ chưa đánh giá, reset bài có xác nhận, giữ trạng thái khi sửa từ | [VOCAB_PROGRESS.md](VOCAB_PROGRESS.md) |
| Chủ động P05 | Trắc nghiệm/Nhồi nhét chấm và lưu lượt hoàn thành theo tài khoản, giữ kết quả cũ, đổi chế độ có xác nhận | [VOCAB_RESULTS.md](VOCAB_RESULTS.md) |
| Lộ trình cá nhân P06 | Tạo/tải/sửa/xóa theo tài khoản, kiểm tra chữ hỗ trợ, giữ dữ liệu khách riêng, chống ghi đè giữa hai tab | [PERSONAL_ROADMAPS.md](PERSONAL_ROADMAPS.md) |
| Học lộ trình cá nhân P07 | Chia ngày thật, flashcard, đánh giá và hoàn thành theo tài khoản; F5 tiếp tục, học lại giữ hoàn thành, không tự sao | [ROADMAP_STUDY.md](ROADMAP_STUDY.md) |

Backend hiện mount `/api/auth`, `/api/progress`, `/api/review`, `/api/vocab/lessons`, `/api/vocab/progress`, `/api/vocab/results`, `/api/roadmaps`, cùng health. Schema có `users`, `sessions`, `kanji_progress`, `review_cards`, `review_events`, `vocab_lessons`, `vocab_progress`, `vocab_study_results`, `personal_roadmaps`. Chưa có bảng bài đọc, lượt học đang dở, XP hay thanh toán. Tài liệu auth/progress cũ mô tả phạm vi ở thời điểm hoàn thành; các câu về sao còn ở localStorage đã được thay thế bởi đợt Ôn tập.

## Bản đồ chức năng hiện tại

| Màn hình / khu vực | Phần đã hoạt động | Phần chưa hoàn thiện và bằng chứng source | Task |
|---|---|---|---|
| Hán tự | Tìm kiếm/lọc catalog, chi tiết, TTS, flashcard và sao/tiến độ thật | `HomePage.tsx`: vùng vẽ chỉ ghi canvas, không nhận diện; tải PDF chỉ alert. `kanjiData.ts`: catalog nhỏ có mẫu N4–N1. `KanjiDetailView.tsx`: xem nét chỉ hiện chữ lớn/số nét | C01, U01–U03 |
| Bảng chữ cái | Bảng kana, phát âm, sinh câu hỏi/chấm đáp án tại FE | `AlphabetPage.tsx`: điểm chỉ React state; tải PDF alert. Không coi sinh ngẫu nhiên câu hỏi là giả lập | P10, U01 |
| Giáo trình từ vựng | Chọn giáo trình, xem/lọc từ tiêu biểu, phát âm, ⭐ | `CurriculumPage.tsx`: `sampleVocabs`, chưa có luồng bài học đầy đủ tương ứng số lượng giới thiệu | C02 |
| Ngữ pháp | Xem dữ liệu cố định, một số chi tiết/bài tập mẫu; ⭐ gọi API | `BunpoPage.tsx:236`: câu lạ trả phân tích của câu mẫu; `GrammarDetailView.tsx:136`: `isSaved=true` độc lập với sao, bài tập cố định; catalog chi tiết và `grammarData.ts` tách rời, file data chưa được import vào màn này | C03, C04, A03 |
| Chủ động | P01–P05: bài/từ, import có preview, sao và tiến độ Flashcard theo tài khoản. Trắc nghiệm/Nhồi nhét lưu lượt hoàn thành, server chấm điểm, mở lại kết quả gần nhất; giữ bài khách riêng | AI Format thông báo chưa kết nối dịch vụ; chưa có giao diện duyệt toàn bộ lịch sử hoặc tiếp tục quiz/gõ đang dở (ngoài phạm vi P05 đã duyệt) | A02 |
| Lộ trình Kanji | P06–P07 đã nối CRUD, chọn ngày, flashcard, tiến độ và hoàn thành thật theo tài khoản; học lại giữ hoàn thành, khách riêng | Tab mặc định vẫn bắt đầu ngày 2, dùng danh sách 10 Kanji và tiến độ cố định; modal mặc định chỉ xem danh sách | P08 |
| Ôn tập | Đã lưu server, lịch và thống kê thật; P02 xử lý sửa/xóa từ Chủ động và cho bỏ sao trên thẻ đang ôn | Nguồn ngữ pháp và trạng thái ghi nhớ trên màn ngữ pháp còn cần rà soát; không viết lại SRS | C03 |
| Trọng âm | Tìm trong danh sách nhúng, vẽ cao độ, xem biến thể | `AccentPage.tsx`: dữ liệu và tên nguồn ghi cố định; `pitchAccentData.ts` chưa được màn import. TTS thường không chứng minh đúng biến thể trọng âm | C05 |
| Lộ trình JLPT | Chọn cấp độ/lưu cấp trên máy, xem sơ đồ | `JlptRoadmapPage.tsx:242`: dùng `getN5Sessions()` cho màn chi tiết; tiến độ 0%, nút học/kiểm tra alert; quy tắc ≥80% mới là nội dung UI | J01–J03 |
| Đọc hiểu | Đọc bài mẫu, TTS, chọn câu, chấm quiz mẫu; tạo/xóa bài trên thiết bị | `DocHieuPage.tsx:563`: bài tự tạo chưa có dịch/furigana thật, từ/ngữ pháp/quiz cố định; thời lượng ước lượng và timer không theo audio; bài lưu localStorage | R01–R02, A04–A05 |
| Shadowing | Ghép câu/gõ và chấm trên câu mẫu; TTS đọc câu | `ShadowingPage.tsx:477`: URL bất kỳ được gán câu mẫu, không trích transcript; không có player video thật, autoPause chưa điều khiển media; bookmark khởi tạo sẵn `[2]`, tiến độ chỉ state | S01–S03 |
| Trợ lý nổi | Gửi/hiển thị tin nhắn trong phiên | `MascotAssistant.tsx:17`: sau 600ms trả cùng một đoạn văn, không có AI | A01, A06 |
| Xếp hạng | UI hai tab | `LeaderboardPage.tsx`: cả top, XP và “tôi” hardcode; tab battle đổi nút chọn nhưng dùng cùng nội dung, không có trận đấu | X01–X03 |
| Cài đặt | Lưu localStorage; darkMode được App áp dụng | Font, furigana và tốc độ chỉ đổi giá trị settings; chưa nối đầy đủ vào nơi hiển thị/TTS (`speech.ts` mặc định 0.9) | P09, P11 |
| Thông báo | Có chuông trên header | `TopHeader.tsx`: nút chưa có handler/nội dung thông báo | O01 |
| Nâng cấp / Tạo file | Hiển thị gói; `isPremium` thật đọc từ user | `UpgradePage.tsx:60`: mua gói alert; chưa có order/payment hoặc kiểm tra quyền nội dung. Route Tạo file cũng đang render UpgradePage | O02–O03, U04 |

## Đợt ưu tiên: dữ liệu học cá nhân

Mỗi task dưới đây là một phần có thể nghiệm thu riêng. Chưa tạo sẵn tất cả bảng/API cho những phần chưa làm.

| ID · trạng thái | Phạm vi triển khai | Phụ thuộc / cần chốt | Hoàn thành khi |
|---|---|---|---|
| **P01 · Hoàn thành** | Bài học Chủ động theo tài khoản: tạo/danh sách/đổi tên/xóa, khóa tải/lưu, lỗi thật; `vocab_lessons` có UUID/owner/version. Lưu cả mảng từ JSONB để các nút nhập/sửa/xóa/học hiện có vẫn dùng được | Giữ dữ liệu khách/thiết bị riêng, không tự nhập. Chưa cần bảng từ riêng; đã làm phần lưu từ nền của P02. Chi tiết [VOCAB_LESSONS.md](VOCAB_LESSONS.md) | Đã kiểm thử F5/phiên khác, A/B, gửi lặp, lỗi lưu, version hai tab và giữ review history; giao diện cũ giữ nguyên |
| **P02 · Hoàn thành** | Sửa từ/cách đọc/nghĩa đồng bộ snapshot thẻ ôn trong transaction; xóa từ/bài giữ thẻ và history. Bảo vệ ID giữa bài, tài khoản và các thao tác từ tab cũ | Đã chốt 10/09: sửa cập nhật nội dung, xóa giữ thẻ; người dùng duyệt nút ⭐ cạnh phát âm trên thẻ Ôn tập. Không thêm bảng hoặc đổi UI khác | 17 test bài học gồm 8 case P02 mới; giữ lịch/event, rollback, đồng thời edit/star/rate, owner/ID; UI cập nhật đúng từ và cho bỏ sao khi nguồn mất |
| **P03 · Hoàn thành 12/09/2026** | JSON/text được kiểm tra, xem trước và báo dòng lỗi; chỉ thêm mới, bỏ trùng đủ bốn trường, lưu cả batch trong transaction | Đã duyệt hộp thoại preview; không chuyển bài khách vào tài khoản. Parser thường, chưa tích hợp AI. [Chi tiết](VOCAB_IMPORT.md) | 11 test parser + 11 test import API; rollback, retry, account/version/UUID và giới hạn; UI lỗi/duplicate/khác nghĩa/hai tab/F5 giữ dữ liệu |
| **P04 · Hoàn thành** | Flashcard Chủ động lưu Đã biết/Chưa biết theo UUID/tài khoản, số đếm không cộng trùng; chỉ chuyển khi lưu thành công. Thêm `vocab_progress` và version tiến độ riêng | Đã chốt cả 3 lựa chọn: mở từ đầu tiên chưa đánh giá/hiện kết quả nếu đủ; reset bài có xác nhận; sửa nội dung giữ trạng thái theo UUID. Không tự ⭐. [Chi tiết](VOCAB_PROGRESS.md) | FE/BE build; 90 API test và 21 FE test đạt. UI F5, mở lại kết quả, bấm đúp, đổi đánh giá, tab cũ sau reset và lỗi tải/retry đã kiểm tra; giới hạn công cụ với thao tác xác nhận/hủy native dialog ghi trong tài liệu |
| **P05 · Hoàn thành** | Một bảng lưu lượt quiz/gõ hoàn thành; server chấm điểm, chống lưu trùng, mở lại kết quả gần nhất. Sửa đáp án nhiễu, thiếu dữ liệu, bấm lặp/timer và thử lại | Đã duyệt: lượt hoàn thành; bỏ từ thiếu dữ liệu; đổi chế độ xác nhận và tạo lượt mới; điểm lần đầu, gợi ý vẫn tính đúng. Kanji hỏi cách đọc + nghĩa, chọn chữ. [Chi tiết](VOCAB_RESULTS.md) | 105 backend + 30 FE/shared test, build FE/BE; UI Cram/Quiz, F5, thử lại, bấm đúp, lỗi lưu/retry, Hủy/xác nhận đổi chế độ, không có từ hợp lệ. Giữ UI chính, không tự ⭐/XP |
| **P06 · Hoàn thành 15/09/2026** | Một bảng lưu lộ trình Kanji cá nhân theo tài khoản, CRUD/version, danh sách chữ giữ thứ tự và số ngày đúng | Đã duyệt chặn chữ ngoài catalog; sửa tên/mục tiêu qua nút bút chì cạnh xóa; khóa mục tiêu khi đã học; khách riêng; xác nhận xóa trong trang. [Chi tiết](PERSONAL_ROADMAPS.md) | 105 test hồi quy + 16 API P06 đạt; 5 test FE liên quan và FE/BE build đạt. UI tạo/sửa/F5/khách tách tài khoản/hai tab/lỗi kết nối/khóa mục tiêu/Hủy và xác nhận xóa đạt; QA đã dọn |
| **P07 · Hoàn thành 15/09/2026** | Học ngay mở ngày chưa hoàn thành, chọn ngày/danh sách đúng, flashcard mở chữ chưa đánh giá; lưu đánh giá, hoàn thành và % thật | Đã duyệt cả 3 lựa chọn: mọi chữ đánh giá true/false thì hoàn thành; học lại giữ hoàn thành; dùng lại khung chọn ngày/danh sách, số ngày/% và nút quay lại. [Chi tiết](ROADMAP_STUDY.md) | 132 backend + 39 FE/shared test và FE/BE build đạt; UI ngày cuối/F5/bấm đúp/học lại/tự phát/hai tab/lỗi mạng/khách riêng/sao đạt; không tự hoàn thành khi xem ngày |
| **P08 · Phụ thuộc** | Lộ trình mặc định: chia catalog thật theo level/ngày, thay danh sách lặp/0%/ngày 2; dùng luồng P07, giữ sơ đồ hiện tại | P07, C01 cho catalog được chọn; chốt thứ tự và số Kanji/ngày. Có thể làm N5 hiện có trước, không hứa đã đủ N5 nếu dữ liệu chưa đủ | Hai ngày khác nhau có nội dung đúng; thống kê đúng số chữ có; nhảy cấp không trả dữ liệu cấp khác; tiến độ riêng tài khoản |
| **P09 · Sẵn sàng, có thể xen kẽ** | Làm cài đặt font/furigana/tốc độ **thực sự có hiệu lực** trong các màn hỗ trợ; giữ cài đặt trên thiết bị trước; tốc độ riêng của màn học chỉ ghi đè khi người dùng chọn | Chốt phạm vi áp dụng nếu màn có setting riêng; giữ font bố cục hiện tại, chỉ đổi vùng chữ đúng cài đặt | Đổi setting → thấy/nghe tác dụng ngay; F5 giữ; nút Ẩn/hover có hiệu lực; thiết bị thiếu giọng Nhật báo đúng; không sửa bố cục |
| **P10 · Cần chốt, sau P05** | Lưu kết quả quiz bảng chữ cái; không đổi cơ chế chơi đã chạy thật | Chốt phiên dài bao nhiêu câu/điểm kết thúc vì hiện trò chơi chuyển câu liên tục. Dùng mẫu lưu kết quả P05 khi phù hợp | Lượt hoàn thành được lưu, không nhận điểm tự khai; luyện thử khách vẫn rõ phạm vi; F5 xem đúng dữ liệu tài khoản |
| **P11 · Cần chốt, ưu tiên thấp** | Đồng bộ cài đặt học theo tài khoản, nếu cần | Sau P09; hỏi có thực sự cần đồng bộ hay giữ theo thiết bị. Không tự đưa toàn bộ settings của thiết bị chung vào tài khoản mới | Quy tắc ưu tiên setting thiết bị/tài khoản rõ và kiểm thử được; đổi account không lẫn |

Thứ tự còn lại: **P08**. P01–P07 đã hoàn thành. P09 làm xen kẽ khi một task đang chờ quyết định. P10/P11 chỉ đề xuất khi phù hợp nhu cầu.

## Nội dung học: từng nhóm nhỏ, chốt nguồn trước

| ID · trạng thái | Phạm vi triển khai | Phụ thuộc / cần chốt | Hoàn thành khi |
|---|---|---|---|
| **C01 · Cần chốt** | Rà soát/chuẩn hóa catalog Kanji và bộ thủ, ID, level, âm đọc, nghĩa, nguồn; nối cùng catalog cho tra cứu/lộ trình. Bắt đầu một tập nhỏ được duyệt | Người dùng chưa có dữ liệu. Chốt nguồn và quyền sử dụng, phạm vi N5 trước. Chưa cần chuyển mọi nội dung sang DB hay xây CMS | Có manifest số lượng/thông tin nguồn, kiểm tra ID không trùng, backend accepted IDs khớp; thêm dữ liệu không mất progress/star; không lấy số 2500+ trên UI làm dữ liệu hiện có |
| **C02 · Cần chốt** | Một giáo trình → danh sách bài → từ của bài → học bằng component có sẵn/⭐; route chi tiết bài theo ID | Nguồn và một giáo trình/bài đầu được chốt; P04/P05 nếu cần lưu kết quả luyện. Không tự đưa toàn bộ sách bên ngoài vào DB | Từ thực tế khớp bài/số đếm; mở link/F5 đúng bài; tìm kiếm, đọc âm, ⭐ và học hoạt động; sau nghiệm thu mới mở rộng bài khác |
| **C03 · Cần chốt** | Thống nhất catalog ngữ pháp giữa danh sách, chi tiết, liên quan và Ôn tập; xử lý trạng thái `isSaved` giả bằng dữ liệu sao thật theo quy tắc đã chốt | Chốt bộ mẫu ngữ pháp đầu tiên. Giữ ID/source cũ hoặc migration có mapping để không mất lịch; xác nhận nút chữ “ghi nhớ” chỉ phản ánh sao, không là cơ chế tự thêm khác | Chọn mẫu nào mở đúng mẫu đó; link trước/sau/liên quan không im lặng; chưa sao không tự hiện đã lưu; F5 và hai account đúng |
| **C04 · Phụ thuộc** | Bài tập đúng từng mẫu ngữ pháp, chấm và lưu kết quả lượt làm | C03, đáp án có nguồn/duyệt; P05 làm cơ sở khi hợp. Không dùng câu hỏi S か cho mọi pattern | Đổi pattern đổi đề đúng; server không tin điểm tự khai; có sai/đúng/giải thích thật, không tự ⭐ |
| **C05 · Cần chốt** | Catalog trọng âm nhỏ có nguồn xác thực, cùng một nơi quản lý; tìm kiếm/biến thể đúng. Tách đọc TTS thông thường với audio minh họa đúng pitch nếu có | Chốt nguồn dữ liệu/âm thanh và quyền dùng; không giả lập đã tổng hợp sáu từ điển | Nguồn gắn từng mục có thể đối chiếu, dữ liệu chưa có báo trống; âm phát không được quảng bá là đúng pitch nếu chưa có bằng chứng |

## Đọc hiểu, AI và Shadowing

Các task có API AI/media đều **chưa sẵn sàng triển khai dịch vụ**. Trước khi bắt đầu phải hỏi nhà cung cấp/nguồn, ngân sách, dữ liệu gửi đi và giới hạn đầu vào. Khóa API chỉ ở server; kết quả lỗi không được thay bằng bài/câu mẫu. Không xây agent framework, vector database hoặc queue khi chưa có nhu cầu đo được.

| ID · trạng thái | Phạm vi triển khai | Phụ thuộc / cần chốt | Hoàn thành khi |
|---|---|---|---|
| **R01 · Cần chốt** | Lưu bài đọc của người dùng theo tài khoản; tạo/danh sách/xóa/xem bằng ID và route. Lưu văn bản gốc; tách rõ dữ liệu đã phân tích và chưa có | Chốt bài cũ trên thiết bị và có cho lưu bản gốc trước phân tích không. Không lưu các câu dịch/quiz giả làm kết quả thật | Tạo/xóa/F5/phiên khác đúng; bài chưa phân tích không chứa nội dung bịa; lỗi không mất bản nháp |
| **R02 · Sẵn sàng** | Sửa phát/dừng/lặp/chuyển câu/tốc độ Đọc hiểu; đồng bộ trạng thái theo sự kiện phát âm thực tế, cleanup khi đổi route | Chốt có giữ TTS trình duyệt trước hay cần audio dịch vụ; đề xuất giữ TTS cho mốc local | Không còn đọc sau đóng trang, lặp dừng được; không hiển thị timer ước lượng như thời lượng audio đã biết |
| **A01 · Cần chốt** | Tích hợp dịch vụ AI đầu tiên ở backend với schema phản hồi, giới hạn input, timeout, quota; chỉ làm cùng một tính năng A02/A03/A04/A06 được chọn | Nhà cung cấp/model/ngân sách và env local do người dùng chốt; không yêu cầu gửi secret trong chat | Một request thật đi hết UI→API; không lộ key; lỗi/timeout/quota có thông báo; giới hạn body riêng cho tác vụ dài, không nới chung vô hạn |
| **A02 · Phụ thuộc** | Nút AI định dạng Chủ động xử lý nội dung bất quy tắc, trả bản xem trước để sửa trước khi nhập | A01, P03; chốt AI chỉ chuẩn hóa hay thêm nghĩa/cách đọc | Dữ liệu đầu ra qua validation; không tự ghi bài khi chưa xác nhận preview; parser thường vẫn dùng được |
| **A03 · Phụ thuộc** | Phân tích câu ngữ pháp theo chính câu nhập: token, giải thích, cấu trúc; tách dữ liệu phân tích khỏi catalog đã biên tập | A01; chốt bộ đầu ra tối thiểu, ví dụ nghiệm thu và giới hạn độ dài | Hai câu khác nhau cho kết quả đúng câu; không fallback câu mẫu; kết quả có cấu trúc hợp lệ, lỗi có thể thử lại |
| **A04 · Phụ thuộc** | Đọc hiểu: tách đoạn/câu, furigana và dịch Việt thật; lưu kết quả gắn đúng bài | A01, R01; chốt bộ ví dụ để đối chiếu và định dạng ruby an toàn | Văn bản gốc còn nguyên, câu/dịch khớp, không render HTML không kiểm soát, lỗi không ghi một phần rồi báo hoàn thành |
| **A05 · Phụ thuộc** | Đọc hiểu: từ, ngữ pháp và câu hỏi theo đúng bài đã phân tích; chấm bài và lưu lượt làm | A04; chốt số câu/kiểu câu và có cần bước người dùng duyệt đề không | Không lặp danh sách 日本/社会/生活 cho mọi bài; mỗi câu có đáp án/giải thích đối chiếu bài; điểm chỉ lưu một lần, không tự ⭐ |
| **A06 · Phụ thuộc** | Trợ lý Kanji trả lời dựa trên câu hỏi và Kanji hiện tại thay đoạn trả lời cố định | A01, C01 nếu đưa catalog vào ngữ cảnh; hỏi có cần lưu lịch sử chat không, mặc định chưa cần | Câu hỏi khác được xử lý đúng; có trạng thái chờ/lỗi; không khẳng định kết quả AI là dữ liệu đã duyệt |
| **S01 · Cần chốt** | Player Shadowing thật với **một video/audio và transcript có mốc thời gian**; play/pause/seek/replay/tốc độ/tự dừng theo câu | Chốt một media được phép dùng và transcript chuẩn. Không gán TTS làm âm thanh của video | Nghe đúng media, chọn câu seek đúng mốc, hết câu tự dừng theo setting, rời route dừng phát |
| **S02 · Phụ thuộc** | Nhập video cá nhân và transcript: kiểm tra URL/ID, xử lý nguồn không có phụ đề, lưu thư viện theo tài khoản | S01; hỏi cung cấp phụ đề thủ công trước hay dịch vụ lấy/chuyển giọng thành chữ. Nếu dùng dịch vụ, chốt chi phí/nguồn trước | Video nhập không dùng lại transcript mẫu; nguồn lỗi báo đúng; F5 mở lại đúng video/câu |
| **S03 · Phụ thuộc** | Ghép câu/gõ chính tả trên transcript thật; lưu bookmark và kết quả riêng theo video/câu/tài khoản | S01, S02 nếu dùng video cá nhân; chốt bookmark có chỉ để đánh dấu câu hay nối nội dung từ/cấu trúc vào Ôn tập. Không tự suy diễn bookmark = ⭐ SRS | Không đánh dấu sẵn câu 2; token lặp/gợi ý/chấm sai hoạt động đúng; không lẫn bookmark giữa video có cùng sentence.id |

## Tiện ích, JLPT và phần tài khoản mở rộng

| ID · trạng thái | Phạm vi triển khai | Phụ thuộc / cần chốt | Hoàn thành khi |
|---|---|---|---|
| **U01 · Cần chốt, task ngắn** | Hai nút PDF Kanji/bảng chữ cái xuất file thật từ dữ liệu đang chọn | Chốt khổ giấy, ô chữ, số dòng, có nghĩa/nét mờ. Có thể in→PDF bằng trình duyệt trước, không cần dịch vụ backend | File mở/in được, đúng chữ/cấp/bảng đã chọn; không còn alert thay tải file |
| **U02 · Cần chốt** | Xem thứ tự nét và luyện theo nét cho tập Kanji nhỏ; giữ canvas và modal hiện tại | Nguồn stroke data, chữ hỗ trợ; chốt chỉ hướng dẫn nét hay chấm nét. Bắt đầu hướng dẫn, chấm nét là phần riêng nếu cần | Nét hiển thị đúng thứ tự theo dữ liệu; canvas chuột/cảm ứng không lệch tọa độ khi resize; không có dữ liệu thì báo đúng |
| **U03 · Cần chốt** | Vẽ Kanji để tra cứu: nhận diện và trả ứng viên để chọn mở chi tiết | Chốt giải pháp nhận diện/nguồn/chi phí; khác với chấm viết đúng nét | Vẽ xong có ứng viên từ input thật, chọn mở đúng ID; xóa nét/hủy request cũ không hiện kết quả cũ |
| **U04 · Cần chốt, chưa đủ mô tả UI** | Route Tạo file có chức năng tạo tài liệu thay vì chỉ mở Nâng cấp | Hỏi loại file, dữ liệu đầu vào, mẫu đầu ra, quan hệ U01 và quyền Premium. Không dựng một trình biên tập mới theo suy đoán | Có luồng tạo đúng file đã chốt; task được chia nhỏ thêm sau khi có mẫu |
| **J01 · Cần chốt** | Chốt một lộ trình JLPT/cấp đầu tiên, ánh xạ buổi học vào nội dung và thay số buổi/mẫu N5 dùng chung | C01/C02/C03/P10 tùy nội dung buổi; hỏi giữ ngưỡng ≥80%, điều kiện mở buổi và học lại. Chốt nguồn đề | Mỗi cấp chỉ mở buổi đã có dữ liệu đúng; chưa có không hiện bài N5 giả |
| **J02 · Phụ thuộc** | Bắt đầu/tiếp tục buổi JLPT thật, lưu tiến độ và cấp đang theo tài khoản | J01, nguồn bài học tương ứng | Bấm học không alert; F5 vào đúng buổi; tiến độ dựa hoàn thành thật, không do click mở buổi |
| **J03 · Phụ thuộc** | Bài kiểm tra cuối buổi, chấm server, mở buổi tiếp theo và thống kê thật | J02, đề/đáp án đã duyệt | Nộp lặp không mở khóa sai; test dưới/đúng/trên ngưỡng; bài khóa không vượt bằng URL/API; lịch sử học lại giữ theo quy tắc chốt |
| **X01 · Cần chốt, sau tiến độ** | Chốt nguồn và công thức XP rồi ghi XP từ hoạt động được server xác nhận | P05/P07 hoặc review_events; hỏi hoạt động nào tính, giới hạn lặp, ngày tính điểm. `kanji_progress` chỉ lưu trạng thái mới nhất, không đủ suy ngược toàn bộ lịch sử XP | Không nhận XP do FE tự khai; không cộng lặp do refresh/reset/ôn spam; không bịa XP lịch sử thiếu sự kiện |
| **X02 · Phụ thuộc** | Xếp hạng từ dữ liệu tài khoản thật; vị trí tôi, số thẻ/ngày học đúng nghĩa đã chốt | X01; chốt tổng/thời kỳ, đồng điểm và thông tin hồ sơ công khai | Không có user/XP mẫu; vị trí đúng cả khi ngoài top, có trạng thái trống; phân trang nếu cần |
| **X03 · Cần chốt, ưu tiên sau** | Xác định chức năng Đấu trí vì hiện chỉ có tab mẫu | Hỏi thi với máy, bất đồng bộ hay thời gian thực và luật chơi; chưa chọn WebSocket/ghép trận | Có plan riêng được duyệt trước triển khai. Không coi X02 là đã làm Đấu trí |
| **O01 · Cần chốt** | Chuông thông báo hoạt động với nội dung thật, đã đọc/chưa đọc nếu cần | Hỏi chỉ nhắc thẻ đến hạn trong app hay thông báo hệ thống. Có thể đọc lịch review hiện có; chưa tự thêm email/push/scheduler | Chuông mở dữ liệu đúng tài khoản, không có thông báo mẫu. Nếu cần nhắc ngoài app, tách task sau |
| **O02 · Cần chốt, trước bán gói** | Quyền Premium kiểm tra tại API trên những tài nguyên thực sự cần khóa | Chốt quyền từng gói/tính năng. Nội dung đang bundle vào FE không thể bảo vệ chỉ bằng ẩn nút; chuyển riêng tài nguyên cần khóa qua API nếu chọn bán | User thường không lấy tài nguyên khóa bằng API/direct URL; client không tự cấp Premium; giữ phần học miễn phí |
| **O03 · Phụ thuộc** | Thanh toán thật ở sandbox: order, trạng thái, webhook xác minh và cấp quyền | O02; chốt cổng thanh toán, gói/giá, cách hỗ trợ hoàn/hủy. Chưa chạy tiền thật trong mốc local | Webhook giả bị từ chối, webhook lặp không cấp hai lần, redirect thành công không tự coi đã trả tiền; trạng thái khôi phục sau F5 |
| **O04 · Cần chốt, trước public** | Xác minh email và quên mật khẩu; chia thành hai lượt triển khai nhỏ khi làm | Chốt dịch vụ email/domain và chính sách bắt buộc xác minh; không tự liên kết Google với email password | Token hạn dùng/một lần; chống lộ email, lỗi gửi có xử lý; reset mật khẩu xử lý phiên cũ đúng chính sách |
| **O05 · Cần chốt, mốc phát hành riêng** | Chạy online: host, domain, HTTPS/session, SPA fallback, migration, backup/restore | Người dùng chưa chọn hạ tầng. Lập plan deploy riêng sau tính năng ưu tiên | Mở trực tiếp route/F5 không 404, Google đúng origin, cookie đúng môi trường, dữ liệu giữ qua deploy, thử khôi phục backup |

## Thiết kế kỹ thuật vừa đủ khi làm từng task

- Mỗi miền mới thêm route Express cụ thể, Zod input, truy vấn Prisma và migration cần dùng. Dùng session/Origin/API error hiện có; kiểm tra owner mọi ID và phản hồi cũ khi đổi account.
- Hai bảng `review_cards`/`review_events` tiếp tục là nguồn lịch Ôn tập; không tạo một SRS thứ hai cho bài học hoặc lộ trình. Tiến độ hoàn thành và ⭐ là hai dữ liệu khác nhau.
- Những bảng dự kiến như lessons/words/progress/results chỉ là hướng triển khai; tên/cột cuối cùng xác định ở task tương ứng. Không tạo sẵn một mô hình activity/engine tổng quát cho mọi màn.
- Input nhập từ/bài đọc cần giới hạn cụ thể; body API mặc định 16 KiB, riêng bài học P01 là 512 KiB/500 từ mỗi bài. Kiểm thử batch; không tăng vô hạn hoặc bỏ validation.
- Nội dung công khai nhỏ có thể giữ trong file dữ liệu. Có catalog ID ổn định, kiểm thử tính đầy đủ/khớp nhau và nguồn dữ liệu quan trọng hơn việc chuyển mọi mảng mẫu vào DB.
- Không thêm Redis, microservice, hàng đợi offline, CMS hoặc triển khai AI tự động hàng loạt để hoàn thành các task CRUD ở trên.

## Nghiệm thu chung và cập nhật tiến độ

Mọi task giữ giao diện cần đối chiếu màn trước/sau, đủ nhãn/nút/thông tin. Task dữ liệu cá nhân kiểm tra tạo/sửa/xóa, F5, phiên khác, A/B không lẫn, phiên hết hạn, lỗi mạng, bấm lặp và tab cũ. Task có phụ thuộc sao kiểm tra bỏ/gắn lại và lịch sử còn nguyên. Task chỉ FE không bắt buộc thêm DB test không liên quan.

Chạy build frontend cho thay đổi FE; build backend và API tests liên quan khi thay server; giữ test auth/progress/review khi có tác động nền dùng chung. AI/media cần thử request/player thật ở môi trường được chốt; mock test riêng không đủ để báo đã tích hợp xong.

Sau mỗi task, thêm một dòng:

| Ngày | ID | Trạng thái | File/commit | Kiểm thử đã chạy | Quyết định / việc còn lại |
|---|---|---|---|---|---|
| 09/09/2026 | Rà soát | Xong | Tài liệu này | Đọc source, route, hook, schema/API và các plan hiện có; chưa chạy lại runtime | Người dùng chọn ưu tiên cá nhân; nguồn nội dung chốt từng nhóm. Chưa triển khai task mới |
| 09/09/2026 | P01 | Hoàn thành | `lessons.routes.ts`, `useVocabLessons.ts`, `ChuDongPage.tsx`, migration `202609090001_vocab_lessons`; [nghiệm thu](VOCAB_LESSONS.md) | FE/BE build; 9 test bài học + 45 test backend cũ, 4 test FE; tạo/nhập/đổi tên/F5/lỗi mạng/ba chế độ/xóa bài/guest và đăng nhập lại trên trình duyệt | Giữ UI, guest riêng; JSONB lưu trọn bài và từ. P02 chỉ còn phần chưa chốt, P03/P04/P05/A02 chưa hoàn thành |
| 10/09/2026 | P02 | Hoàn thành | `vocab-review.ts`, API lessons/review, `ReviewPage.tsx`; [nghiệm thu](VOCAB_LESSONS.md) | 62 test backend, 4 test FE, build FE/BE; UI sửa từ → ôn nội dung mới → xóa bài giữ thẻ/lịch sử → bỏ sao tại thẻ Ôn tập | Sửa nguồn đồng bộ nội dung và giữ lịch; xóa giữ thẻ. Chỉ thêm nút ⭐ đúng vị trí người dùng duyệt; không thêm bảng/migration |
| 12/09/2026 | P03 | Hoàn thành | `vocab-import.ts`, `ImportPreviewDialog.tsx`, hook/page Chủ động, API `/vocab/lessons/import`; [nghiệm thu](VOCAB_IMPORT.md) | 73 test backend + 15 test FE đạt ngày 10/09; FE/BE build đạt, build FE cuối ngày 12/09 đạt. UI JSON/text, dòng lỗi, duplicate/khác nghĩa, hai tab, tải lại preview, restart giữ 6 từ, khôi phục bản nhập khi bài bị xóa | Chỉ thêm mới, dedup đủ 4 trường sau trim; hộp thoại được duyệt; giữ 119 className và phần JSX cũ. Guest riêng; AI Format báo chưa kết nối. Không thêm bảng/migration |
| 13/09/2026 | P04 | Hoàn thành | `vocab-progress.routes.ts`, `useVocabProgress.ts`, `FlashcardStudy.tsx`, migration `202609120001_vocab_progress`; [nghiệm thu](VOCAB_PROGRESS.md) | 90 backend + 21 FE test; FE/BE build; UI lưu/F5/phiên khác/bấm đúp/đổi đánh giá/tab cũ sau reset/lỗi tải đầu và retry; giữ 74 className và nhãn cũ | Theo cả 3 lựa chọn đã duyệt; reset riêng bài, UUID giữ trạng thái, không tự ⭐. API reset đầy đủ đã đạt; click xác nhận/hủy UI chưa tự động nghiệm thu do công cụ bị timeout ở native confirm |
| 14/09/2026 | P05 | Hoàn thành | `vocab-results.routes.ts`, `useVocabStudy.ts`, Quiz/Cram/StudyModeDialog, `shared/vocab-study.mjs`, migration `202609140001_vocab_study_results`; [nghiệm thu](VOCAB_RESULTS.md) | 105 backend + 30 FE/shared test; FE/BE build; UI chấm/F5/học lại/lỗi lưu và retry/bấm đúp/đổi chế độ Hủy và xác nhận/empty mode, đối chiếu kết quả DB | Theo 3 lựa chọn và câu hỏi Kanji đã duyệt. Giữ UI học/kết quả; thêm hộp xác nhận và thông báo cần thiết. Không lưu bài đang dở, không tự sao/XP, chưa thêm UI lịch sử |
| 15/09/2026 | P06 | Hoàn thành | `roadmaps.routes.ts`, `usePersonalRoadmaps.ts`, `PersonalRoadmapPage.tsx`, `RoadmapDeleteDialog.tsx`, migration `202609140002_personal_roadmaps`; [nghiệm thu](PERSONAL_ROADMAPS.md) | 105 test backend cũ + 16 API P06 đạt; 3 shared + 2 routes đạt; FE/BE build; UI tạo/sửa/F5/hai tab/khách riêng/mất kết nối và retry/khóa mục tiêu/Hủy và xác nhận xóa | Giữ đủ 154 className tĩnh cũ; nút sửa và hộp xác nhận xóa được duyệt trước. QA đã dọn. P07 nối học/tiến độ; P08 nối dữ liệu tab mặc định |
| 15/09/2026 | P07 | Hoàn thành | `PersonalRoadmapStudy.tsx`, flashcard/hook/page, API `/roadmaps/start` và `/rate`, shared helper, migration `202609150001_roadmap_progress`; [nghiệm thu](ROADMAP_STUDY.md) | 132 backend + 39 FE/shared, FE/BE build; UI 5+1 chữ, false/F5/tiếp tục/100%/học lại/bấm đúp/tự phát/hai tab 409/lỗi mạng và retry/sao/khách tách tài khoản; DB đối chiếu | Đúng 3 lựa chọn đã duyệt. Giữ JSX tab mặc định, dùng khung/flashcard cũ. Dữ liệu QA đã dọn; migration cộng thêm, không tự sao/nhập khách |

**Task đề xuất tiếp theo: P08 — nối dữ liệu thật cho Lộ trình mặc định.** P06–P07 đã hoàn thành. Cần chốt phạm vi catalog, thứ tự chữ và số chữ/ngày trước triển khai; catalog hiện nhỏ, không tự coi số chữ mẫu trên giao diện là nội dung đã có. P09 có thể làm xen kẽ nếu chưa chốt nguồn P08.
