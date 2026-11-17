# Toast Notification cho NIHONGO và admin

Hoàn thành local ngày 17/11/2026 theo yêu cầu thêm toast cho hai ứng dụng.

## Hành vi

- Toast hiện góc phải phía trên; trang học dùng màu giấy/khung nét vẽ, admin dùng khung trắng đơn giản. Không đổi bố cục trang hay các nhãn chức năng.
- Bốn loại: thành công, lỗi, cảnh báo, thông tin. Có nút đóng bằng chuột/bàn phím; lỗi dùng `role="alert"`, các loại khác dùng `role="status"`.
- Tự đóng sau 5 giây; lỗi sau 8 giây. Tạm dừng đếm khi rê chuột, focus bàn phím hoặc tab bị ẩn.
- Tối đa ba toast; gộp nội dung cùng loại đang hiện. Sau khi đóng, thao tác mới có thể báo lại cùng nội dung.
- Toast tồn tại qua chuyển route; F5 hoặc đổi tài khoản xóa toast cũ. Callback của tài khoản cũ không ghi vào kho toast mới.
- Toast nằm trên native modal và màn fullscreen. Màn nhỏ tự co theo chiều rộng; có hỗ trợ reduced motion và màu tối của trang học.
- Thành công chỉ được phát sau khi thao tác tương ứng xác nhận thành công; xem trước/tải lại không giả thành thông báo đã lưu. Các lỗi biểu mẫu, nút thử lại và kết quả học chi tiết vẫn giữ tại vị trí hiện có.

## Các điểm đã nối

| Phần | Thông báo |
| --- | --- |
| Tài khoản web/admin | Đăng nhập, đăng xuất, lỗi phiên và lỗi biểu mẫu đăng nhập; tải phiên ban đầu không báo đăng nhập mới |
| Admin Kanji/Đọc hiểu/Giáo trình/Ngữ pháp/Shadowing/JLPT | Notice và lỗi của editor: lưu nháp, xuất bản, lưu trữ/khôi phục và thao tác tương ứng sẵn có; thông báo nhập Kanji thành công |
| Chủ động | Tạo, sửa, xóa bài; nhập từ hiển thị số thêm/bỏ trùng; lỗi tải/lưu |
| Lộ trình cá nhân | Tạo, sửa, xóa; lỗi tải/lưu; khách được ghi rõ lưu trên thiết bị |
| Ôn tập | Gắn/bỏ sao, reset lịch và lỗi; không bật toast thành công cho từng đánh giá thẻ |
| Giáo trình từ vựng | Kết quả/lỗi thêm cả bài vào Ôn tập |
| Đọc hiểu cá nhân | Tạo/xóa bài; lỗi và thành công sau áp dụng dịch/furigana, từ/ngữ pháp, câu hỏi |
| Shadowing | Lỗi nhập và thành công sau lưu video/phụ đề |
| Phát âm/cài đặt thiết bị | Cảnh báo TTS và lỗi lưu cài đặt; thử phát âm lại có thể báo lại lỗi đã đóng |

Các kết quả quiz, trạng thái tải, lỗi riêng từng ô và phản hồi học tập tiếp tục hiển thị trong giao diện chức năng. Không dùng interceptor để biến mọi HTTP 200 thành toast hoặc tự báo thành công khi xem trước.

## Tổ chức mã và cách dùng

- `packages/client/src/toast/store.ts`: kho toast trong bộ nhớ, độc lập theo provider/tài khoản.
- `packages/client/src/toast/ToastProvider.tsx`: context, viewport/portal, timer và feedback hooks.
- `packages/client/styles/toast.css`: kiểu web/admin và responsive.
- Hai app đặt `ToastProvider` tại root, `scope` theo UUID tài khoản hoặc `guest`.
- Không thêm dependency ngoài React/ReactDOM đã có, không tạo API, bảng hay migration. Toast khác với chuông nhắc ôn O01; không lưu lịch sử thông báo.

```tsx
import { useToast, useToastFeedback } from '@nihongo/client/toast';

const toast = useToast();
// Trong handler: kiểm tra phản hồi, phiên/tài khoản và mounted trước dòng này.
toast.success('Đã lưu bài học.');
// Hoặc nối trạng thái feedback sẵn có; giữ lỗi có ngữ cảnh trong biểu mẫu.
useToastFeedback({ success: notice, error });
```

Không gọi đồng thời cả hai cách cho cùng thao tác. `useToastFeedback` chỉ phát khi giá trị thay đổi; handler phải xóa lỗi/notice cũ trước lượt mới. Luồng sự kiện lặp như phát âm gọi `useToast` trực tiếp.

## Nghiệm thu

- `npm run test:frontend`: 232/232 đạt, gồm bốn ca toast về chống lặp, giới hạn số lượng, callback tài khoản cũ và subscription/snapshot.
- `npm run check:boundaries`: 258 file nguồn hợp lệ.
- Build web/admin/API đạt; web được build lại sau sửa cảnh báo phát âm và điểm thông báo apply A04. Còn cảnh báo Vite chunk trên 500 kB như trước, không phải lỗi build.
- UI thật trên DB QA riêng: tạo/đổi tên bài Chủ động; lưu nháp giáo trình admin rồi đổi route vẫn thấy toast; focus giữ toast, đóng thủ công, tự đóng; nhập sai mật khẩu báo lỗi ngay trên native dialog; đăng nhập đúng xóa lỗi cũ và báo thành công.
- Admin desktop 1280px và mobile 390px: toast không bị che hoặc tràn ngang (mép trái 12px, mép phải khoảng 378px tại viewport 390px). Trang học kiểm tra ở viewport hẹp 418px. TTS thiếu giọng Nhật báo cảnh báo, đóng rồi thử lại hiện lại.
- Ảnh tại `.artifacts/toast/web-success.png`, `admin-success.png`, `admin-error-dialog.png`, `admin-mobile-error.png` (artifact local, không commit).
- Không gọi Gemini hoặc nhà cung cấp AI; không thay schema/dữ liệu chính. Dữ liệu thử ở DB `nihongo_a05_ui_test`, quyền admin và phiên QA được thu hồi khi kết thúc.
- Chưa thao tác từng editor để xuất bản nội dung thật trong lượt này; tích hợp dùng cùng hook feedback và đã kiểm tra TypeScript/build. Không dùng nội dung thật để thử phá lỗi.
