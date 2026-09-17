# P08 — Lộ trình mặc định với dữ liệu và tiến độ thật

Phạm vi triển khai và bằng chứng kiểm tra ngày 16/09/2026. Người dùng đã duyệt ba lựa chọn:

1. Dùng **28 chữ N5 hiện có**, thay số mẫu bằng số thật; đây chưa phải bộ N5 đầy đủ.
2. Giữ **10 chữ/ngày** theo thứ tự catalog: ba ngày **10–10–8 chữ**. Quy tắc hoàn thành và học lại dùng như P07.
3. Một ngày có ít nhất một đánh giá lưu thành công được tính vào **Streak**, theo ngày Việt Nam (UTC+7).

## Phạm vi và giao diện

Catalog cố định có mã `n5-v1`, khai báo trong `shared/default-roadmap.mjs`. Danh sách là 28 chữ N5 từ catalog hiện tại, ID `k-1` đến `k-28`; không đưa các chữ N4–N1 vào lộ trình N5, không tự bổ sung nguồn nội dung khác.

Giữ thứ tự và danh sách của phiên bản `n5-v1` để không làm lệch ngày đã học. Mở rộng sang bộ N5 đầy đủ hoặc cấp khác cần chốt nguồn và cách chuyển phiên bản riêng.

Giữ bố cục, màu, font, khung nét vẽ và nhãn của tab mặc định: tiêu đề, bốn ô thống kê, hàng cấp độ, chọn ngày, thanh ngày, danh sách Kanji và Học ngay. `DefaultRoadmapView` dùng lại JSX/class của các khung cũ. Có thông tin phạm vi 28 chữ và thông báo tải/lỗi cần thiết; không thay trang bằng bố cục khác.

Các lựa chọn N4–N1 vẫn hiện ở vị trí cũ. Chọn một cấp chưa hỗ trợ hiển thị thông báo chưa có dữ liệu, danh sách trống và khóa Học ngay; không lặp lại chữ N5 dưới tên cấp khác hoặc giả bộ đã mở nội dung Premium.

| Thông tin | Nguồn tính |
|---|---|
| Đã học | Số ngày hoàn thành của `n5-v1` / 3 |
| Kanji | Số chữ đã có đánh giá trong lộ trình, gồm Đã thuộc và Chưa thuộc |
| Streak | Chuỗi ngày có đánh giá lưu thành công, kết thúc hôm nay hoặc hôm qua |
| Tiến độ | Số ngày hoàn thành / 3, làm tròn phần trăm |
| N5 và danh sách ngày | 28 chữ / 3 ngày; từng ngày chứa đúng 10, 10 hoặc 8 chữ |

Ngày đang xem không được dùng làm số ngày hoàn thành. Khi chưa tải được dữ liệu tài khoản, các số tiến độ hiển thị dấu chờ thay vì số mẫu.

## Luồng học

- Mở trang, chọn cấp, đổi ngày hoặc nghe phát âm không tạo bản ghi tiến độ hay tính Streak.
- URL giữ `level` và `day`; ngày ngoài khoảng hợp lệ được đưa về ngày chưa hoàn thành đầu tiên. Khi hoàn thành tất cả, ngày tiếp tục là ngày cuối hợp lệ.
- Học ngay bắt đầu phiên rồi mở flashcard Kanji hiện có. Ngày đang dở tiếp tục ở chữ chưa đánh giá đầu tiên; F5 trở về trang ngày học và Học ngay mở lại đúng vị trí đó.
- Đã thuộc hoặc Chưa thuộc đều là một đánh giá. Phải có đánh giá cho mọi chữ của ngày mới hoàn thành ngày, kể cả ngày cuối chỉ có 8 chữ.
- Chỉ chuyển thẻ sau khi lưu thành công. Đánh giá đủ ngày thì đóng flashcard, trở về thống kê và thông báo hoàn thành.
- Học lại ngày đã hoàn thành mở từ đầu, giữ hoàn thành cũ và chỉ cập nhật đánh giá từng chữ. Các chữ phải được đánh giá lại đủ trong lượt đang mở để kết thúc lượt học lại.
- Lật, chuyển, trộn, phát tự động hoặc quay về thẻ đầu không tự tạo đánh giá. Chặn bấm đúp, giữ phím và gửi đồng thời trong cùng phiên.
- Lỗi lưu giữ nguyên thẻ; cần Tải lại tiến độ đã lưu trước khi đánh giá tiếp. Phiên bản cũ từ tab khác nhận 409, không tự gửi lại đánh giá cũ sau khi tải lại.
- Tiến độ lộ trình mặc định riêng với lộ trình cá nhân P07. Trạng thái Kanji sẵn có không tự hoàn thành ngày của lộ trình mặc định.
- Đánh giá tài khoản đồng thời cập nhật trạng thái Kanji trong cùng transaction. **Không tự gắn sao**, không thay lịch SRS, không cộng XP.

