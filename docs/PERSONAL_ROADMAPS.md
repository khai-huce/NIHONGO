# P06 — Lộ trình Kanji cá nhân theo tài khoản

**Cập nhật 15/09/2026:** P07 đã hoàn thành luồng học/tiến độ theo ngày; xem [ROADMAP_STUDY.md](ROADMAP_STUDY.md). Các mô tả “chưa nối học” bên dưới ghi nhận phạm vi P06 ở thời điểm bàn giao, không còn là trạng thái hiện tại. Tab mặc định vẫn thuộc P08.

Triển khai từ 14/09/2026, hoàn tất nghiệm thu 15/09/2026. Phạm vi được duyệt: tạo, xem, sửa tên/số chữ mỗi ngày và xóa lộ trình cá nhân. Giữ bố cục hiện có; bổ sung nút bút chì nhỏ cạnh nút xóa và dùng lại hộp nhập lộ trình. Người dùng đã duyệt riêng hộp xác nhận xóa trong trang với câu hỏi cũ và hai nút Hủy/Xóa lộ trình.

## Quy tắc và giao diện

- Dán văn bản → lấy chữ Han theo thứ tự xuất hiện đầu tiên, bỏ chữ trùng. Giữ nguyên văn bản đã nhập để xem lại. Những ký tự Han ngoài BMP cũng được nhận diện, tránh âm thầm bỏ qua.
- Chỉ tạo từ chữ có trong catalog đang có. Chữ chưa có dữ liệu được liệt kê ngay trong hộp nhập và API cũng từ chối; người dùng sửa danh sách trước khi lưu. Catalog hiện chỉ có 35 chữ, không suy ra nội dung từ số lượng giới thiệu trên tab mặc định.
- Tên 1–100 ký tự sau trim, văn bản tối đa 2.000 ký tự, mục tiêu 5/10/15/20/25/30 chữ mỗi ngày. Tối đa 100 lộ trình mỗi tài khoản. Tổng ngày tính bằng làm tròn lên số chữ chia mục tiêu; ngày cuối có thể ít chữ hơn.
- Nút sửa chỉ đổi tên và số chữ/ngày; danh sách chữ hiển thị chỉ đọc. Khi đã bắt đầu học, số chữ/ngày bị khóa nhưng vẫn đổi tên được. Muốn mục tiêu khác sau khi học thì tạo lộ trình mới.
- Tải/lưu thất bại có thông báo; form giữ nội dung nhập. Nếu hai tab cùng sửa, phiên bản cũ bị từ chối. Nút **Mở bản mới** có lời nhắc rõ rằng thao tác này thay nội dung nhập bằng bản đã lưu; tải bản mới không tự lưu lại bản cũ.
- Xóa mở hộp xác nhận trong trang theo mẫu khung cũ, hiển thị đúng tên lộ trình. **Hủy** giữ nguyên dữ liệu; **Xóa lộ trình** chỉ đóng hộp và bỏ thẻ sau khi lưu thành công. Khi đang gửi, khóa nút để tránh thao tác lặp.
- F5 hoặc phiên đăng nhập khác đọc dữ liệu server. Khi đổi tài khoản, remount trang và kiểm tra owner/revision để phản hồi cũ không làm lộ hoặc ghi nhầm tài khoản.

Tab mặc định và dữ liệu học theo ngày thuộc P08/P07. P06 chưa bắt đầu phiên học, chưa đánh dấu ngày hoàn thành, chưa tính phần trăm tiến độ. `currentDay=1` là ngày bắt đầu của lộ trình mới. `startedAt` do server quản lý và sẽ được P07 ghi khi bắt đầu học; client P06 không được tự gửi trường này.

## Lưu trữ và API

Một bảng `personal_roadmaps`: ID UUID, chủ tài khoản, tên, văn bản gốc, mảng chữ có thứ tự, mục tiêu/ngày, version, startedAt và thời gian tạo/cập nhật. Thêm migration `202609140002_personal_roadmaps`, không sửa hoặc reset dữ liệu học cũ.

