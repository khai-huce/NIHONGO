# Rà soát mock và các task còn lại — 24/10/2026

> Cập nhật 27/10/2026: **P12/P13 đã hoàn thành** theo phạm vi người dùng chốt: Flashcard chỉ lật/nghe/chuyển, không lưu tiến độ; luyện viết tự do theo mẫu, chưa chấm/thứ tự nét. Hai nút không còn handler rỗng. Xem [KANA_PRACTICE.md](KANA_PRACTICE.md); U01 tải PDF vẫn riêng. Các bằng chứng bên dưới giữ theo thời điểm audit.

> Cập nhật sau audit, 26/10/2026: **J01/J02/J03 đã hoàn thành** theo quy tắc người dùng duyệt: kho liên kết, tiến độ tài khoản, kiểm tra chấm server, ngưỡng điều chỉnh và mở tuần tự. NIHONGO N5 40 buổi đã nhập/xuất bản thật. Các dòng và số dòng bên dưới là bằng chứng tại thời điểm audit, không phải trạng thái hiện tại; xem [JLPT_ROADMAP.md](JLPT_ROADMAP.md) và [backlog](FEATURE_BACKLOG.md).

## Phạm vi và mức độ xác nhận

Đối chiếu mã nguồn frontend, admin, API, Prisma và `FEATURE_BACKLOG.md` trên commit `7859fbc`. Kiểm tra route thực sự sử dụng component, handler của nút, nơi đọc/ghi dữ liệu và các luồng API tương ứng; không chỉ tìm từ khóa `mock`. Đây là báo cáo để người dùng chọn task, **không phải phê duyệt triển khai toàn bộ**. Không sửa giao diện, logic ứng dụng hay dữ liệu trong lượt rà soát này.

Database local trả `ECONNREFUSED` khi thử truy vấn thống kê chỉ đọc. Vì vậy không xác nhận số giáo trình/bài đã nhập hoặc xuất bản tính đến hôm nay; con số nội dung trong các tài liệu cũ chỉ là bằng chứng tại ngày nghiệm thu. Không khởi động/reset DB, không đọc dữ liệu tài khoản cá nhân, không gọi Gemini/TTS/YouTube và không chạy lại bộ kiểm thử runtime.

Quy ước:

- **Mock/nút chưa nối:** trả nội dung cố định, chỉ alert, handler rỗng hoặc route dẫn sai chức năng.
- **Chưa hoàn chỉnh:** một phần chạy thật nhưng chưa có lưu theo tài khoản, công cụ biên tập hoặc nội dung đúng phạm vi giới thiệu.
- **Thiếu dữ liệu/nghiệm thu:** đã có DB/API và không được gọi lại là mock chỉ vì thư viện trống hay còn bước QA.
- Các ID mới bên dưới là đề xuất; giữ ID đã có trong backlog. Mỗi task chỉ triển khai sau khi người dùng chọn và chốt phần còn thiếu.

## 1. Các phần mock hoặc nút chưa có chức năng

