# C05 — Tra cứu pitch accent

## Phạm vi đã chốt

Người dùng chọn Kanjium (CC BY-SA 4.0), chỉ hiện dạng chia có nguồn; thiếu báo thiếu. Giữ nút loa TTS với ghi chú **“Phát âm tham khảo, không đảm bảo đúng biến thể trọng âm”**. Giữ trang `/trong-am`, tiêu đề/ô nhập/khung nét vẽ và cách mở danh sách dạng chia. Không dùng Gemini hoặc Kuromoji để đoán trọng âm.

## Cách dùng

1. Mở **Trọng âm**, nhập từ bằng Kanji, hiragana, katakana hoặc romaji Hepburn, ví dụ `切る`, `あめ`, `アメ`, `ame`. Tìm tiền tố, ưu tiên từ/cách đọc khớp đầy đủ; hỗ trợ kana nửa chiều rộng.
2. Mỗi mục có đường cao độ, số trọng âm `[n]`, loại Heiban/Atamadaka/Nakadaka/Odaka và nguồn thật. Khi có nhiều biến thể, hiển thị tất cả, giữ nhãn từ loại của nguồn. `x1` nghĩa là một nguồn Kanjium cho mục này; không đếm biến thể thành nhiều nguồn.
3. Mở **Hiện dạng chia** nếu có dữ liệu. Ví dụ `切る` có 10 dạng được nguồn ghi nhận; không tự thêm dạng phủ định khi file nguồn không có trọng âm của dạng đó. Dạng chia chỉ có kana thì giữ kana.
4. Nút loa phát theo cách đọc đang chọn, dùng tốc độ cài đặt học. TTS không chọn được biến thể trọng âm. Thiết bị thiếu giọng Nhật sẽ báo rõ; không phát bằng giọng khác hay giả bản thu chuẩn.

Không tìm theo nghĩa Việt vì nguồn này không có dữ liệu nghĩa. Không yêu cầu tài khoản; không lưu lịch sử tìm kiếm, không tạo sao/XP/tiến độ. F5 trở về ô nhập trống; dữ liệu từ điển vẫn lấy từ database khi tra lại.

## Database và API

- Migration cộng thêm: `apps/api/prisma/migrations/202610040003_pitch_accent/migration.sql`; không reset hoặc sửa migration cũ.
- `pitch_accent_entries`: ID ổn định, từ/cách đọc, khóa tìm kiếm chuẩn hóa/romaji, biến thể, các dạng chia có cấu trúc, nguồn/dòng/ký hiệu gốc, trạng thái `published`.
- Tái sử dụng `content_sources`; metadata nguồn bất biến, xóa bị chặn khi có mục tham chiếu. ID nguồn gắn revision, checksum và ghi công. Dữ liệu trọng âm tách khỏi từ vựng giáo trình, thẻ ôn hoặc dữ liệu cá nhân.
- `GET /api/pitch-accent?q=...&offset=0&limit=20`: public, tối đa 100 ký tự; limit 1–50, offset 0–1.000.000. Trả `items`, `total`, `offset`, `limit`, `hasMore`, `catalogReady`. Truy vấn trống không trả toàn bộ kho.
- Chỉ tìm mục published; SQL tham số hóa, escape ký tự LIKE, thứ tự ổn định và tổng/trang cùng snapshot transaction. Dữ liệu JSON/mora/vị trí trọng âm không hợp lệ trả lỗi, không fallback mock.
- Client đợi 300 ms sau nhập, chờ IME hoàn tất, hủy yêu cầu cũ và dùng số phiên yêu cầu để chặn kết quả cũ khi gõ A → B → A. Lỗi mạng khác với không có kết quả; có thử lại.
- Frontend: `apps/web/src/features/pitch-accent`; backend: `apps/api/src/modules/pitch-accent`; contract và quy tắc mora/đường cao độ trong `packages/shared`.

Mốc này nhập dữ liệu bằng script có preview/hash, chưa xây trang quản trị trọng âm mới. Bảng dữ liệu/nguồn riêng sẵn để task quản trị sau sử dụng; không gộp vào CMS tổng quát. Muốn chỉnh hoặc đổi nguồn phải giữ xuất xứ và kiểm tra nội dung, không sửa hàng loạt nguồn đã nhập để ghi công sai.

## Nguồn và vận hành

Xem [manifest, giấy phép và hướng dẫn nhập](../apps/api/content/pitch-accent/README.md). Đã nhập local 124.132 mục/141.986 biến thể, 9.224 dạng chia trên 999 mục; import toàn bộ trong transaction, giữ dữ liệu người dùng. Bulk nguồn cache trong `apps/api/storage/pitch-accent/` (ngoài Git), không gửi xuống frontend; website chỉ tải từng trang kết quả.

## Nghiệm thu

- Kiểm thử nhập: nhãn từ loại/biến thể, mora, dòng không hợp lệ, HTML không an toàn, ghép đúng từ và cách đọc, preview sai bị chặn, nhập lặp không trùng và metadata bất biến.
- Kiểm thử API: khách, từ đồng âm, nhiều biến thể, kana/romaji, phân trang/tổng thật, ký tự đặc biệt, loại nháp, nguồn dạng chia, không ghi phiên/học/XP.
- Kiểm thử frontend/shared: mora nhỏ/っ/ん/ー, Heiban/đầu/giữa/cuối, biến thể không hợp lệ, debounce/IME, đổi câu/đổi trang/mất mạng/thử lại/unmount và phản hồi cũ.
- 20/20 ca C05 backend (11 API + 9 import), 133/133 frontend/shared đạt. Lượt backend toàn bộ 311/313 đạt; hai ca A03/C02 timeout khi môi trường gián đoạn kết nối đã chạy lại đúng tên ca và đạt 2/2, không sửa hoặc bỏ kiểm tra. Nhật ký: `.artifacts/logs/pitch-accent/tests-api.log`, `tests-timeout-rerun.log`, `tests-frontend-final.log`.
- Build web/admin/API, TypeScript test và ranh giới import 167 file đạt. UI local: trang trống, từ có nhiều biến thể, dạng chia, không có dữ liệu, phân trang, F5, kana nửa chiều rộng, desktop 1366 và mobile 390 không tràn ngang. Ảnh đối chiếu: `.artifacts/pitch-accent-desktop.jpg`. Chi tiết tại hàng C05 trong `FEATURE_BACKLOG.md`.

Giới hạn âm thanh: trình duyệt nghiệm thu không có Japanese Voice, đã kiểm tra thông báo thiếu giọng và unit test luồng gọi TTS. Chưa nghe nghiệm thu audio tiếng Nhật trên thiết bị này; không coi TTS là audio minh họa trọng âm.