Logic phiên flashcard của P07 và P08 dùng chung `useRoadmapStudy` và `RoadmapStudyOverlay`; giữ nguyên khung và hành vi flashcard cũ.

## Dữ liệu, API và thời gian

Migration cộng thêm `202609150002_default_roadmap_progress` tạo bảng `default_roadmap_progress`. Không reset DB, không sửa hoặc nhập dữ liệu cá nhân cũ.

Khóa chính gồm `user_id` và `catalog_id`. Mỗi bản ghi lưu:

- `assessments` JSONB: ID Kanji → boolean, giữ cả đánh giá false.
- `completed_days` integer[]: ngày đã hoàn thành, không xóa khi học lại.
- `progress_version`: phiên bản tăng khi bắt đầu lần đầu hoặc lưu đánh giá.
- `started_at`: thời điểm bắt đầu flashcard lần đầu.
- `activity_days` text[]: các ngày Việt Nam có đánh giá lưu thành công; mỗi ngày xuất hiện một lần.

| API | Input | Hành vi |
|---|---|---|
| `GET /api/roadmaps/default` | Không có query | Trả catalog và tiến độ của tài khoản; nếu chưa học trả tiến độ rỗng mà không tạo bản ghi |
| `POST /api/roadmaps/default/start` | `expectedUserId, catalogId, day` | Kiểm tra tài khoản/catalog/ngày; bắt đầu lần đầu, các lần gọi lại giữ dữ liệu |
| `POST /api/roadmaps/default/rate` | `expectedUserId, catalogId, progressVersion, day, kanjiId, memorized` | Kiểm tra chữ đúng ngày và phiên bản; lưu đánh giá, hoàn thành, ngày học và trạng thái Kanji cùng transaction |

Phản hồi có `userId`, `roadmap`, `serverNow`. DTO roadmap gồm metadata catalog và tiến độ, `currentDay` dẫn xuất, `activityDays`, `streak`. Frontend không được tự gửi số thống kê hoặc danh sách ngày hoàn thành để ghi vào DB.

API yêu cầu session, Origin hợp lệ, JSON strict, body tối đa 16 KiB và hạn mức 120 request/phút. Khóa transaction theo tài khoản/catalog kết hợp `progressVersion` chặn hai tab ghi từ cùng phiên bản. Đánh giá với phiên bản cũ trả `ROADMAP_PROGRESS_CHANGED`; lỗi transaction rollback cả tiến độ lộ trình lẫn trạng thái Kanji.

Ngày học tài khoản lấy từ đồng hồ server, chuyển UTC+7 tại lúc lưu đánh giá. Streak kết thúc hôm nay hoặc hôm qua; ngày lặp không tăng thêm, ngày bị bỏ qua ngắt chuỗi. Frontend dùng `serverNow` để bù chênh lệch đồng hồ và tính lại ở nửa đêm Việt Nam; khi lấy lại focus/tab hiện ra, tải lại dữ liệu server. Chỉ bắt đầu học hoặc xem trang không tạo ngày hoạt động.

## Dữ liệu khách

Khách dùng key riêng `nhai_kanji_default_roadmap_n5_v1`. Ngày học khách dựa trên đồng hồ thiết bị và vẫn chuyển sang UTC+7. Thao tác lưu kiểm tra phiên bản và snapshot, dùng Web Locks khi trình duyệt hỗ trợ; lỗi storage được báo, không chuyển thẻ khi chưa lưu được.

