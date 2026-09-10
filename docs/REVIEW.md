# Ôn tập theo tài khoản

Trang Ôn tập dùng lại bố cục `ReviewPage.tsx` cũ: ba tab, sáu chỉ số, hai khung hành động, năm chỉ số lịch sử, biểu đồ bảy ngày và phân bố đánh giá. Không còn danh sách thẻ dài hoặc số liệu mẫu.

- Chỉ ngôi sao đưa Kanji / từ vựng / ngữ pháp vào mục ôn tương ứng. Đã thuộc ở flashcard Hán tự không tự thêm thẻ. Không nhập sao localStorage vào tài khoản.
- Bỏ sao tạm ngừng thẻ. Gắn lại giữ lịch, số lượt và lịch sử; thẻ quá hạn được ôn ngay.
- P02: từ Chủ động sửa nội dung sẽ cập nhật thẻ đã lưu (cả thẻ bỏ sao), giữ lịch/history; xóa nguồn giữ snapshot mới nhất. Server không nhận nội dung cũ từ tab cũ ghi đè lại. Chi tiết [VOCAB_LESSONS.md](VOCAB_LESSONS.md).
- Người dùng đã duyệt nút ⭐ cạnh phát âm trên thẻ Ôn tập (10/09/2026). Có thể bỏ sao ngay trong lượt ôn khi từ/bài nguồn đã xóa; lưu thành công trở về thống kê. Không đổi các khối thống kê hoặc nút đánh giá.
- Quên rồi: 60 giây; Khó: 360 giây; Tốt: tối thiểu một ngày, gấp đôi khoảng trước; Dễ: tối thiểu bốn ngày, gấp ba khoảng trước. Giới hạn 365 ngày.
- Reset cần xác nhận số thẻ, chỉ đặt lại thẻ đang gắn sao của tab hiện tại. Giữ mọi review event, tăng version để chặn màn ôn cũ.
- Bốn nhóm tiến độ: chưa đánh giá sau thêm/reset; dưới 6 phút; từ 6 phút đến dưới 21 ngày; từ 21 ngày. Tổng đã học qua là tổng bốn nhóm đang gắn sao.
- Lịch sử gồm cả thẻ bỏ sao/reset. Giờ Việt Nam, tuần bắt đầu thứ Hai; TB/ngày chia cho số ngày thực sự học. TB/thẻ loại thời gian ẩn tab và chờ lưu/tải.

API có phiên đăng nhập, Origin hợp lệ và expectedUserId cho thao tác ghi:

| API | Nội dung |
|---|---|
| GET /api/review | Thẻ, giờ server, thống kê riêng từng loại, streak, daily, distribution |
| POST /api/review/star | Gắn/bỏ sao; giữ lịch hiện có |
| POST /api/review/rate | Đánh giá thẻ đến hạn bằng id/version; lưu lịch và event cùng transaction |
| POST /api/review/reset | category, expectedCount, expectedUserId; đặt lại lịch trong transaction |

Không cần thêm migration cho phần thống kê/reset, ngoài migration `202609080003_review_decks` của tính năng ngôi sao. Không reset hoặc xóa database.

Kiểm tra:

```powershell
npm run test:server
npm run test:review
npm run build:server
npm run build
```

Kiểm thử API dùng PostgreSQL test riêng: ba loại thẻ, bỏ/gắn lại sao, reset đúng phạm vi và giữ event, chống đánh giá lặp/hai tab, sai tài khoản, phiên và Origin, lỗi lưu và thử lại. Kiểm thử lịch bao gồm nửa đêm UTC+7, đầu tuần/tháng, streak, ngày trống và mẫu số trung bình. Kiểm thử frontend bao gồm mốc phân loại 6 phút/21 ngày và bộ đo thời gian.
