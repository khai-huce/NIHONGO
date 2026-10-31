# U03 — Tra Kanji viết tay

## Sử dụng

Mở `/kanji`, viết **một chữ** trong vùng **Hoặc vẽ Kanji**, rồi bấm **Tra chữ**. **Hoàn tác** bỏ nét cuối; **Xóa nét** xóa toàn bộ. Bấm chữ gợi ý để mở chi tiết đã xuất bản. Chữ chưa có trong kho vẫn hiện nhưng khi chọn sẽ báo thiếu nội dung. Không ép ứng viên về các chữ trong database.

Khách được dùng. Nét vẽ và kết quả chỉ giữ trong lượt mở, không ghi DB/localStorage, không thêm sao/XP/tiến độ. Không chấm thứ tự nét. Nhận diện có thể nhầm, đặc biệt các chữ gần giống như 口/囗; người học chọn ứng viên phù hợp. Không hiển thị xác suất như độ chính xác được bảo đảm.

## Kiến trúc

- `apps/web/src/features/kanji/components/HandwritingLookup.tsx`: Pointer Events chuột/chạm/bút, canvas theo DPR, nét chuẩn hóa giữ hình dạng khi resize, hủy request và kiểm tra revision khi sửa/xóa/rời trang. Giữ khung vẽ cũ, thêm đúng Tra chữ/Hoàn tác/hàng gợi ý đã duyệt.
- `apps/api/src/modules/handwriting`: kiểm tra input, raster hóa 64×64 nét trắng/nền đen, nhận diện ONNX CPU, đối chiếu `loadKanjiCatalog` (chỉ published). `app.ts` chỉ ghép route.
- `POST /api/handwriting/recognize`: `{strokes: [[[x,y], ...], ...]}`; tọa độ hữu hạn 0–1. Tối đa 40 nét, 512 điểm/nét, 4096 điểm tổng, JSON 180 KB; 30 yêu cầu/IP/phút, tối đa 2 lượt suy luận đồng thời trong một process. Kiểm tra Origin và JSON chung của API vẫn áp dụng. Không gọi Gemini hoặc gửi nét ra dịch vụ bên ngoài.
- Kết quả `{candidates:[{character,item}]}`; `item` là snapshot Kanji published hoặc null. Tối đa 8 ứng viên Han theo điểm mô hình, loại điểm dưới 0.001 (chỉ là lọc nhiễu, không phải ngưỡng bảo đảm chính xác). Không lưu kết quả nhận diện vào catalog.
- Mô hình được tải một lần, kiểm SHA-256 trước sử dụng. Thiếu/hỏng mô hình trả 503 có thông báo, không dùng kết quả mẫu. Không nhận URL/file path từ khách.

## Triển khai

Cài dependency từ root bằng `npm ci`, chạy API như cũ. Giữ thư mục `apps/api/content/handwriting` khi triển khai cả source hoặc `dist`; đường dẫn mô hình được giải quyết theo module, không theo thư mục chạy lệnh. Không cần migration, Python, API key hoặc dịch vụ trả phí. ONNX Runtime dùng CPU; bộ cài cần đúng nền tảng máy chủ. Dữ liệu nguồn/giấy phép/hash nằm trong README cạnh mô hình.

## Nghiệm thu local 28/10/2026

- Mô hình thật nhận nét tự viết 一/十 và đưa 口 trong ba gợi ý đầu cho hình chữ nhật ngang; không dùng mock. Hình chữ nhật đứng gần vuông có thể trả 囗 thay 口, đã ghi nhận giới hạn này.
- 6 kiểm thử U03 + 19 content + 2 Origin đạt; TypeScript tests đạt. 186 kiểm thử FE/admin/shared đạt; build API/web và check:boundaries đạt.
- UI desktop và viewport 390px: vẽ 十 → gợi ý 十 → mở `/kanji/k-10`; 士 báo chưa có trong kho; hoàn tác 十 còn 一; xóa trong lúc tra không khôi phục ứng viên cũ. Nét được vẽ bằng thao tác chuột trên trình duyệt; chưa kiểm thử bút/cảm ứng vật lý.
- Không ghi nội dung thử vào DB chính, không đổi quyền tài khoản. API dev đã khởi động lại để nạp mô hình mới.