Đọc dữ liệu khách không ghi lại storage chỉ vì mở trang. Dữ liệu sai định dạng được giữ nguyên và báo lỗi. Không nhận con trỏ ngày, dữ liệu khách hay tiến độ Kanji/lộ trình cá nhân làm bằng chứng hoàn thành lộ trình mặc định. Đăng nhập không tự nhập tiến độ khách vào tài khoản.

## Bằng chứng nghiệm thu đã có

- Build frontend và backend đạt; **43 test FE/shared đạt**, gồm catalog 28 chữ và chia 10–10–8, ngày UTC+7 qua ranh giới tháng/năm/năm nhuận, Streak liên tiếp/ngắt quãng.
- Đối chiếu source trước/sau: 83/84 className tĩnh của khung mặc định giữ nguyên; class thanh ngày chỉ thêm viền focus cho bàn phím. JSX phần chi tiết P07 giữ nguyên; flashcard dùng component cũ. Đã xem giao diện ở kích thước 1280×720 rồi trả viewport ban đầu.
- Lượt chạy backend đầy đủ: **132 test cũ đạt**; nhóm P08 có 7 đạt, 3 timeout khi DB mất kết nối. Sau khi kết nối hoạt động lại, chạy lại riêng nhóm P08: **10/10 đạt trong 35,86 giây**. Không ghi nhận lượt chạy đầy đủ là 142/142 đạt.
- Nhóm P08 kiểm tra tài khoản/session/Origin, catalog/ngày/chữ không hợp lệ, chống sửa thống kê, bắt đầu đồng thời, đánh giá false, 10–10–8, giữ hoàn thành khi học lại, ngày tiếp tục, hai tab, ngày Việt Nam/Streak, độc lập với P07/SRS và rollback transaction.
- UI: khách chưa học hiển thị tiến độ 0; chọn N4 báo chưa có dữ liệu. Tài khoản xem ngày 2 có 10 chữ, ngày 3 có 8 chữ đúng catalog.
- Đối chiếu DB: GET và đổi ngày không tạo bản ghi; bắt đầu flashcard không thêm đánh giá. Bấm đúp chỉ lưu một chữ; F5 rồi Học ngay tiếp tục từ thẻ 2/10.
- Hoàn thành 28 chữ trên tài khoản QA: **3/3 ngày, 100%, Streak 1**.
- Hai tab: tab cũ nhận 409; Tải lại lấy đúng bản mới và tiếp tục tại thẻ 3/10.
- Tạm dừng riêng tiến trình API: đánh giá tại thẻ cuối 8/8 báo lỗi và không chuyển/hoàn thành; khởi động API lại, Tải lại và đánh giá tiếp hoàn thành ngày.

- Học lại ngày 3, đổi đánh giá của chữ đầu và F5: vẫn 3/3, 100%; DB giữ 28 đánh giá, một ngày hoạt động, chữ vừa học lại cập nhật đúng.
- Hồi quy P07 bằng lộ trình riêng một chữ: ban đầu 0/1 dù chữ đã được học ở mặc định; Chưa thuộc → hoàn thành, F5 vẫn giữ. Tiến độ P08 không đổi.
- Đăng xuất: khách hiện 0/3, 0 chữ, Streak 0; đăng nhập lại tài khoản QA: 100% được khôi phục. Không tự nhập tiến độ giữa khách và tài khoản.
- DB đối chiếu sau học: 28 trạng thái Kanji, **0 thẻ Ôn tập**; lộ trình mặc định và lộ trình riêng có đánh giá/hoàn thành riêng. Tài khoản QA, phiên và dữ liệu gắn với tài khoản đã dọn; không xóa dữ liệu người dùng. API local đang chạy.

Phần lưu khách được rà soát code và helper; chưa thực hiện ghi tiến độ khách trên trình duyệt chính để tránh để lại dữ liệu thử trên thiết bị dùng chung. Các kiểm thử UI ghi/lỗi mạng/hai tab dùng tài khoản QA riêng.

Chạy lại kiểm thử catalog/Streak: `npm run test:default-roadmap`. Backend: `npm run test:server` (chỉ DB test được cấu hình riêng). Frontend vẫn có cảnh báo bundle trên 500 kB đã tồn tại; không mở rộng sang chia bundle trong P08.
