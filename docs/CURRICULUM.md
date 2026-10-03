# C02 — Giáo trình, từ vựng và Review gộp

## Phạm vi đã duyệt

- Trang học chuyển từ popup chứa từ mẫu sang giáo trình → chủ đề → bài có URL riêng, khung nét vẽ theo ảnh tham chiếu.
- Chỉ ba phương pháp: Flashcard, Trắc nghiệm, Nhồi nhét. Chủ động vẫn dùng component chung với hành vi cũ.
- Admin cổng 3002 nhập tay hoặc nhập JSON có bước xem trước, lưu nháp rồi xuất bản. Không nhập nội dung Tango, không seed mảng từ mẫu cũ vào database.
- Bài gốc hoàn thành khi đã đánh giá đủ mọi từ ở Flashcard (cả Đã thuộc và Chưa thuộc), hoặc hoàn thành một lượt Quiz/Cram. Học lại giữ mốc hoàn thành.
- Nút **Review** ở cuối giáo trình mở popup chọn các bài theo chủ đề. Trang Review gộp giữ cả ba phương pháp và danh sách từ; không có mục lục bài gốc bên phải.
- Review gộp lưu tiến độ/kết quả riêng theo tài khoản và nhóm bài. Hoàn thành Review không hoàn thành các bài gốc. Mỗi UUID từ là một mục: không gộp hai từ ở hai bài chỉ vì có cùng chữ.
- Chỉ ⭐ hoặc nút “Thêm cả bài vào ôn tập” thêm thẻ SRS. Lượt Review giáo trình và Ôn tập theo lịch là hai chức năng khác nhau.

## Sử dụng

1. Mở `http://localhost:3002/admin/curriculum` bằng tài khoản admin đã có.
2. Thêm giáo trình: nhập tên, đường dẫn cố định, trình độ, mô tả và nguồn nội dung thực tế.
3. Thêm chủ đề → bài → từ. Mỗi từ có chữ, cách đọc, nghĩa, Hán Việt, từ loại, ví dụ và Furigana tùy chọn. Không tự sinh nội dung còn thiếu.
4. Lưu bản nháp, xem trước, xác nhận xuất bản. Bản nháp mới không thay dữ liệu đang hiển thị ở trang học.
5. Mở `http://localhost:3000/tu-vung/giao-trinh`, chọn giáo trình rồi bài. URL hỗ trợ mở trực tiếp và F5.
6. Để ôn nhiều bài, bấm Review, chọn ít nhất một bài (hoặc Chọn tất cả), bấm Bắt đầu Review. Chọn lại cùng nhóm bài trong cùng tài khoản tiếp tục dữ liệu đã lưu; thứ tự bấm checkbox không tạo nhóm khác.

Các đường dẫn:

| Trang | URL |
|---|---|
| Kho giáo trình | `/tu-vung/giao-trinh` |
| Chủ đề và bài | `/tu-vung/giao-trinh/:slug` |
| Bài học | `/tu-vung/giao-trinh/:slug/bai/:lessonId` |
| Review gộp | `/tu-vung/giao-trinh/:slug/review/:reviewSetId` |
| Quản trị | `/admin/curriculum`, `/admin/curriculum/new`, `/admin/curriculum/:id` |

Khách học trong lượt đang mở; nhóm bài được truyền trong trạng thái điều hướng của tab, không ghi database. Đăng nhập không nhập tiến độ khách vào tài khoản. Link Review của tài khoản chỉ tài khoản đó được đọc.

## Database và quy tắc dữ liệu

Hai migration cộng thêm `202609290001_curriculum_catalog` và `202609290002_curriculum_review_sets`, không reset dữ liệu:

| Bảng | Nội dung |
|---|---|
| `curriculum_courses` | Slug cố định, bản nháp JSON, thông tin bản xuất bản, nguồn nháp/công khai, phiên bản, trạng thái lưu trữ |
| `curriculum_topics` | Chủ đề và thứ tự đã xuất bản, thuộc một giáo trình |
| `curriculum_lessons` | Bài và thứ tự đã xuất bản, mảng từ JSON có UUID, phiên bản; giữ các UUID từ từng thuộc bài |
| `curriculum_progress` | Đánh giá từng UUID từ, phiên bản và mốc hoàn thành bài theo tài khoản |
| `curriculum_study_results` | Kết quả Quiz/Cram hoàn thành, đáp án/điểm server và mã chống gửi lặp |
| `curriculum_review_sets` | Nhóm bài của tài khoản, khóa nhóm chuẩn hóa, tiến độ Flashcard/mốc hoàn thành riêng |
| `curriculum_review_results` | Kết quả Quiz/Cram của Review gộp; tách kết quả bài gốc |

Từ thuộc bài, lưu JSONB có giới hạn giống nền bài Chủ động; không xây thêm từ điển tổng quát hoặc CMS. Một giáo trình tối đa 100 chủ đề, 500 bài, 5.000 mục từ; một bài tối đa 500 từ. Review gộp hỗ trợ tối đa 5.000 từ trong cùng giáo trình.

