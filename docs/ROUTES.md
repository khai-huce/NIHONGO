# Điều hướng frontend

Dùng React Router với createBrowserRouter/RouterProvider. URL là nguồn xác định trang và mục sidebar đang chọn; không còn activeTab hoặc đối tượng chi tiết lưu riêng trong App để chuyển trang.

| Trang | URL |
|---|---|
| Hán tự / chi tiết | `/kanji`, `/kanji/:id` (ví dụ `k-1`) |
| Giáo trình từ vựng | `/tu-vung/giao-trinh`, `/tu-vung/giao-trinh/:slug` |
| Bài từ vựng | `/tu-vung/giao-trinh/:slug/bai/:lessonId` |
| Review các bài đã chọn | `/tu-vung/giao-trinh/:slug/review/:reviewSetId` |
| Bảng chữ cái | `/tu-vung/bang-chu-cai` |
| Kho / giáo trình ngữ pháp | `/ngu-phap`, `/ngu-phap/giao-trinh/:slug` |
| Bài ngữ pháp | `/ngu-phap/giao-trinh/:slug/bai/:lessonId` |
| Mẫu câu / bài tập | `/ngu-phap/mau/:id`, `/ngu-phap/mau/:id/bai-tap` (UUID) |
| Lộ trình cá nhân | `/ca-nhan/lo-trinh` |
| Ngày của lộ trình mặc định | `/ca-nhan/lo-trinh?level=N5&day=1` (P08: ngày 1–3); bỏ `day` tiếp tục ngày chưa hoàn thành đầu tiên; N4–N1 báo chưa có dữ liệu |
| Danh sách / ngày của lộ trình riêng | `/ca-nhan/lo-trinh?tab=my`, thêm `roadmap=<UUID>&day=<ngày>` để giữ chi tiết/ngày qua F5 và quay lại từ Kanji |
| Ôn tập | `/ca-nhan/on-tap?type=kanji` (`vocab`, `grammar`) |
| Chủ động | `/ca-nhan/chu-dong` |
| Trọng âm | `/trong-am` |
| Xếp hạng | `/xep-hang` |
| Luyện viết | `/luyen-viet` |
| JLPT / Đọc hiểu / Shadowing | `/tron-doi/jlpt`, `/tron-doi/doc-hieu`, `/tron-doi/shadowing` |
| Tạo file / Nâng cấp | `/tron-doi/tao-file`, `/nang-cap` |

`/` chuyển về `/kanji` bằng replace. URL không hợp lệ hoặc ID không có trong catalog hiển thị trang Không tìm thấy. Trang chi tiết đọc dữ liệu theo ID nên mở trực tiếp được; nút trở về sử dụng trang nguồn khi có, hoặc trang danh mục. Modal đăng nhập/cài đặt và các tương tác học trong trang giữ nguyên.

Local Vite đã hỗ trợ SPA fallback cho truy cập trực tiếp/F5. Khi triển khai frontend, cấu hình hosting trả `index.html` cho đường dẫn ứng dụng không phải file; giữ `/api` trỏ backend Express, không rewrite API thành HTML. Chưa thay đổi cấu hình deploy vì dự án hiện chạy local.

Admin chạy bằng entry Vite riêng tại `http://localhost:3002` (`npm run dev:admin`): `/admin/kanji`, `/admin/kanji/new`, `/admin/kanji/import`, `/admin/kanji/:id`; `/admin/reading`, `/admin/reading/new`, `/admin/reading/:id`. `/` và `/admin` chuyển về Kanji. Cổng học 3000 chuyển các link `/admin/*` cũ sang cổng 3002. Admin dùng data router để chặn Back/Forward khi có nội dung chưa lưu, phần học cũng dùng data router để xác nhận rời lượt Quiz/Cram chưa lưu và chặn chuyển trang khi đang gửi kết quả C02. [M02](ADMIN_READING.md).

Kiểm tra: `npm run test:routes`, `npm run test:review`, `npm run build`.

C02: admin có `/admin/curriculum`, `/admin/curriculum/new`, `/admin/curriculum/:id`. Trang bài và Review dùng `?mode=flashcard|quiz|cram`; Review mở từ popup chọn bài ở giáo trình, không trỏ sang Ôn tập SRS. [Chi tiết](CURRICULUM.md).
C03: admin có `/admin/grammar`, `/admin/grammar/new`, `/admin/grammar/:id`. Trang học dùng UUID của mẫu xuất bản; đường dẫn ngữ pháp cũ không tự mở câu mẫu thay thế. Chi tiết và bài tập là hai route riêng, ba tab bài tập dùng dữ liệu của đúng mẫu. [Chi tiết](GRAMMAR.md).
