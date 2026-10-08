# Nguồn trọng âm C05

Kanjium của Uros O., giấy phép **CC BY-SA 4.0**. Người dùng đã chọn nguồn này cho C05.

- Repository/README: https://github.com/mifunetoshiro/kanjium
- Phiên bản cố định: `9ebca4589565c696e7c39e089e2e928ad65f678c`.
- `kanjium-manifest.json`: tên file, đường dẫn và SHA-256 kiểm tra trước khi nhập.
- `LICENSE.txt`: nguyên văn giấy phép của nguồn.
- `upstream-columns.txt`: mô tả cột nguyên bản, đặc biệt bảng `conjugations.txt`.
- Ghi công: pitch accent notation provided by Uros O. through Kanjium. NIHONGO chuẩn hóa khóa tìm kiếm, trích đường cao độ sang dữ liệu có cấu trúc, kiểm tra và loại bản trùng. Phần dữ liệu phái sinh vẫn theo CC BY-SA 4.0; không đổi giấy phép mã ứng dụng.

Chỉ tải `data/source_files/raw/accents.txt` và `data/source_files/conjugations.txt`. File gốc được cache ngoài Git trong `apps/api/storage/pitch-accent/<revision>/`; không cần đưa toàn bộ từ điển SQLite hoặc file tạm vào repo. Tra cứu đang chạy chỉ đọc PostgreSQL, không gọi GitHub.

## Nhập dữ liệu

Từ thư mục gốc, sau khi cấu hình DB và chạy migration:

```powershell
npm run pitch:import --workspace @nihongo/api
npm run pitch:import --workspace @nihongo/api -- --commit <previewHash>
```

Lệnh đầu chỉ tải/kiểm tra nguồn, in báo cáo và mã xem trước; không ghi DB. Lệnh thứ hai kiểm tra lại mã trước khi nhập trong một transaction. Nhập lại cùng bản không thêm trùng, không ghi đè nguồn hay nội dung cũ. Đổi bản nguồn/parser cần ID nguồn mới; metadata nguồn đã tạo là bất biến.

## Quy tắc chuyển đổi

- Mỗi dòng `accents.txt` gồm từ, cách đọc, ký hiệu trọng âm. Cách đọc trống chỉ dùng chính từ nếu toàn kana hợp lệ.
- Giữ từng cách đọc và từng biến thể. Nhãn `(名)`, `(代)`, `(副)`, `(形動)`, `(感)` gắn đúng biến thể, tiếp tục áp dụng đến nhãn tiếp theo. Không thêm nghĩa Việt hay JLPT.
- Số trọng âm phải từ 0 đến số mora. Không làm tròn, kẹp giá trị hoặc dùng AI đoán. Bản trùng hoàn toàn bỏ lặp; bản mâu thuẫn loại cả khóa đó.
- Dạng chia ghép bằng đúng từ gốc và cách đọc chuẩn hóa. Chỉ nhận các ô có đường cao độ, trùng một cách đọc trong cột tương ứng. Không tự sinh thể còn thiếu hoặc ghép chỉ theo cách đọc.
- HTML nguồn chỉ được đọc theo cấu trúc `span`/lớp `LH`, `HL`, `H`, `L` đã xác minh, chuyển thành vị trí hạ giọng và kiểm tra lại từng mora. Tuyệt đối không render HTML nguồn.
- Các nhãn dạng chia tiếng Việt là bản dịch tên cột. Nguồn chỉ cho cách đọc kana của dạng chia, nên không tự dựng Kanji cho chúng.

## Kết quả nhập local 05/10/2026

124.137 dòng gốc → **124.132 mục**, **141.986 biến thể**; bỏ 3 bản trùng hoàn toàn và cách ly 2 dòng:

- Dòng 17.848 `ボージョレ・ヌーボー`: cách đọc có ký tự phân cách chưa hỗ trợ.
- Dòng 46.159 `言論機関`: nguồn ghi `8,7` trong khi cách đọc có 7 mora; loại cả dòng, không chọn một giá trị tùy ý.

Nhập **9.224 dạng chia của 999 mục từ** ghép được với `accents.txt`. Dạng khả năng của `有る` ở dòng 1.364 không khớp cột cách đọc nên bị loại. Bốn từ gốc có dạng chia trong file phụ nhưng không ghép được mục từ chính không được tạo thành mục giả. Báo cáo máy đọc: `storage/pitch-accent/<revision>/import-report.json`.

Đây là các ghi nhận của nguồn đã chọn, không tuyên bố bao phủ mọi cách đọc, vùng phương ngữ hoặc đảm bảo bản thu tương ứng. Không có audio chuẩn trọng âm đi kèm bản nhập này.