- `GET /api/roadmaps` → `{userId, roadmaps}`, mới nhất trước.
- `POST /api/roadmaps` nhận `{id, expectedUserId, name, rawKanji, perDay}` → `{userId, roadmap}`. UUID giữ nguyên khi thử lưu lại. Cùng UUID/cùng nội dung trả bản đã có; nội dung khác hoặc chủ khác trả 409.
- `POST /api/roadmaps/update` nhận `{id, expectedUserId, version, name, perDay}`. So sánh phiên bản trong transaction, cập nhật có điều kiện; gửi lại cùng trạng thái không tăng version lần nữa. Kiểm tra startedAt ở cả bước đọc và ghi mục tiêu.
- `POST /api/roadmaps/delete` nhận `{id, expectedUserId, version}`. Phiên bản cũ bị chặn; xóa lại ID đã xóa được coi là thành công. Không tác động sao, lịch sử Ôn tập hoặc tiến độ Kanji.
- Giữ xác thực session/Origin và giới hạn JSON 16 KiB. Schema strict từ chối trường giả mạo chủ sở hữu, danh sách chữ dẫn xuất hoặc tiến độ. Hạn mức 120 request/phút; giới hạn số lộ trình được kiểm tra trong khóa transaction theo tài khoản.

`packages/shared/src/study/roadmap.mjs` là quy tắc nhận diện và danh sách hỗ trợ dùng chung FE/BE; test đối chiếu với `packages/shared/fixtures/legacy-kanji.ts`. Chưa thêm nguồn nội dung, dịch vụ AI hoặc thư viện mới. Khi đóng gói backend cần giữ package `packages/shared` và cài dependency bằng npm workspace ở gốc như P05.

## Dữ liệu khách

Giữ key `nhai_kanji_custom_roadmaps` và định dạng cũ. Đăng nhập không tự nhập lộ trình thiết bị vào tài khoản. Mount/tải trang không ghi ngược localStorage. Dữ liệu cũ có chữ chưa hỗ trợ vẫn được giữ để xem, sửa tên hoặc xóa; chỉ kiểm tra catalog đối với lộ trình tạo mới.

Trước mỗi thao tác khách, đọc lại storage và so sánh phiên bản/toàn bộ snapshot để chặn ghi đè từ tab cũ. Web Locks của trình duyệt được dùng nếu có; nếu không có, kiểm tra bản đã đọc ngay trước ghi. Dữ liệu hỏng hoặc storage không ghi được báo lỗi và giữ nguyên bản gốc.

## Nghiệm thu

- Build frontend/backend đạt. Migration cộng thêm đã áp dụng tại local, Prisma Client đã generate thành công.
- 3 test nhận diện/catalog và 2 test route đạt. 105 test backend hồi quy cũ và 16 case P06 đều đạt. Ba test rollback lúc đầu lỗi ở bước retry do Vitest khôi phục phương thức proxy Prisma; đã đổi test sang mở client/app mới sau lỗi giả lập (cùng cách P04/P05), giữ nguyên kiểm tra rollback và retry; chạy lại đủ 16 case P06 đạt. Không thay code nghiệp vụ để bỏ qua lỗi test.
- UI khách: chữ trùng và chữ chưa hỗ trợ, bấm đúp tạo một bản, 6 chữ/5 chữ mỗi ngày = 2 ngày, F5 giữ lộ trình. Đăng nhập tài khoản QA cho danh sách trống, không nhận lộ trình khách.
- UI tài khoản: tạo → sửa tên/mục tiêu → F5 giữ bản mới; thứ tự chữ không đổi. Hai tab sửa cùng bản → tab cũ bị chặn, giữ input, **Mở bản mới** lấy đúng bản server.
- Tạm dừng riêng API local → lưu báo máy chủ chưa sẵn sàng, giữ form; khởi động lại API → bấm lưu thành công. Không dừng PostgreSQL hoặc thay dữ liệu người dùng.
- Dùng riêng fixture QA có startedAt để kiểm tra khóa sáu nút mục tiêu; vẫn sửa tên được. Đây là kiểm thử quy tắc, không phải nghiệm thu luồng học P07.
- Đã đối chiếu trực tiếp giao diện tạo/sửa/danh sách với giao diện trước thay đổi. AST xác nhận giữ đủ 154 className tĩnh cũ; đoạn markup lộ trình mặc định giống bản trước (bỏ khác biệt xuống dòng). Bố cục, màu, font, nhãn chính giữ nguyên; nút sửa và thông báo đúng phạm vi duyệt.
- Xác nhận xóa trong trang: đã kiểm tra Hủy, xác nhận bằng bấm đúp, xóa thành công và F5 vẫn trống. Xóa tài khoản không tự xóa lộ trình khách; đã quay lại chế độ khách và dọn đúng lộ trình QA qua giao diện, F5 xác nhận trống.

Tài khoản, phiên và lộ trình QA riêng đã được dọn. Không xóa dữ liệu người dùng. API local đã khởi động lại và hoạt động bình thường. P06 hoàn thành; P07 (học/tiến độ theo ngày) và P08 (lộ trình mặc định) chưa triển khai.
