# X01/X02 — Xếp hạng học tập

Người dùng chốt quy tắc ngày 04/10/2026. Giữ khung ba vị trí đầu, danh sách đến hạng 10 và khung “Thứ hạng của bạn”; đổi tab “Đấu trí tháng” thành **XP tháng**. Không có trận đấu hay kết quả thắng giả.

## Quy tắc điểm

| Hoạt động server lưu thành công | XP | Giới hạn |
|---|---:|---|
| Đánh giá thẻ SRS đang đến hạn, cả bốn mức | 2 | Một lần/thẻ/ngày |
| Hoàn thành một ngày trong lộ trình cá nhân hoặc mặc định | 10 | Một lần cho ngày đó của lộ trình; học lại không thưởng |
| Câu đúng trong lượt Trắc nghiệm/Nhồi nhét Chủ động hoặc giáo trình, kể cả Review gộp | 1 | Một lần/từ/ngày, dùng chung giữa các chế độ và bài gốc/Review |
| Câu đúng trong lượt Kana hoàn thành | 1 | Một lần/chữ/bảng Hiragana hoặc Katakana/ngày; đổi chế độ không tạo danh tính câu mới |
| Câu ngữ pháp đúng ở lần chấm đầu được lưu, đối chiếu hoặc Gemini | 1 | Giữ quy tắc điểm lần đầu của C03; thử lại chỉ luyện thêm, xem đáp án trước không nhận XP |

Tổng tối đa **200 XP/tài khoản/ngày**, ngày theo `Asia/Ho_Chi_Minh`. Phần thưởng sát trần chỉ nhận phần còn lại. Đến trần vẫn lưu kết quả học; mốc đã hoàn thành không chuyển phần thưởng sang hôm sau. Với ngữ pháp, giới hạn theo ngày là mức trần bổ sung; điểm lần chấm đầu vẫn được bảo toàn như C03.

Chỉ tính hoạt động từ khi triển khai, không cộng bù lịch sử cũ. Không thưởng khi gắn/bỏ sao, xem trang, phát âm, tự đánh dấu Flashcard, tạo bài, reset hoặc gửi lại kết quả đã lưu. Các câu sai, bỏ qua và lượt quiz đang dở không nhận XP. Bài luyện tính theo đáp án đầu mỗi lượt như P05/P10; gợi ý giữ quy tắc chấm hiện có.

## Chỉ số và thứ hạng

- **Tổng XP:** toàn bộ XP đã ghi nhận. **XP tháng:** XP trong tháng lịch hiện tại tại Việt Nam; không phải 30 ngày gần nhất.
- Chỉ người có XP dương trong kỳ được xếp hạng. Tài khoản 0 XP vẫn có khung cá nhân, thứ hạng `—`; không thêm người mẫu để lấp chỗ trống.
- Cùng XP thì đồng hạng: `1, 1, 3`. Thứ tự hiển thị người đồng điểm ổn định theo ngày tạo tài khoản và UUID. Danh sách gồm tối đa 10 người; thứ hạng cá nhân vẫn lấy trên toàn bộ bảng, kể cả ngoài top 10.
- **Thẻ ghi nhớ:** số thẻ đang gắn ⭐. Bỏ sao làm giảm chỉ số này, giữ XP/lịch sử cũ.
- **Ngày lộ trình:** số ngày đã hoàn thành của các lộ trình mặc định và cá nhân hiện còn. Đây là ngày trong kế hoạch học, không phải số ngày trên lịch; xóa lộ trình làm giảm chỉ số này, giữ XP đã nhận.
- Hai chỉ số phụ là số hiện tại, kể cả khi xem XP tháng. Công khai tên hiển thị, avatar, Premium và các chỉ số; không trả email, quyền quản trị, khóa Google hoặc dữ liệu xác thực.
- Trang tải lại khi mở, đổi tab, F5 hoặc quay lại cửa sổ. Lỗi tải có thông báo và nút Thử lại. Avatar lỗi dùng chữ viết tắt tên; khách có lời mời đăng nhập tại khung cá nhân.

## Database và API

- Migration cộng thêm `202610040001_learning_xp`; bảng `xp_events` chứa tài khoản, loại hoạt động, khóa nội dung, khóa chống lặp, ngày Việt Nam, điểm và thời điểm ghi.
- Không đổi/xóa bảng học cũ, không reset database. Điểm không phụ thuộc khóa ngoại tới nguồn học nên xóa bài vẫn giữ điểm; xóa tài khoản mới xóa các bản ghi XP của tài khoản đó.
- `awardLearningXp` trong `apps/api/src/modules/leaderboard/leaderboard.service.ts` được gọi trong cùng transaction với kết quả học. Lỗi lưu bất kỳ phần nào đều rollback. Khóa transaction riêng theo tài khoản bảo vệ trần tổng điểm khi nhiều chức năng hoặc nhiều tab cùng gửi.
- `GET /api/leaderboard?period=all|month` trả bảng công khai và tài khoản đang xem, dùng phiên sẵn có. Không có API cho frontend tự gửi XP, ngày nhận điểm hoặc người nhận.
- Bảng xếp hạng được tổng hợp bằng truy vấn PostgreSQL; chưa cần bảng số dư, cache hay tác vụ nền. Cùng truy vấn lấy thứ hạng và chỉ số để tránh ghép các thời điểm khác nhau.

## Kiểm thử

`apps/api/tests/leaderboard.test.ts` kiểm tra trần điểm, đồng thời, khóa lặp, rollback, nửa đêm/đầu tháng, đồng hạng, người ngoài top, khách và hồ sơ công khai; gọi các API SRS/từ vựng/Kana thật trên DB test. Các kiểm thử lộ trình, giáo trình/Review và ngữ pháp có xác nhận XP cùng kết quả học. Frontend kiểm tra đủ/thiếu người ở podium và giữ thứ hạng server.

Kết quả nghiệm thu của lượt triển khai được cập nhật trong [FEATURE_BACKLOG.md](FEATURE_BACKLOG.md).
