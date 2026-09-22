# M01 — quản trị Kanji

Hoàn thành local ngày 22/09/2026. Người dùng duyệt trang admin riêng, giao diện đơn giản hơn trang học. Route `/admin/kanji`; `/admin` chuyển tới danh sách. Khu học giữ nguyên bố cục và nhãn.

## Sử dụng

1. Mở `http://localhost:3000/admin/kanji`, đăng nhập tài khoản được cấp role `admin`. Dùng phiên email/Google hiện có; Premium không cấp quyền quản trị.
2. Danh sách tìm theo chữ, Hán Việt, nghĩa, cách đọc hoặc ID; lọc JLPT/trạng thái, 25 mục/trang. Tìm kiếm/bộ lọc/trang nằm trong URL. Nội dung bảng là bản nháp mới nhất; mục đã xuất bản nhưng có thay đổi nháp có nhãn riêng.
3. **Thêm Kanji** hoặc **Biên tập**: nhập chữ, nghĩa, Hán Việt, cách đọc, số nét, gợi nhớ, bộ/thành phần, ví dụ và nguồn. Dữ liệu từ điển/nét SVG nằm trong nhóm mở rộng. Không tự tạo nghĩa, số nét hay ví dụ bằng AI.
4. **Lưu bản nháp** chưa đổi trang học. **Xem trước / Xuất bản… → Xác nhận xuất bản** mới đưa bản đã lưu vào catalog học và đồng bộ nội dung thẻ sao. Chưa lưu hoặc có xung đột thì chưa được xuất bản.
5. **Lưu trữ…** ẩn mục khỏi kho học mới, vẫn giữ thẻ sao, tiến độ, lịch sử và khả năng đọc mục đã xuất bản trước đó. Có thể xuất bản lại. Không có nút xóa vĩnh viễn.

ID mới mặc định `k-u<mã Unicode hệ 16>`; ID và ký tự của mục đã tồn tại không được đổi. `n5-v1` tiếp tục 28 chữ/10–10–8. Thêm catalog Kanji không tự mở rộng lộ trình mặc định hoặc tự gắn sao.

Form giữ các trường tùy chọn khi sửa, gồm furigana/cấp độ ví dụ, frequency, dictionaryRadicalNumber và strokePaths. Bộ thủ từ điển không được tự suy từ ID bộ thủ legacy. Tải bản mới nhất sau xung đột phải xác nhận bỏ bản đang nhập; lỗi lưu giữ nội dung để thử lại. Nút đóng/điều hướng trong trang hỏi khi còn thay đổi; F5/đóng tab có cảnh báo trình duyệt.

## Nguồn và nhập JSON

Chọn nguồn thực tế trước khi lưu. **Thêm nguồn** khai báo tên, URL, phiên bản, quyền sử dụng và ghi công; nguồn tự biên soạn có thể dùng URI `urn:nihongo:...` phù hợp. Không tự gán nội dung mới vào KANJIDIC2 hoặc nguồn legacy. URL hiển thị bằng text, không mở các giao thức đầu vào tùy ý.

Metadata nguồn cố định sau tạo; muốn sửa nguồn dùng mã/phiên bản nguồn mới. API `POST /api/admin/content/sources` nhận `{expectedUserId, source}`; lần đầu trả 201, gửi lại đúng metadata trả 200, trùng mã khác metadata trả 409. Không ghi đè nguồn mà bản đã xuất bản đang tham chiếu.

**Nhập JSON** nhận file hoặc text, tối đa 200 mục và 1,5 MiB. Tải mẫu theo một nguồn đã có, điền nội dung; mẫu để trống kiến thức. Cấu trúc:

```text
{
  kind: "kanji",
  entries: [{
    sourceId: mã nguồn,
    expectedVersion: null cho mục mới / phiên bản hiện tại cho mục đã có,
    data: nội dung Kanji đầy đủ
  }]
}
```

