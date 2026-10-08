# Từ vựng N5 — file nhập giáo trình NIHONGO

Bản `vi-v1`, ngày 30/09/2026: **662 mục từ, 10 nhóm theo hàng kana, 31 bài, 8–25 từ/bài**. Đây là giáo trình tham khảo riêng, không phải Tango và không phải danh mục từ chính thức do JLPT công bố.

## File nào dùng để nhập?

Chỉ chọn **`tu-vung-n5.json`** ở chức năng Nhập JSON của giáo trình.

- `source.json`: thông tin để điền vào form **Thêm nguồn**, không nhập bằng nút Nhập JSON giáo trình.
- `DOI_CHIEU.md`: bảng Nhật – cách đọc – nghĩa Việt – nghĩa Anh gốc để rà soát.
- `review.json`: bản đối chiếu đầy đủ theo ID, giữ cả cách viết/cách đọc gốc và ghi chú sửa đổi.
- `validation.json`: kết quả kiểm tra cấu trúc, số lượng, ID và dữ liệu cho các chế độ học.
- `sources/LICENSE`, `sources/NOTICE.md`: giấy phép và ghi công của bộ nguồn.

## Nhập vào admin

1. Đăng nhập admin, mở http://localhost:3002/admin/curriculum → **Thêm giáo trình**.
2. Điền tên **Từ vựng N5**, đường dẫn **tu-vung-n5**. Không chọn một giáo trình cũ đang có dữ liệu để thử nhập, vì xác nhận nhập sẽ thay nội dung bản nháp đang sửa.
3. Chọn **Nhập JSON**, mở `tu-vung-n5.json` → **Kiểm tra và xem trước**. Kết quả đúng là **10 chủ đề / 31 bài / 662 từ**.
4. Chọn **Xác nhận dùng bản nhập**. File để `sourceId: null` để nhập được ở database chưa tạo nguồn này.
5. Chọn **Thêm nguồn** và chép các trường trong `source.json`. Thông tin chính:

   | Trường | Giá trị |
   |---|---|
   | Mã nguồn | `openjlpt-n5-c42fd9fa-vi-v1` |
   | Tên | Từ vựng N5 — OpenJLPT, bản dịch Việt nháp v1 |
   | URL | https://github.com/evanclan/OpenJLPT/tree/c42fd9fa3777bfc1775446f7c418d549dfd6e4cf |
   | Giấy phép | CC BY-SA 4.0 |
   | URL giấy phép | https://creativecommons.org/licenses/by-sa/4.0/ |
   | Phiên bản | `c42fd9fa3777bfc1775446f7c418d549dfd6e4cf / NIHONGO vi-v1` |

   Chép nguyên phần `attribution` vào Ghi công và `notes` vào Ghi chú. Nếu form không có trường checksum thì không cần nhập checksum. Khi nguồn đã được tạo, chọn nguồn đó cho giáo trình.
6. **Lưu bản nháp → Xem trước nội dung**. Rà soát nghĩa tiếng Việt rồi **Xuất bản → Xác nhận xuất bản** khi bạn sẵn sàng.
7. Trang học: http://localhost:3000/tu-vung/giao-trinh/tu-vung-n5. Ba phương pháp chính có dữ liệu: Flashcard, Trắc nghiệm và Nhồi nhét với lựa chọn **Cách đọc**.

Bản bàn giao chỉ tạo file, **chưa ghi vào database hoặc xuất bản thay bạn**. Giao diện và mã chức năng của ứng dụng không thay đổi trong lượt tạo dữ liệu này.

## Nội dung và giới hạn

- Danh mục, từ, cách đọc và nghĩa Anh lấy từ OpenJLPT tại commit được ghi phía trên; nguồn phân cấp của OpenJLPT là Jonathan Waller/Tanos, nghĩa/cách đọc dựa trên JMdict/EDICT.
- **Nghĩa tiếng Việt do AI hỗ trợ biên soạn và chưa được người dùng duyệt từng mục.** Trạng thái này nằm ngay trong phụ đề và mô tả giáo trình. Nghĩa Anh gốc giữ trong file đối chiếu, không trộn vào câu hỏi tiếng Việt.
- Chia bài theo hàng kana là cách tổ chức riêng cho bản này, không phải chủ đề gốc của OpenJLPT. Mỗi nhóm bao gồm cả âm đục/bán đục tương ứng; từ katakana được quy về hiragana khi xếp thứ tự.
- Chọn một dạng viết/cách đọc cho mỗi mục để bài gõ có một đáp án rõ ràng. Các biến thể gốc vẫn có trong `review.json`. Riêng キロ được dùng dạng đầy đủ キログラム và キロメートル để phân biệt hai đơn vị.
- Với từ chỉ có kana, dùng chính kana làm cách đọc. Furigana của từ có Kanji đặt trên toàn từ, không tự suy ra cách đọc từng chữ.
- Chưa có Hán Việt, từ loại, ví dụ hoặc audio riêng trong file này. Các trường tương ứng để trống; Nhồi nhét **Âm Hán** không có dữ liệu. Không lấy các ví dụ Tatoeba của bộ tổng hợp vào giáo trình này vì chưa rà soát độ phù hợp và nguồn từng câu.
- Không quảng cáo bộ này là “đủ 1000 từ” hoặc “đầy đủ mọi từ thi N5”. Số lượng đúng của bản này là 662.

