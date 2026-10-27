# P12/P13 — Flashcard và luyện viết bảng chữ cái

Hoàn thành local ngày 27/10/2026 theo lựa chọn của người dùng: Flashcard chỉ lật/nghe/chuyển thẻ, không lưu tiến độ; luyện viết tự do có chữ mẫu, chưa hướng dẫn thứ tự hoặc chấm nét.

## Cách sử dụng

1. Mở **Từ vựng → Bảng chữ cái** (`/tu-vung/bang-chu-cai`).
2. Chọn **Hiragana** hoặc **Katakana**. Có thể bấm một chữ trong bảng để nghe và chọn chữ bắt đầu; chưa chọn thì bắt đầu từ あ/ア.
3. Bấm **Flashcard**: mặt trước là chữ, mặt sau là romaji. Bấm giữa thẻ để lật, nút loa để nghe và hai mũi tên để chuyển; phím ←/→ để chuyển, Space để lật và R để nghe. Khi đang focus một nút, Space kích hoạt chính nút đó theo hành vi bàn phím chuẩn.
4. Bấm **Luyện viết**: dùng chuột, bút hoặc cảm ứng để vẽ theo mẫu. **Hoàn tác** bỏ nét cuối, **Xóa nét** xóa toàn bộ, **Ẩn/Hiện chữ mẫu** thay đổi phần mẫu. Hai mũi tên đổi chữ; có loa nghe chữ đang luyện.
5. Đóng bằng nút X hoặc Esc. Chuyển chữ/đóng khung/F5 bỏ nét vẽ; việc đổi kích thước cửa sổ giữ các nét của chữ đang mở.

Mỗi bảng dùng đủ 104 mục của `kana-v1` (46 âm trong, 25 âm đục/bán đục, 33 âm ghép). Không đổi ID, thứ tự hoặc cách chấm của quiz nghe P10. Flashcard dừng ở đầu/cuối bộ; luyện viết có thể chuyển vòng. Mở lại khung bắt đầu từ chữ được chọn trên bảng, không khôi phục lượt trước.

## Dữ liệu và phạm vi

- Dữ liệu chữ/romaji dùng lại `packages/shared/src/study/kana-quiz.mjs` đã có. Không thêm nội dung mẫu hoặc gọi AI.
- Hai chức năng chạy thật tại trình duyệt, dùng được cho khách; không ghi localStorage, API hay database, không ghi XP hoặc SRS. Kết quả quiz nghe vẫn theo cơ chế P10 hiện có.
- Phát âm dùng `speakJapanese`, kế thừa tốc độ học đã cài và chỉ dùng giọng Nhật trên thiết bị; thiếu giọng sẽ có thông báo ngay trong khung. Không dùng giọng ngôn ngữ khác thay thế.
- Chữ hiển thị kế thừa font Nhật đã chọn. Chữ mẫu chỉ là hình chữ từ font, không phải dữ liệu thứ tự nét và không dùng để tự chấm đúng/sai.
- Nút **Tải file luyện viết** thuộc U01, chưa triển khai trong P12/P13.

## Mã nguồn

- `apps/web/src/features/kana/pages/AlphabetPage.tsx`: nối nút, chữ chọn bằng chuột/bàn phím, sửa hướng dẫn cũ từng hứa thứ tự nét.
- `features/kana/components/KanaStudyDialog.tsx`: modal native, focus/đóng/khôi phục focus, chặn tương tác nền.
- `KanaFlashcards.tsx`, `KanaWriting.tsx`: thao tác học và phát âm, hủy audio khi chuyển/đóng/tab ẩn.
- `KanaDrawingCanvas.tsx`, `features/kana/lib/kana-writing.ts`: Pointer Events, bắt/nhả con trỏ, chuẩn hóa tọa độ, vẽ lại theo kích thước và DPR. Không sao chép canvas Kanji cũ có lỗi tỷ lệ tọa độ.

## Nghiệm thu

- 186/186 kiểm thử frontend/admin/shared đạt, gồm 4 ca tọa độ/DPR/giới hạn vùng vẽ; build web và kiểm tra ranh giới import đạt.
- UI thật: cả hai bảng, âm đơn/ghép, bắt đầu từ chữ chọn, lật nút/Space, chuyển nút/mũi tên, khóa đầu/cuối Flashcard, loa báo thiếu giọng, Esc và trả focus về nút mở.
- Vẽ bằng chuột ở desktop và viewport 390 px; hoàn tác bỏ đúng nét cuối, xóa hết, ẩn mẫu, chuyển chữ xóa nét, đổi kích thước giữ đúng tỷ lệ nét. Canvas được lập trình Pointer Events cho cảm ứng/bút; lượt QA này không có thiết bị cảm ứng/bút thật.
- Mở Flashcard khi quiz đang ở câu 1: phím 1/Space/mũi tên trong modal không trả lời quiz phía sau; đóng lại vẫn 0/104. Flashcard mở được cả khi API chưa chạy vì không phụ thuộc tiến độ tài khoản.
- Trình duyệt QA không có giọng Nhật: đã kiểm tra thông báo và kiểm thử speech, chưa nghe nghiệm thu phát âm trên thiết bị này.
- Ảnh tại `.artifacts/kana-p12-p13/`; không thêm dữ liệu học, migration hoặc thay quyền tài khoản.

## Cập nhật giao diện 28/10/2026

Theo ảnh người dùng: modal xanh đậm, chữ/romaji giữa khung, hai mũi tên, dải phím tắt và thanh điều khiển phía dưới. Có đổi chiều Chữ/Romaji, học lại, tự động lật (2/3/5/8 giây mỗi mặt), trộn và cài đặt. Hai nút biết/chưa biết (Z/X) chỉ đánh dấu trong RAM của lượt mở và chuyển thẻ; đóng/F5/học lại/trộn xóa đánh giá, không lưu tài khoản. Tự động lật không tự đánh giá, dừng khi tab ẩn hoặc đến cuối bộ.

Nghiệm thu: build web, 186/186 FE/admin/shared và check:boundaries đạt; đối chiếu desktop và 390px, lật/chuyển/đổi chiều, đánh giá tạm, tự động chạy, trộn, mở lại và Esc cửa sổ cài đặt đã kiểm tra trên trình duyệt. Phát âm dùng nguyên cơ chế trước; chưa nghiệm thu nghe giọng Nhật trên máy QA.