| Task | Hiện trạng trong mã nguồn | Phạm vi hoàn thiện và nghiệm thu | Cần chốt/phụ thuộc |
|---|---|---|---|
| **J01 — Kho lộ trình JLPT thật** | Màn chi tiết các cấp đều gọi `getN5Sessions()`; số buổi/danh sách/trạng thái khai báo tĩnh. [JlptRoadmapPage:113](../apps/web/src/features/roadmaps/pages/JlptRoadmapPage.tsx#L113), [242](../apps/web/src/features/roadmaps/pages/JlptRoadmapPage.tsx#L242). Khác lộ trình Kanji P06–P08 đã thật. | Admin định nghĩa cấp → buổi → nội dung được liên kết; DB/API trả đúng cấp và chỉ công khai dữ liệu đã duyệt. Không lấy buổi N5 cho N4–N1. | Chọn cấp đầu tiên, nguồn giáo án và cách liên kết Kanji/từ/ngữ pháp/bài đọc. |
| **J02 — Học và tiến độ JLPT** | Vào học/tiếp tục chỉ alert; tiến độ, streak và thời lượng có số cố định. [315](../apps/web/src/features/roadmaps/pages/JlptRoadmapPage.tsx#L315), [345](../apps/web/src/features/roadmaps/pages/JlptRoadmapPage.tsx#L345), [489](../apps/web/src/features/roadmaps/pages/JlptRoadmapPage.tsx#L489). | Mở đúng bài của buổi; lưu đánh giá/hoàn thành/vị trí theo tài khoản, F5 tiếp tục; thống kê tính từ hoạt động thật. | Sau J01; chốt điều kiện hoàn thành buổi và học lại. |
| **J03 — Kiểm tra và mở khóa buổi JLPT** | Nút kiểm tra chỉ alert; ngưỡng ≥80% mới là mô tả UI. [267](../apps/web/src/features/roadmaps/pages/JlptRoadmapPage.tsx#L267), [328](../apps/web/src/features/roadmaps/pages/JlptRoadmapPage.tsx#L328), [503](../apps/web/src/features/roadmaps/pages/JlptRoadmapPage.tsx#L503). | Đề/đáp án có phiên bản, server chấm, lưu lần thi và mở khóa đúng điều kiện; không vượt khóa bằng URL hoặc gửi lặp. | Sau J01/J02; chốt đề, ngưỡng điểm, thi lại và điểm dùng để mở khóa. |
| **A06 — Trợ lý hỗ trợ sử dụng web và học tập** | Sau 600 ms trả cùng đoạn văn dù người dùng hỏi gì; nhãn online cố định; chưa có API assistant. [MascotAssistant:17](../apps/web/src/features/assistant/components/MascotAssistant.tsx#L17). | Dùng nền Gemini hiện có; đưa ngữ cảnh trang và nội dung được phép đọc; trả lời theo câu hỏi, dẫn tới chức năng thật, có lỗi/hạn mức. Bước đầu chỉ đọc và hướng dẫn, không tự sửa bài/sao/quyền. | Chốt hỗ trợ toàn web hay riêng Kanji, có lưu chat không, phạm vi dữ liệu tài khoản được đọc. Model của chức năng mới phải chốt; không mặc định lấy override Shadowing. |
| **A02 — AI Format cho Chủ động** | Nút chỉ báo chưa kết nối dịch vụ. [ChuDongPage:182](../apps/web/src/features/vocabulary/pages/ChuDongPage.tsx#L182). | Chuyển văn bản bất quy tắc thành từ/cách đọc/Hán Việt/nghĩa, qua validation và preview P03; chỉ lưu sau xác nhận. | Chốt chỉ định dạng dữ liệu có sẵn hay cho AI bổ sung thông tin; dịch vụ/model/hạn mức. |
| **P12 — Flashcard bảng chữ cái** | Nút Flashcard có handler rỗng. [AlphabetPage:196](../apps/web/src/features/kana/pages/AlphabetPage.tsx#L196). Quiz 104 câu P10 vẫn là chức năng thật. | Mở bộ Hiragana/Katakana đang chọn, lật thẻ, phát âm và chuyển thẻ; nếu cần lưu tiến độ thì bổ sung API/DB riêng. | Chốt mặt trước/sau, học cả hai bảng và có lưu trạng thái theo tài khoản không. |
| **P13 — Luyện viết bảng chữ cái** | Nút Luyện viết có handler rỗng. [AlphabetPage:210](../apps/web/src/features/kana/pages/AlphabetPage.tsx#L210). | Mở kana được chọn vào canvas, chữ mẫu và công cụ vẽ/xóa; hướng dẫn/chấm nét chỉ làm nếu được duyệt và có dữ liệu. | Chốt luyện vẽ tự do hay có thứ tự/chấm nét. Không coi vẽ được là đã chấm đúng. |
| **U01 — Tải PDF luyện viết** | Nút PDF Kanji/kana chỉ hiện alert. [HomePage:341](../apps/web/src/features/kanji/pages/HomePage.tsx#L341), [AlphabetPage:224](../apps/web/src/features/kana/pages/AlphabetPage.tsx#L224). | Tạo và tải PDF thật từ danh sách đang chọn; font Nhật, khổ giấy, số dòng và ô luyện viết đúng mẫu được duyệt. | Chốt mẫu in, chữ mờ, nghĩa/cách đọc và số dòng. Không cần DB chỉ để xuất file; chỉ thêm nếu muốn lưu tài liệu theo tài khoản. |
| **U02 — Xem thứ tự nét Kanji** | Nút Xem nét vẽ mở chữ lớn/số nét/loa, chưa có đường nét hoặc hoạt ảnh. [KanjiDetailView:253](../apps/web/src/features/kanji/components/KanjiDetailView.tsx#L253). | Nhập dữ liệu nét có nguồn; phát từng nét/toàn chữ, đánh số nét, báo thiếu nếu chữ chưa có dữ liệu. | Chốt nguồn và giấy phép. Nhận diện/chấm viết là task khác. |
| **U03 — Tra Kanji bằng chữ viết tay** | Vùng vẽ chỉ vẽ/xóa, không nhận diện hoặc trả ứng viên. [HomePage:34](../apps/web/src/features/kanji/pages/HomePage.tsx#L34), [126](../apps/web/src/features/kanji/pages/HomePage.tsx#L126). | Vẽ → nhận diện → chọn ứng viên → mở đúng chữ trong kho; loại phản hồi cũ khi xóa/vẽ lại. | Chọn giải pháp nhận diện, chạy local hay dịch vụ, nguồn/chi phí nếu có. |
| **U04 — Trang Tạo file** | Route Tạo file đang render trang Nâng cấp. [App:129](../apps/web/src/app/App.tsx#L129). | Trang tạo/xem trước/tải loại tài liệu đã chốt; có thể tái sử dụng bộ xuất PDF U01. | Chốt loại file, nội dung, mẫu, lưu hay tải trực tiếp. Chưa tự xây trình soạn thảo tổng quát. |
| **O01 — Chuông thông báo** | Nút chuông không có handler/nội dung. [TopHeader:52](../apps/web/src/app/layout/TopHeader.tsx#L52). | Đợt đầu: thông báo trong web từ dữ liệu thật, mở Ôn tập/bài liên quan; lưu đã đọc nếu cần. | Chọn loại thông báo, quy tắc đã đọc. Email/push ngoài web tách riêng. |
| **O02 — Quyền gói Premium** | `isPremium` là trường thật nhưng chưa có cơ chế kiểm quyền tài nguyên/tính năng gói tại API. Trang gói đang hứa các quyền lợi chưa tương ứng. [User](../apps/api/prisma/schema.prisma#L10), [UpgradePage:18](../apps/web/src/features/subscription/pages/UpgradePage.tsx#L18). | Định nghĩa quyền từng gói và kiểm tra server; không cho FE tự cấp quyền. | Chốt gói, thời hạn và tính năng khóa. Không tự khóa các chức năng đã duyệt miễn phí. |
| **O03 — Mua gói/thanh toán** | Nút mua chỉ alert “giao diện clone”; giá ưu đãi tĩnh, chưa có order/webhook. [UpgradePage:35](../apps/web/src/features/subscription/pages/UpgradePage.tsx#L35), [60](../apps/web/src/features/subscription/pages/UpgradePage.tsx#L60). | Sau O02: đặt đơn, thanh toán sandbox, xác minh webhook, cấp quyền và xử lý gửi lặp/F5. | Chọn nhà cung cấp, giá/gói, chính sách hủy/hoàn. Chưa chạy tiền thật khi chỉ đang xây local. |

## 2. Chức năng chạy một phần hoặc thông tin hiển thị chưa đúng

| Task | Hiện trạng | Phạm vi có thể nghiệm thu riêng | Cần chốt/phụ thuộc |
|---|---|---|---|
| **M03a — Admin nhập phần bổ trợ Đọc hiểu** | API đã hỗ trợ ruby/từ/ngữ pháp nhưng UI admin chỉ nhập dịch từng câu. [ReadingEditor:122](../apps/admin/src/features/reading/ReadingEditor.tsx#L122), [reading-content:8](../apps/api/src/modules/reading/reading-content.ts#L8). | Nhập/sửa/preview ruby, từ vựng và mẫu ngữ pháp; gắn đúng văn bản/phiên bản, sửa nháp giữ public. | Duyệt các trường UI admin cần thêm; có thể làm trước AI. |
| **M03b — Admin nhập câu hỏi Đọc hiểu** | Có `quizList` trong schema nhưng chưa có form biên tập câu hỏi. | Nhập câu hỏi/lựa chọn/đáp án/giải thích, validation và preview trước publish. | Chốt kiểu câu hỏi, nguồn đề; có thể làm độc lập A04/A05. |
| **A04 — Tạo furigana và dịch bài đọc** | Tách câu và lưu bài đã thật; bài cá nhân mới chưa được tự thêm ruby/dịch. [reading-content:20](../apps/api/src/modules/reading/reading-content.ts#L20). | Phân tích đúng bài, xem trước rồi áp dụng, giữ văn bản gốc và xử lý khi bài đổi phiên bản. Không cần viết lại việc tách câu đã có. | Chốt cách sinh furigana/dịch, dịch vụ/model/hạn mức và bước duyệt. |
| **A05a — Từ/ngữ pháp theo bài đọc** | Các cột lấy dữ liệu biên tập hoặc báo thiếu, không phân tích tự động. [DocHieuPage:676](../apps/web/src/features/reading/pages/DocHieuPage.tsx#L676), [713](../apps/web/src/features/reading/pages/DocHieuPage.tsx#L713). | Đề xuất từ/mẫu theo đúng bài; đối chiếu catalog published, thiếu báo thiếu; xem trước để sửa rồi lưu. | Sau hoặc kết hợp A04; chốt AI được bổ sung tới đâu, không nhập tự động vào catalog chung. |
| **A05b — Tạo câu hỏi theo bài đọc** | Chưa có luồng sinh quiz từ nội dung bài. | Tạo câu hỏi/đáp án/giải thích có căn cứ trong bài, preview và duyệt trước khi dùng. | Sau A04; chốt số câu, dạng câu và mức độ. Có thể dùng đề nhập M03b trước khi triển khai AI. |
| **R03 — Kết quả và tiến độ Đọc hiểu theo tài khoản** | Quiz chấm thật ở FE nhưng đáp án chỉ trong `useState`, reset khi mở lại; chưa API/bảng kết quả. [DocHieuPage:93](../apps/web/src/features/reading/pages/DocHieuPage.tsx#L93), [591](../apps/web/src/features/reading/pages/DocHieuPage.tsx#L591), [625](../apps/web/src/features/reading/pages/DocHieuPage.tsx#L625). | Server chấm/lưu kết quả gắn phiên bản bài, F5 khôi phục, giữ lịch sử khi sửa nội dung. Có thể lưu vị trí đang đọc nếu chọn. | Cần đề từ M03b hoặc A05b; chốt lần đầu/học lại/hoàn thành và điểm XP nếu muốn, không tự thêm XP. |
| **U05 — Quy tắc Hán Việt → On có nội dung riêng** | Modal ghép Hán Việt/On vào một câu giải thích chung cho mọi chữ. [KanjiDetailView:332](../apps/web/src/features/kanji/components/KanjiDetailView.tsx#L332). | Nhập quy tắc/ngoại lệ/ví dụ có nguồn theo chữ hoặc nhóm; admin duyệt; thiếu thì báo chưa biên tập. | Chốt nguồn, không khẳng định có phép chuyển âm đúng cho mọi chữ. |
| **U06 — Hoàn thiện bảng chia thể** | Nhãn giới thiệu động từ/tính từ/bị động/sai khiến nhưng nội dung chỉ ba bảng te/nai/khả năng. [BunpoPage:89](../apps/web/src/features/grammar/pages/BunpoPage.tsx#L89), [121](../apps/web/src/features/grammar/pages/BunpoPage.tsx#L121). | Biên tập đầy đủ phạm vi đã giới thiệu và ngoại lệ; nếu muốn admin sửa thì đưa nội dung này vào kho quản trị. | Chốt chỉ bảng tham khảo hay thêm nhập từ để chia tự động. Bảng tĩnh đúng nội dung không phải mock. |
| **O06 — Sửa nhãn/số liệu giới thiệu cũ** | Badge 2500+ Kanji/10.000+ từ/214 bộ thủ là text cứng; AuthModal còn nói dữ liệu học khác chỉ ở trình duyệt; trợ lý và mua gói còn tên cũ/clone. [HomePage:177](../apps/web/src/features/kanji/pages/HomePage.tsx#L177), [AuthModal:95](../apps/web/src/features/auth/components/AuthModal.tsx#L95). | Lấy số từ kho published hoặc đổi thành mô tả đúng, thống nhất NIHONGO và phạm vi đồng bộ thực tế; đồng nhất yêu cầu mật khẩu FE/BE (đang 15/12 ký tự tối thiểu). | Người dùng duyệt copy/nhãn vì là thay đổi thông tin UI. Không công bố con số lịch sử như số liệu DB hiện tại. |
| **P14 — Bảo vệ thao tác Dùng demo** | Nút demo gọi `store.update(currentLesson,{words})`, thay toàn bộ từ bài đang chọn và lưu thật. [ChuDongPage:136](../apps/web/src/features/vocabulary/pages/ChuDongPage.tsx#L136). Đây là hành vi thật có rủi ro ghi đè, không phải lưu giả. | Đưa qua preview/xác nhận rõ số từ bị thay, hoặc chỉ tạo bài demo mới theo lựa chọn người dùng. | Chốt tạo bài riêng hay thêm mới/bỏ trùng; không tự thay quy tắc trong lượt audit. |
| **P11 — Đồng bộ cài đặt theo tài khoản** | Font/furigana/tốc độ đã có hiệu lực và lưu localStorage. [useLearningSettings:24](../apps/web/src/features/settings/hooks/useLearningSettings.tsx#L24). | API/DB settings riêng tài khoản, quy tắc khi thiết bị và tài khoản khác nhau, không tự nhập setting máy dùng chung. | Tùy nhu cầu; không phải sửa mock P09. |

## 3. Công cụ admin còn thiếu

Không có bằng chứng các nút lưu/publish/import của năm khu admin hiện tại giả lập. Những task sau là mở rộng công cụ quản trị, không viết lại Kanji/C02/C03/R01/Shadowing.

| Task | Hiện trạng và kết quả mong muốn | Bằng chứng/phụ thuộc |
|---|---|---|
| **M04 — Quản trị bộ thủ** | DB/API có sẵn; bổ sung danh sách, nhập/sửa, nguồn, preview, xuất bản/lưu trữ trên admin. | [admin.content.routes:60](../apps/api/src/modules/content/admin.content.routes.ts#L60); [AdminApp:114](../apps/admin/src/app/AdminApp.tsx#L114) chưa có màn bộ thủ. |
| **M05 — Quản trị dữ liệu trọng âm** | Catalog và script import thật; thêm màn xem nguồn/biến thể và preview đợt cập nhật dữ liệu. | [pitch-import:7](../apps/api/scripts/pitch-import.ts#L7). Chốt chỉ import nguồn đã duyệt hay có nhập tay; không tự đoán dạng chia. |
| **M07 — Quản lý phiên bản lộ trình Kanji mặc định** | Có `CatalogDefinition`, chưa editor quản trị; tạo phiên bản mới thay vì sửa `n5-v1`. | [schema:352](../apps/api/prisma/schema.prisma#L352). Chốt cùng D03; giữ tiến độ/lịch sử bản 28 chữ. Khác lộ trình JLPT tổng hợp J01. |
| **M06 — Quản trị tài khoản** *(tùy chọn vận hành)* | Hiện cấp role bằng CLI; nếu cần UI thì làm danh sách tài khoản, cấp/thu quyền theo chính sách và nhật ký. | [content-admin:6](../apps/api/scripts/content-admin.ts#L6). Chốt quyền admin, bảo vệ tài khoản quản trị cuối, tách quyền Premium. |

## 4. Nội dung học và nghiệm thu còn lại

Các task nội dung cần kiểm tra DB lại khi dịch vụ hoạt động, rồi chỉ nhập phần thiếu. Không dùng số lượng hay trạng thái chưa nhập tại mốc bàn giao cũ làm kết luận về hôm nay.

| Task | Phạm vi |
|---|---|
| **D01 — Rà soát và đưa bộ Từ vựng N5 vào sử dụng** | File nguồn mở 662 mục/31 bài đã có tại [README dữ liệu](data/tu-vung-n5/README.md); kiểm tra trùng/phiên bản DB, duyệt bản dịch Việt, nhập nháp rồi publish khi được duyệt. Không gắn tên Tango. |
| **D02 — Bổ sung nội dung ngữ pháp** | Dùng admin C03 nhập bộ mẫu/ví dụ/ba dạng bài tập được chọn; chốt nguồn trước, không sinh mẫu rồi coi là nội dung chuẩn. |
| **D03 — Mở rộng Kanji/bộ thủ/lộ trình** | Chốt nguồn và biên tập ví dụ/gợi nhớ/phần còn thiếu; tạo catalog/lộ trình mới cho bộ N5 rộng hơn hoặc N4–N1. Giữ ID và `n5-v1` bất biến. |
| **D04a — Thư viện bài đọc biên tập** | Nhập bài có quyền sử dụng, dịch/chú thích/đề và audio đã kiểm tra; sử dụng M02/M03, không thêm bài mẫu để lấp trống. |
| **D04b — Thư viện Shadowing biên tập** | Video có nguồn/quyền và phụ đề đã nghe đối chiếu, xuất bản bằng admin hiện có. Tạo/lưu Gemini đã nghiệm thu; chất lượng toàn bộ phụ đề vẫn cần biên tập. |
| **V01 — Nghiệm thu giao diện Review gộp C02** | Backlog còn thiếu đối chiếu popup chọn bài/trang Review mới; kiểm tra cả ba chế độ, kết quả riêng và không hoàn thành bài gốc. Code đã gọi API thật. |
| **V02 — Nghiệm thu Gemini chấm ngữ pháp C04** | Code chấm AI/quota/tiến độ đã có; thiếu bằng chứng dịch vụ thật đi hết UI→API→Gemini→DB. Không coi là mock, không tự đổi model đã chốt cho C03/A03. |
| **V03 — Đối chiếu nghe media** | Nghe TTS kana/Kanji/trọng âm trên môi trường có giọng Nhật; nghe đồng bộ/bản dịch transcript Shadowing. Tách chất lượng audio/nội dung khỏi kết quả unit test. |

## 5. Việc vận hành và vệ sinh code — không phải mock đang hiển thị

- **O04a/O04b:** xác minh email và quên mật khẩu chưa có; đăng ký/đăng nhập/Google/phiên hiện tại là thật. Chốt nhà cung cấp email, chính sách token và phiên trước khi làm.
- **O05:** phát hành online/backup/restore là mốc riêng; cần chọn hạ tầng, không kết luận đã/chưa deploy chỉ từ source audit.
- **T01:** dọn component/data legacy không còn được route import: `GrammarDetailView.tsx`, `grammarData.ts`, `radicalsData.ts`. Kiểm tra phụ thuộc rồi dọn khi được chọn; không xóa dữ liệu DB hoặc coi C03 hiện tại còn dùng modal mẫu.
- **X03:** trận Đấu trí chưa xây; tab cũ đã đổi thành XP tháng và dùng XP thật. Chỉ mở task trận đấu nếu người dùng muốn, không cần làm để sửa bảng xếp hạng hiện tại.
- Chi tiết bộ thủ, chấm chữ viết tay, lưu lượt quiz đang dở hoặc trang lịch sử đầy đủ là tính năng bổ sung chưa được duyệt, không tự thêm vào phạm vi sửa nút hiện có.

## 6. Những phần không nên triển khai lại như mock

Auth/session; catalog Kanji/bộ thủ; Chủ động P01–P05; lộ trình Kanji P06–P08; font/furigana/tốc độ P09; kết quả quiz kana P10; lịch Ôn tập và sao; giáo trình C02/Review gộp; kho ngữ pháp C03 và chấm server C04; phân tích câu A03; kho Trọng âm C05; bài đọc/audio R01/R02; Shadowing S01–S03; XP/Xếp hạng X01/X02 đều có kết nối hoặc logic thật tương ứng phạm vi đã duyệt. Các giới hạn QA/nội dung được tách bên trên.

Canvas vẽ/xóa, bảng kana cố định, phát TTS trình duyệt, trộn thẻ, chấm theo đáp án và cài đặt trên thiết bị có thể là chức năng thật chạy FE; không cần thêm DB chỉ để thay một mảng tĩnh. File mẫu không được import vào route cũng không phải bằng chứng màn hiện tại trả mock.

## 7. Ba hướng bắt đầu đề xuất

1. **J01 — Kho lộ trình JLPT thật:** ưu tiên nếu tiếp tục trọng tâm bài học/tiến độ/lộ trình. Đây là màn lớn còn mock nhiều nhất. Làm J01 rồi J02/J03 từng task, không sửa lộ trình Kanji đã chạy.
2. **A06 — Trợ lý hỗ trợ toàn web:** phù hợp mục tiêu trợ lý tương lai; đợt đầu chỉ đọc/hướng dẫn trên nội dung và route thật, tận dụng nền Gemini sẵn có.
3. **M03a — Admin biên tập phần bổ trợ Đọc hiểu:** phạm vi nhỏ, có nền DB/API; cho phép nhập kiến thức thật ngay trước khi mở rộng AI sinh nội dung.

Nếu cần một việc nhỏ để xử lý trước các hướng lớn: **P14** bảo vệ dữ liệu khi bấm demo hoặc **P12** nối nút Flashcard Kana. Không tự triển khai khi người dùng mới yêu cầu danh sách lựa chọn.