UUID đã dùng không chuyển sang bài/chủ đề/giáo trình khác. Bỏ nội dung chỉ làm mục đó không còn trong bản xuất bản; vẫn giữ hàng dữ liệu và lịch sử. Sửa từ giữ UUID để tiếp tục tiến độ. Thêm từ mới không tự hủy mốc hoàn thành trước đó.

Nguồn và quyền sử dụng dùng `content_sources` hiện có; metadata nguồn bất biến. Xuất bản yêu cầu nguồn, chủ đề có bài và bài có từ. Ghi nháp/xuất bản có kiểm tra version và transaction; tab cũ nhận 409, không ghi đè bản mới.

Xuất bản cập nhật chữ/nghĩa/cách đọc của thẻ `curriculum:<wordId>` đã tồn tại, gồm cả thẻ đã bỏ sao; giữ ngày đến hạn, khoảng ôn và toàn bộ sự kiện. Bỏ từ/bài hoặc lưu trữ giáo trình vẫn giữ thẻ. Khôi phục giáo trình chỉ về nháp, cần xuất bản lại.

## API

| Nhóm | API |
|---|---|
| Nội dung đã xuất bản | `GET /api/curriculum/courses`, `GET /:slug`, `GET /:slug/lessons/:lessonId` |
| Admin | `GET/POST /api/admin/curriculum/courses`, `GET/PATCH /:id`, `POST /preview`, `POST /:id/publish`, `/archive`, `/restore` |
| Hoàn thành giáo trình | `GET /api/curriculum/progress/course?courseId=…` |
| Bài đơn | `/api/curriculum/progress` (GET), `/progress/rate`, `/progress/reset`, `/results` (GET/POST), `/star-lesson` (POST) |
| Nhóm Review | `POST /api/curriculum/review-sets`, `GET /:id`; các endpoint `/progress`, `/progress/rate`, `/progress/reset`, `/results`, `/star-lesson` dưới cùng prefix |
| Khách chọn bài | `POST /api/curriculum/courses/:slug/review-preview` chỉ đọc nội dung công khai, không ghi dữ liệu |

Ở endpoint học Review, `lessonId` trong hợp đồng component học chính là UUID nhóm Review; backend kiểm tra chủ sở hữu. Không nhận từ hoặc điểm do frontend tự khai. Kết quả chỉ lưu khi đủ câu hợp lệ; từ thiếu dữ liệu cho phương pháp đang chọn được bỏ qua và báo số lượng. Không chèn đáp án mẫu khi bài ít từ.

## Nhập JSON

Nhập **một bản nháp giáo trình**. Ví dụ sau là mẫu định dạng trống, cần thay nội dung và mã nguồn thực tế; chưa đủ điều kiện xuất bản:

```json
{
  "title": "Tên giáo trình của bạn",
  "level": "N5",
  "sourceId": null,
  "topics": [
    {
      "title": "Tên chủ đề",
      "japanese": "",
      "lessons": [
        {
          "title": "Tên bài",
          "words": []
        }
      ]
    }
  ]
}
```

Mỗi từ yêu cầu `word`, `meaning`. Các trường tùy chọn: `reading`, `hanViet`, `romaji`, `partOfSpeech` (mảng), `exampleJp`, `exampleVi`, `ruby` (mảng `{text, reading?}` ghép lại đúng chữ gốc). Topic/bài/từ thiếu `id` được cấp UUID ở lần phân tích JSON; ID có sẵn được giữ. Khi chỉnh giáo trình cũ qua JSON cần giữ ID để giữ tiến độ.

Giới hạn file/body admin 4 MiB. Preview chỉ kiểm tra, không ghi database. Xác nhận dùng bản nhập thay nội dung trong trình sửa và cho biết số mục bị bỏ; vẫn phải Lưu bản nháp, sau đó Xuất bản. Không cộng dồn hoặc tự đoán nguồn.

## Nghiệm thu

Kết quả build, API, unit test và phạm vi kiểm tra giao diện được ghi tại dòng C02 trong `FEATURE_BACKLOG.md`. Tài khoản QA riêng đã dọn. Giáo trình QA được lưu trữ và giữ lại vì có một tiến độ thuộc tài khoản khác; không xóa dữ liệu học đó và không dùng giáo trình QA như nội dung thật.

Ngày 30/09/2026: 120/120 kiểm thử API liên quan đạt, trong đó có 27 ca C02; 102/102 kiểm thử FE/shared đạt; build trang học, admin và backend đạt. Kiểm tra qua API local với nhóm 2 bài, 4 từ: cả 3 phương pháp lưu thành công, gửi lại không tạo kết quả hoặc nhóm trùng, Review không tăng số bài gốc hoàn thành, gắn sao đủ 4 mục. Giao diện admin đã kiểm tra JSON lỗi, xem trước, lưu, F5 và xuất bản. Popup và trang Review được bổ sung sau khi công cụ trình duyệt không còn khả dụng; chưa đối chiếu trực tiếp hình ảnh và âm thanh của phần này.