## Những sửa đổi dữ liệu được ghi lại

| Mục trong bản nguồn (index từ 0) | Sửa đổi |
|---|---|
| 82 — せっけん | Nghĩa Anh `economy` được sửa thành `soap`; nghĩa Việt: xà phòng. Đối chiếu https://jisho.org/search/せっけん |
| 193 — 一日 | Với cách đọc いちにち chỉ dùng nghĩa một ngày; không gộp ngày mùng một của cách đọc ついたち. Đối chiếu https://www.mitsumura-tosho.co.jp/webmaga/kotoba-to-manabi/kotoba/detail12 |
| 353, 461, 596, 655 | Thêm する vào 散歩, 掃除, 勉強, 練習 để chữ hiển thị khớp cách đọc và nghĩa động từ đã có trong nguồn. |
| 418 — 上げる | Dùng あげる cho nghĩa cho/tặng, tránh lẫn nghĩa nâng lên. Đối chiếu https://jisho.org/search/上げる |
| 557 — 伯父/叔父 | Nguồn ghép sai chữ với おじいさん và nghĩa grandfather. Giữ cách đọc/nghĩa, sửa chữ thành おじいさん. Đối chiếu https://jisho.org/search/おじいさん |
| 568 — 半分 | Sửa `half minute` thành `half`; nghĩa Việt: một nửa. Đối chiếu https://jisho.org/search/半分 |

Các sửa đổi trên không có nghĩa toàn bộ dữ liệu đã được chuyên gia ngôn ngữ nghiệm thu. Bản dịch Việt vẫn là bản cần rà soát như đã chốt.

## Giấy phép và ghi công

Bộ dữ liệu chuyển đổi và phần dịch được cung cấp theo **CC BY-SA 4.0**. Được sử dụng và chỉnh sửa, kể cả thương mại, với yêu cầu ghi công, dẫn giấy phép, chỉ rõ thay đổi và chia sẻ bản dữ liệu phái sinh theo cùng giấy phép. Đây là giấy phép của **dữ liệu**, không phải thay đổi giấy phép mã nguồn NIHONGO.

Ghi công: **OpenJLPT; Jonathan Waller (Tanos); JMdict/EDICT — James William Breen và Electronic Dictionary Research and Development Group (EDRDG). Chuyển đổi, chia bài và bản dịch tiếng Việt: NIHONGO, AI hỗ trợ, cần rà soát.**

- OpenJLPT: https://github.com/evanclan/OpenJLPT
- Nguồn và điều kiện của OpenJLPT: https://github.com/evanclan/OpenJLPT/blob/c42fd9fa3777bfc1775446f7c418d549dfd6e4cf/NOTICE.md
- Jonathan Waller: https://www.tanos.co.uk/jlpt/ và https://www.tanos.co.uk/jlpt/sharing/
- EDRDG: https://www.edrdg.org/edrdg/licence.html
- Giấy phép: https://creativecommons.org/licenses/by-sa/4.0/

Giữ phần ghi công/giấy phép khi chia sẻ file. Khi công khai nội dung trên website, cung cấp ghi công và liên kết nguồn/giấy phép cho người học truy cập được; không chỉ giữ trong database admin. Mô tả giáo trình hiện đã chứa phần ghi công; không xóa phần này nếu chưa có vị trí ghi công thay thế phù hợp. Kiểm tra hướng dẫn cập nhật của EDRDG khi duy trì kho từ điển công khai.

## Tái tạo và kiểm tra

Từ thư mục gốc dự án:

```powershell
node docs/data/tu-vung-n5/build.mjs
```

Sau đó, từ thư mục `apps/api`:

```powershell
node --import tsx scripts/validate-n5-curriculum.ts
```

Builder dùng snapshot đã chốt, không tự tải bản mới và không kết nối database. ID từ được tạo ổn định từ từ/cách đọc nguồn; giữ ID khi sửa nghĩa. Không tự sắp xếp lại hoặc chuyển từ sang bài khác của giáo trình đã có tiến độ bằng một lần nhập: backend giữ quan hệ ID với bài gốc. Muốn nâng phiên bản danh mục/phân bài sau này cần rà soát thay đổi trước.
