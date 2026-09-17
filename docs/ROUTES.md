# Điều hướng frontend

Dùng React Router với BrowserRouter. URL là nguồn xác định trang và mục sidebar đang chọn; không còn activeTab hoặc đối tượng chi tiết lưu riêng trong App để chuyển trang.

| Trang | URL |
|---|---|
| Hán tự / chi tiết | `/kanji`, `/kanji/:id` (ví dụ `k-1`) |
| Giáo trình từ vựng | `/tu-vung/giao-trinh` |
| Bảng chữ cái | `/tu-vung/bang-chu-cai` |
| Ngữ pháp / chi tiết | `/ngu-phap`, `/ngu-phap/:id` (ví dụ `s-ka`) |
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

Kiểm tra: `npm run test:routes`, `npm run test:review`, `npm run build`.
