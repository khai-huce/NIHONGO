# Hướng dẫn thêm giáo trình từ vựng

## Mở trang quản trị

Chạy ba lệnh trong ba terminal tại thư mục NIHONGO:

```powershell
npm run dev:server
npm run dev
npm run dev:admin
```

Mở **http://localhost:3002/admin/curriculum**. Đăng nhập tài khoản admin đã cấp. Nếu dùng Google, đăng nhập ở cổng 3000 trước rồi quay lại admin.

## Cách 1: nhập trực tiếp

1. Chọn **Giáo trình → Thêm giáo trình**.
2. Điền **Tên giáo trình**, **Đường dẫn** (ví dụ `tu-vung-n5`), **Trình độ**. Đường dẫn không đổi sau khi tạo để giữ link bài học.
3. **Thêm nguồn** nếu chưa có: ghi mã nguồn riêng, tên nguồn, URI/URL gốc, quyền sử dụng thực tế, URI/URL điều khoản, phiên bản/ngày và ghi công. Không chọn nguồn KANJIDIC2 cho Tango; đó là nguồn Kanji khác. Có thể lưu nháp khi chưa có nguồn, chưa thể xuất bản.
4. **Thêm chủ đề**, nhập tên tiếng Việt và tên tiếng Nhật nếu có.
5. **Thêm bài vào chủ đề**, đặt tên bài, chọn **Biên tập từ**.
6. **Thêm từ**. Bắt buộc chữ và nghĩa; bổ sung cách đọc/Hán Việt để học được các chế độ tương ứng. Ví dụ và Furigana chỉ nhập khi có dữ liệu đúng. Thêm từng đoạn chữ gốc và kana cho Furigana; các chữ gốc ghép lại phải bằng từ tiếng Nhật.
7. Bấm **Lưu bản nháp**, sau đó **Xem trước nội dung**. Chọn **Xuất bản… → Xác nhận xuất bản** khi đã rà soát.
8. Mở **http://localhost:3000/tu-vung/giao-trinh** để kiểm tra.

Nháp chưa xuất bản không xuất hiện ở trang học. Nếu giáo trình đã xuất bản, sửa và lưu nháp vẫn giữ nội dung công khai cũ cho đến lần xuất bản tiếp theo.

## Cách 2: nhập file JSON

1. Tạo giáo trình mới hoặc mở giáo trình cần sửa.
2. Bấm **Nhập JSON**, chọn file `.json` hoặc dán nội dung.
3. Bấm **Kiểm tra và xem trước**. Sửa các lỗi có đường dẫn trường, ví dụ `topics.0.lessons.0.words.2.meaning` là nghĩa của từ thứ 3, bài thứ 1, chủ đề thứ 1.
4. Kiểm tra số chủ đề/bài/từ và số mục sẽ bị bỏ khỏi bản nháp. Bấm **Xác nhận dùng bản nhập**.
5. Nếu `sourceId` trong file để `null`, chọn nguồn thực tế trên form sau khi nhập.
6. **Lưu bản nháp → Xem trước nội dung → Xuất bản… → Xác nhận xuất bản**.

Nhập JSON thay bản đang biên tập, không tự cộng dồn với nội dung cũ. Các bước xem trước/xác nhận nhập chưa ghi database; Lưu bản nháp mới ghi dữ liệu. Bấm **Tải JSON bản đang sửa** để lấy file hiện tại kèm ID trước khi chỉnh sửa bên ngoài. Với giáo trình đã có tiến độ, giữ `id` của các chủ đề, bài, từ khi sửa để không tạo những mục mới. ID được cấp tự động cho mục chưa có ID.

Giới hạn: 4 MiB/file, 100 chủ đề, 500 bài, 5.000 từ/giáo trình; mỗi bài tối đa 500 từ. Thứ tự mảng là thứ tự trên trang học.

## Cấu trúc một từ

Ví dụ dưới đây chỉ minh họa định dạng, không phải dữ liệu trích nguyên giáo trình Tango:

```json
{
  "word": "水",
  "reading": "みず",
  "hanViet": "THỦY",
  "meaning": "Nước",
  "partOfSpeech": ["Danh từ"],
  "exampleJp": "水を飲みます。",
  "exampleVi": "Tôi uống nước.",
  "ruby": [{"text": "水", "reading": "みず"}]
}
```

Đặt các từ trong `topics[].lessons[].words`. Không gửi mật khẩu, khóa API hoặc thông tin tài khoản trong file.

## Học và Review

- Chọn giáo trình → mở chủ đề → bấm bài. Có Flashcard, Trắc nghiệm và Nhồi nhét. Hoàn thành một chế độ tính hoàn thành bài; học lại giữ mốc hoàn thành.
- **Review** cuối trang giáo trình mở popup chọn bài. Chọn một hay nhiều bài, hoặc Chọn tất cả, rồi Bắt đầu Review. Nhóm Review có tiến độ/kết quả riêng, không đánh dấu các bài gốc hoàn thành.
- Chọn lại đúng nhóm bài bằng cùng tài khoản sẽ lấy nhóm đã lưu. F5/link Review giữ đúng nhóm; tài khoản khác không đọc được.
- ⭐ và **Thêm cả bài vào ôn tập** mới thêm thẻ vào Ôn tập theo lịch. Chỉ học hay Review không tự gắn sao.

## Lưu ý khi sửa hoặc lưu trữ

- Sửa nghĩa/cách đọc và xuất bản cập nhật thẻ ôn đã có nhưng giữ lịch/lịch sử.
- Bỏ từ, bài hoặc lưu trữ giáo trình không xóa kết quả đã lưu và thẻ ôn.
- Khôi phục giáo trình chỉ đưa về nháp; cần xuất bản lại.
- Khi hai tab sửa cùng giáo trình, tab cũ sẽ bị chặn ghi đè. Tải bản mới nhất sau khi sao lại phần nhập cần giữ.

## File Từ vựng N5 nguồn mở

Người dùng đã gửi PDF Tango rồi đổi yêu cầu sang giáo trình nguồn mở riêng tên **Từ vựng N5**. Dùng `docs/data/tu-vung-n5/tu-vung-n5.json`: 662 mục từ OpenJLPT, 10 nhóm kana, 31 bài. Nghĩa Việt do AI hỗ trợ biên soạn, được người dùng chọn làm bản cần rà soát. Xem [hướng dẫn nhập và giấy phép](data/tu-vung-n5/README.md). Khung Tango và các file xử lý PDF/OCR cũ đã được xóa theo yêu cầu.