Phiên bản hiện tại nằm ở đầu màn biên tập hoặc kết quả preview. **Xem trước** chỉ kiểm tra; bảng chỉ rõ tạo nháp, cập nhật, giữ nguyên, thiếu nguồn, xung đột ID/chữ hoặc phiên bản. Sửa JSON hủy preview cũ. **Xác nhận nhập bản nháp** ghi toàn bộ batch trong transaction; không tự xuất bản. Lỗi hiển thị đường dẫn trường/mục, giữ text; retry chính xác không nhân bản.

## Cấu trúc dữ liệu và bảo vệ

Không cần migration cho M01. Dùng các bảng C01 đã có:

- `kanji_content`: một chữ/ID duy nhất, draft/published JSONB riêng, nguồn cho từng bản, status và version. Các cột cấp/nghĩa/Hán Việt phục vụ truy vấn bản xuất bản; các mảng nhỏ thuộc nội dung một chữ nằm trong JSONB. Chưa cần tách mỗi cách đọc/ví dụ thành bảng riêng.
- `content_sources`: khóa ngoại của nguồn nháp và nguồn xuất bản, không xóa nguồn đang được tham chiếu.
- `review_cards`/`review_events` và các bảng tiến độ giữ nguyên. Transaction publish cập nhật nội dung thẻ, giữ lịch và lịch sử; tăng version chặn màn ôn cũ.
- `users.role`: quyền hiện hành trả từ auth API; server đọc lại role trên mỗi yêu cầu admin. Không cho đăng ký/tự gửi role để nâng quyền.

Mọi thao tác ghi gắn `expectedUserId` của phiên UI và version/hash tương ứng. FE hủy phản hồi cũ khi đổi tài khoản/rời khu quản trị, chặn gửi lặp; server kiểm tra phiên, Origin và quyền. Không nhận dữ liệu localStorage vào quản trị.

Giao diện admin tải thành bundle riêng, dùng lại React Router/Express/Prisma hiện có; không thêm CMS hoặc dependency. Chưa có quản trị tài khoản, bộ thủ, bài đọc, giáo trình/ngữ pháp, sửa metadata nguồn tại chỗ hoặc xuất bản hàng loạt.

## Kiểm thử

- Build frontend/backend đạt; Vite còn cảnh báo bundle trang học >500 kB từ nền hiện có. Admin được tách bundle riêng.
- 59/59 API auth/content: role hiện hành/thu hồi, nguồn bất biến/retry/đồng thời, validation có field path, nháp/publish/import, bảo toàn SRS, xung đột và phân quyền.
- 91/91 FE/shared: 15 ca M01 mới gồm request theo tài khoản, phản hồi cũ/StrictMode, lỗi mạng/quyền, nhãn nháp, parser nhập và roundtrip toàn bộ 111 Kanji không mất trường.
- UI tài khoản QA riêng: đăng nhập, danh sách ở cửa sổ hẹp/desktop, tạo nguồn URN, tạo Kanji nháp → API public 404 → F5 còn nháp → xem trước/xuất bản (bấm đúp chỉ version 1); hai tab lưu xung đột giữ nội dung tab cũ; tải lại có xác nhận; lưu trữ; JSON sai/phiên bản cũ bị chặn, chỉnh input hủy preview, commit bấm đúp chỉ tăng một version; đóng bản chưa lưu hỏi một lần và giữ bộ lọc.
- Thu hồi quyền QA trong lúc trang mở → yêu cầu API kế tiếp trả 403, giao diện chuyển sang thông báo chưa có quyền. Đã dọn tài khoản/phiên/nguồn/Kanji QA, catalog trở lại 111 chữ; không sửa dữ liệu học thật.

Đã cấp role admin cho đúng email người dùng chỉ định `nvk05032005@gmail.com` sau khi kiểm thử, bằng CLI với UUID được tra từ email. Các tài khoản khác giữ quyền cũ. Nếu đang đăng nhập từ trước, mở trang admin hoặc bấm **Kiểm tra lại quyền** để tải role hiện hành.
