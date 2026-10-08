# P09 — Cài đặt học có hiệu lực

Hoàn thành phần triển khai ngày 16/09/2026. Cài đặt tiếp tục thuộc thiết bị, lưu ở `nhai_kanji_settings`; không thêm API/bảng, không đồng bộ vào tài khoản (P11).

## Quy tắc đã được người dùng duyệt

- Font chỉ áp dụng vào vùng chữ Nhật của các màn học. Giữ kiểu khung, bố cục và nhãn hiện có. Thay lựa chọn “Sách giáo khoa Nhật” bằng “Klee One (Nét viết tay)”; nạp Klee One và Noto Sans JP qua Google Fonts, như nguồn font sẵn có của dự án.
- Furigana chỉ điều khiển chú thích kana hiện có ở Đọc hiểu và Shadowing. Ba chế độ: luôn hiện, hiện khi hover/focus/chạm, luôn ẩn. Giữ khoảng trống của phụ chú để khung không nhảy. Không ẩn On/Kun, dòng cách đọc từ vựng, câu hỏi hay đáp án.
- Hai màn này nhận tốc độ/furigana chung khi mở. Chỉnh bằng nút riêng thì chỉ ghi đè trường đó cho lượt mở hiện tại; rời route/F5 sẽ nhận lại giá trị chung. Thay cài đặt chung vẫn có tác dụng khi chưa ghi đè.
- Các nút phát âm còn lại dùng tốc độ chung. Đổi tốc độ trong lúc Đọc hiểu/Shadowing phát sẽ đọc lại câu hiện tại với tốc độ mới.

## Triển khai

- `apps/web/src/features/settings/lib/learning-settings.ts`: giá trị mặc định, danh sách font và chuẩn hóa cài đặt cũ/thiếu/sai. Default Itim cũ chuyển sang Zen Maru Gothic để giữ nét chữ Nhật cũ; UD Digi Kyokasho chuyển Klee One theo lựa chọn đã duyệt. Tốc độ chung 0.6–1.3, bước 0.1.
- `apps/web/src/features/settings/hooks/useLearningSettings.tsx`, `App.tsx`: context nhẹ, lưu thiết bị, CSS variable cho cả modal, đặt tốc độ TTS mặc định, thông báo khi không lưu được hoặc phát âm lỗi.
- `packages/client/styles/base.css`, `index.html`, `SettingsModal.tsx`: nối font, furigana và giữ UI cài đặt; thêm tên truy cập cho đóng/range, trạng thái lựa chọn.
- `apps/web/src/shared/audio/speech.ts`: dùng đúng giọng `ja`, chờ danh sách giọng rỗng tối đa 1 giây; báo lỗi rõ khi thiếu giọng/API hoặc phát thất bại. Mỗi request có hàm hủy riêng; bỏ callback và timer cũ khi thay request/rời màn. Giữ khoảng trắng/dấu câu của nội dung đọc.
- Đọc hiểu/Shadowing dùng helper chung, dọn request/timer và dùng tốc độ hiện tại khi phát lại. Bỏ nhánh phát giả 2.5 giây của Shadowing khi thiếu API. Các màn Chủ động/giáo trình nhận font cho từ/cách đọc/đáp án Nhật; cleanup Chủ động hủy cả request đang chờ giọng.

Không thay dữ liệu học, tiến độ, lịch ôn, ⭐ hoặc route. Timeline ước lượng Đọc hiểu và player/transcript mẫu Shadowing vẫn là phần còn lại của **R02/S01**, không được xem là media thật đã tích hợp.

## Bằng chứng nghiệm thu

- `npm run build`: đạt (TypeScript + Vite). Còn cảnh báo bundle >500 kB đã có, không tách bundle ngoài phạm vi P09.
- `node --experimental-strip-types --test tests/*.test.mjs`: **56/56 đạt**, gồm 43 test FE/shared cũ và 13 test settings/speech mới. Có kiểm tra migrate/round-trip/default/value sai, tốc độ chung/override, giọng tải trễ/timeout/thiếu, không dùng giọng sai ngôn ngữ, callback cũ, cancel request và phát lỗi.
- UI local: chọn Klee One + hover + 1.2x → F5 → cả ba lựa chọn giữ nguyên. Computed font của chữ Kanji/Đọc hiểu theo Klee One, Noto Sans JP và hệ thống; heading tiếng Việt vẫn Itim.
- Đọc hiểu: hover mặc định giấu ruby, Tab từ nút Bản dịch focus chữ đầu → chỉ ruby tương ứng hiện; nút riêng ẩn → kana ẩn. Đổi tốc độ riêng 0.75x, sau đó đổi chung 0.6x/luôn hiện → màn vẫn giữ 0.75x/ẩn. Mở lại màn → trở về 0.6x/hover theo chung lúc đó.
- Shadowing: mở với 0.6x → selector hiển thị đúng giá trị dù ngoài các tốc độ riêng có sẵn. Đổi riêng 1.5x/ẩn → F5 → 0.6x/luôn hiện. Chế độ hover nhận thay đổi từ cài đặt chung khi chưa override; Tab hoặc bấm token hiện kana đúng token, token khác ẩn. Kiểm tra ở viewport hẹp hiện có; chưa kiểm tra bằng thiết bị cảm ứng vật lý.
- Ẩn furigana chung không ẩn dòng từ vựng `へんか`. Bố cục, nút và câu hỏi/đáp án giữ nguyên; nhìn trực tiếp màn Shadowing sau đổi font. Console không có lỗi/cảnh báo trong lượt kiểm tra.
- Trình duyệt kiểm thử **không có giọng Nhật**: nút phát Đọc hiểu hiển thị đúng lỗi tiếng Việt và trở về trạng thái dừng. **Chưa nghe trực tiếp để so sánh tốc độ trên máy có giọng Nhật**; rate/cancellation được xác nhận bằng mock Web Speech API trong unit test. Không cài giọng hệ thống hoặc giả audio để vượt qua giới hạn này.
- Sau QA đã trả cài đặt về Zen Maru Gothic, luôn hiện, 0.9x như trước. Không tạo/sửa dữ liệu tài khoản; không cần chạy lại test backend vì không sửa server.

Tài liệu API/font tham khảo: [SpeechSynthesis.getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices), [Klee One](https://fonts.google.com/specimen/Klee+One). Font web cần tải được Google Fonts; nếu mất kết nối trình duyệt dùng font dự phòng.
