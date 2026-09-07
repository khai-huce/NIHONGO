**Plan: Express backend, database và đăng nhập thật cho NIHONGO**

Ngày lập: 08/09/2026.

Trạng thái: Đã chốt phạm vi theo câu trả lời của người dùng. Chưa triển khai backend hoặc thay đổi luồng đăng nhập. Đang xác định người dùng đã có cấu hình Google OAuth hay cần hướng dẫn tạo.

**Mục tiêu và phạm vi đã chốt**

Hoàn thành một luồng chạy xuyên suốt: đăng ký tài khoản → đăng nhập → tải lại trang vẫn nhận đúng người dùng → đăng xuất và vô hiệu phiên trên server. Tài khoản tồn tại trong PostgreSQL và dùng được ở trình duyệt khác bằng cách đăng nhập lại.

Người dùng đã chọn:

- Đăng nhập bằng email/mật khẩu và Google ngay trong đợt này.
- PostgreSQL chỉ lưu tài khoản và phiên đăng nhập.
- Chạy local để kiểm thử; chưa chọn nơi triển khai online.

Đợt này hoàn thành API xác thực và kết nối giao diện hiện có. Dữ liệu học tiếp tục ở thiết bị. Đồng bộ, quản lý nội dung, FSRS, thanh toán, xác minh email, quên mật khẩu qua email và triển khai public là công việc sau mốc local này.

**Căn cứ từ code hiện tại**

- `src/components/AuthModal.tsx`: cả đăng nhập email và Google đều dùng `setTimeout` để tạo người dùng giả; Google đang tự gán Premium.
- `src/App.tsx`: đọc và ghi tài khoản bằng khóa `nhai_kanji_user`; đăng xuất chỉ xóa trạng thái phía frontend.
- `src/components/TopHeader.tsx`: đã có giao diện người dùng và nút đăng xuất, có thể nối vào API mới.
- `src/types/index.ts`: đã có `UserProfile`; cần giữ định dạng phản hồi tương thích với giao diện.
- Nội dung học nằm ở file TypeScript; nhiều dữ liệu học khác lưu trong localStorage theo trình duyệt, chưa tách theo tài khoản.
- Node.js 22.20.0 và npm 10.9.3 có trên máy. Có Docker CLI nhưng lần kiểm tra này không kết nối được Docker Engine; chưa tìm thấy `psql` trên PATH. Điều này chưa chứng minh máy không có PostgreSQL.
- Đang có thay đổi chưa commit trong frontend; khi triển khai phải đọc và giữ các thay đổi đó.

**Thiết kế vừa đủ cho đợt này**

- Giữ frontend trong `src/`; thêm `server/` có package.json và tsconfig riêng. Dùng npm như hiện tại.
- Backend: Express + TypeScript, Prisma cho dữ liệu tài khoản, PostgreSQL làm nơi lưu dữ liệu.
- Session: `express-session` + `connect-pg-simple`, dùng cùng PostgreSQL. Cookie chứa mã phiên; thông tin phiên ở server. Session chỉ giữ định danh người dùng, hồ sơ và Premium đọc từ database.
- Băm mật khẩu bằng Argon2id; Zod kiểm tra đầu vào; giới hạn số lần gọi các API đăng nhập/đăng ký và middleware xử lý lỗi chung.
- Google: dùng Google Identity Services ở frontend và thư viện chính thức `google-auth-library` để xác minh ID token ở backend; sau đó dùng cùng session nội bộ như email/mật khẩu.
- Frontend: một file gọi API bằng `fetch` và một hook quản lý trạng thái xác thực tại App. Quy mô hiện tại chưa cần thêm state manager hoặc thư viện gọi API.
- Local: frontend cố định `http://localhost:3000` bằng Vite `strictPort`, Express cổng 3001. Vite proxy `/api` sang Express để frontend gọi URL tương đối. Dùng thống nhất hostname localhost khi thử Google. Khi triển khai online sẽ chốt lại origin theo nơi host.
- Chỉ tạo `auth.routes.ts`, `auth.service.ts`, `auth.schema.ts`, file database/session và middleware thực sự dùng. Chưa cần chuyển thành monorepo, tạo repository layer, base service, dependency injection, Redis, queue hoặc microservices.

Session middleware có sẵn cơ chế tạo lại và hủy phiên; store PostgreSQL giúp phiên không mất khi tiến trình backend khởi động lại. Tham khảo [Express session](https://expressjs.com/en/resources/middleware/session/) và [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple).

**Database tối thiểu**

| Bảng | Cột chính | Ràng buộc và mục đích |
|---|---|---|
| `users` | `id` UUID, `email`, `name`, `password_hash` nullable, `google_sub` nullable, `avatar_url` nullable, `is_premium` mặc định false, `created_at`, `updated_at` | PK `id`; email chuẩn hóa trim + lowercase và unique; google_sub unique; ít nhất một trong password_hash/google_sub phải có giá trị |
| `sessions` | `sid`, `sess`, `expire` | Dùng schema tương thích store `connect-pg-simple`: PK `sid`, JSON `sess`, index thời gian hết hạn; `sess` lưu userId và thông tin cookie |

Quan hệ logic: một user có nhiều phiên. Store lưu userId trong JSON, không tự thêm bảng quan hệ phiên hoặc tùy biến store chỉ để có foreign key. Mỗi lần xác thực phải xử lý được trường hợp user không còn tồn tại.

Cả hai bảng được tạo bằng migration có trong repository; không để backend tự tạo bảng mỗi lần khởi động. Dùng cơ chế dọn phiên hết hạn của store.

Dùng Google subject làm định danh, không dùng email để nhận diện một tài khoản Google đã liên kết. Tài khoản email có password_hash; tài khoản Google có google_sub. Avatar có thể để trống và dùng biểu tượng người dùng sẵn có. Không trả password_hash hoặc google_sub trong hồ sơ cho UI.

Quy tắc cho đợt local: khi đăng nhập Google có email đã được đăng ký bằng mật khẩu, yêu cầu dùng cách đăng nhập đã có; không tự liên kết dựa trên email. Email đã thuộc tài khoản Google cũng không thể đăng ký lại bằng mật khẩu. Chưa thêm chức năng liên kết tài khoản hoặc bảng provider tổng quát.

**Hợp đồng API đề xuất**

| API | Đầu vào / phản hồi | Hành vi chính |
|---|---|---|
| `GET /api/health` | Trạng thái API và kết nối DB | 200 khi dùng được DB, 503 khi DB không sẵn sàng; không trả thông tin kết nối |
| `POST /api/auth/register` | `{ name, email, password }` → `{ user }` | 201; tạo tài khoản email và phiên; email trùng trả 409 |
| `POST /api/auth/login` | `{ email, password }` → `{ user }` | 200; sai thông tin trả 401 với thông báo chung |
| `GET /api/auth/me` | `{ user }` | 200 khi có phiên hợp lệ, 401 khi chưa đăng nhập hoặc phiên hết hạn |
| `POST /api/auth/logout` | Không cần dữ liệu nghiệp vụ | 204; hủy phiên hiện tại trong DB và xóa cookie; gọi lại vẫn thành công |
| `POST /api/auth/google/nonce` | `{}` → `{ nonce }` | Sinh giá trị ngẫu nhiên gắn với session chưa đăng nhập, có hạn dùng, dành cho một lượt Google sign-in; phản hồi không cache |
| `POST /api/auth/google` | `{ credential }` → `{ user }` | 200; xác minh ID token và nonce; tìm theo google_sub hoặc tạo user mới; email thuộc tài khoản khác trả 409 |

`user` chỉ gồm `id`, `name`, `email`, `avatarUrl`, `isPremium`. API lấy quyền từ server; dữ liệu đầu vào chỉ nhận các trường được phép. Lỗi thống nhất dạng `{ error: { code, message } }`, có thể thêm lỗi theo trường khi cần. Dữ liệu không hợp lệ trả 400, vượt giới hạn trả 429; lỗi hạ tầng được phân biệt với 401.

**Các task và tiêu chí hoàn thành**

| ID | Công việc | Phụ thuộc | Hoàn thành khi |
|---|---|---|---|
| T0 | Chốt phạm vi: hai cách đăng nhập, hai bảng nghiệp vụ, chạy local | Đã hoàn thành | Lựa chọn của người dùng được ghi ở đầu tài liệu |
| T1 | Thêm server Express/TypeScript; scripts dev/build/start, `.env.example`, validate biến môi trường, xử lý lỗi, health endpoint; thêm Vite proxy | T0 | Frontend giữ lệnh dev hiện tại; server chạy bằng một lệnh riêng; frontend gọi được API qua `/api`; thiếu cấu hình báo lỗi rõ |
| T2 | Chạy PostgreSQL bằng một service Docker Compose, volume lưu dữ liệu và cổng chỉ bind localhost; schema/migration users/sessions; Prisma và session store | T1 | Docker Engine sẵn sàng; tạo được DB từ đầu bằng migration; email/google_sub không trùng; dữ liệu còn sau restart; test dùng DB riêng; health trả 200 |
| T3 | Viết register/login/me/logout; validation, hash mật khẩu, middleware xác thực, cookie và giới hạn request | T2 | Bốn API hoạt động thật; mật khẩu sai bị từ chối; mỗi lần đăng nhập tạo lại mã phiên; logout vô hiệu phiên cũ |
| T4 | Cấu hình Google Web OAuth client cho localhost; thêm nonce endpoint và API xác minh credential; xử lý user mới/cũ/trùng email | T3; người dùng có hoặc tạo Google client | Google ID token hợp lệ tạo session; token giả/hết hạn/sai audience/sai nonce bị từ chối; cùng google_sub không tạo user trùng |
| T5 | Nối AuthModal/App/TopHeader vào API và Google SDK; xử lý loading, lỗi và phiên hết hạn; bỏ người dùng giả và sửa lời hứa đồng bộ | T3, T4 | Cả email và Google hoạt động trên UI; F5 gọi me; logout gọi server; frontend không đọc tài khoản giả từ localStorage |
| T6 | Kiểm thử tích hợp bằng Vitest + Supertest với PostgreSQL test; thử Google thật trên trình duyệt và build | T5 | Các trường hợp nghiệm thu bên dưới đạt; Google thật được người dùng đăng nhập trong trình duyệt; không coi mock test là đủ |
| T7 | Viết README chạy local, biến môi trường, Google setup, migration, test và cách xác định lỗi kết nối | T6 | Có thể dựng lại từ source + `.env.example` và làm trọn luồng nghiệm thu theo tài liệu |

Thứ tự: T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7. Việc tạo Google client có thể chuẩn bị trong lúc làm T1–T3; chỉ phần Google phụ thuộc client này. Khi triển khai, viết kiểm thử liên quan ngay trong T3–T5; T6 là lượt nghiệm thu tổng hợp.

Mỗi task thực hiện theo nhịp: đọc code liên quan → sửa đúng phạm vi → kiểm tra tiêu chí hoàn thành → ghi kết quả vào checklist. Chỉ chuyển sang task phụ thuộc khi tiêu chí đã đạt; không cần hỏi duyệt lại từng task. Nếu xuất hiện yêu cầu làm tăng phạm vi, ghi rõ lý do và hỏi người dùng trước khi đưa vào đợt này.

**Chi tiết cần có trong T3–T5**

- Chính sách đề xuất: mật khẩu 15–128 ký tự, chấp nhận khoảng trắng và Unicode, không trim mật khẩu; lưu hash Argon2id. Backend là nơi kiểm tra chính, frontend hiển thị cùng yêu cầu. [Hướng dẫn lưu mật khẩu OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Giới hạn kích thước body; chặn thử đăng nhập liên tục theo IP và email chuẩn hóa với limiter phù hợp một tiến trình. Log không chứa mật khẩu, cookie hoặc credential Google.
- Cookie HttpOnly, SameSite=Lax; Secure khi HTTPS. Đề xuất phiên hết hạn sau 7 ngày không hoạt động, đồng bộ cookie/store. Kiểm tra cấu hình reverse proxy đúng nơi triển khai.
- Session chưa đăng nhập dùng cho nonce Google có thời hạn ngắn; nonce được dùng một lần và gắn với cookie trình duyệt. Sau khi xác minh Google thành công phải đổi mã phiên trước khi gắn userId.
- Bảo vệ request thay đổi trạng thái bằng kiểm tra Origin cho phép và bắt buộc JSON ở các POST API; không dùng GET để thay đổi dữ liệu. Với kiến trúc frontend/API khác origin, cấu hình lại CORS/CSRF theo domain thực tế trước khi triển khai.
- Khi mở app, trạng thái auth có loading/đã đăng nhập/chưa đăng nhập/lỗi tải. Chỉ 401 được xử lý như phiên không còn hợp lệ; mất mạng hoặc 5xx hiển thị lỗi và cho thử lại.
- Sau khi thành công mới cập nhật user trên UI. Hủy/xử lý phản hồi cũ để request me hoặc login trễ không khôi phục người dùng sau logout.
- Logout thất bại do mạng phải báo chưa xác nhận đăng xuất; không hiển thị thành công khi session server có thể còn hiệu lực.
- Bỏ các `setTimeout` xác thực giả và khóa `nhai_kanji_user`. Không chuyển tài khoản giả thành tài khoản thật, không xóa toàn bộ localStorage.
- Thay nút Google mô phỏng bằng nút do SDK Google render, đặt trong bố cục modal hiện có; chỉ hiển thị trạng thái đang gửi API khi thực sự nhận được credential để đóng popup không làm kẹt giao diện.
- Dữ liệu học vẫn ở thiết bị theo phạm vi đã chốt. Điều chỉnh câu giới thiệu đăng nhập cho đúng khả năng thực tế; không nhận dữ liệu cũ dùng chung trình duyệt là dữ liệu của tài khoản mới.
- Giữ quyền Premium mặc định false trong DB và đọc qua me; quản lý gói, thanh toán, khóa toàn bộ nội dung Premium là phạm vi riêng.

Với Google, frontend lấy nonce trước khi khởi tạo lượt đăng nhập, rồi gửi credential qua JSON API nội bộ. Server dùng thư viện chính thức để kiểm tra chữ ký, audience theo client ID, issuer, hạn dùng; đồng thời kiểm tra nonce và email đã xác minh. Chỉ dùng các quyền định danh cơ bản cho đăng nhập. [Tài liệu Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

Cấu hình Google local: OAuth client loại Web application, Authorized JavaScript Origins gồm `http://localhost` và `http://localhost:3000`, màn hình consent/audience và tài khoản test theo yêu cầu của Google Console. Luồng popup/JavaScript callback này không cần xây thêm OAuth redirect callback trên Express hoặc lưu Google access/refresh token. Dùng `VITE_GOOGLE_CLIENT_ID` ở frontend và `GOOGLE_CLIENT_ID` ở server với cùng client ID. Không yêu cầu Google client secret cho luồng xác minh ID token này. [Hướng dẫn cấu hình Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

**Nghiệm thu bắt buộc cho phạm vi cơ bản**

1. Đăng ký hợp lệ tạo đúng một user; DB chỉ chứa hash, API không trả hash; gửi `isPremium: true` không cấp quyền.
2. Hai request đăng ký cùng email, kể cả khác chữ hoa/thường, không tạo hai user; lỗi unique được chuyển thành lỗi API có nghĩa.
3. Sai mật khẩu hoặc email không tồn tại không tạo session đăng nhập; vượt giới hạn request nhận 429.
4. Đăng nhập thành công, F5 và restart server vẫn lấy đúng user trong thời hạn phiên; cookie có đúng thuộc tính theo môi trường.
5. Logout, cookie giả và phiên hết hạn không truy cập được me; dùng lại mã phiên cũ sau logout bị từ chối.
6. Đăng nhập bằng hai trình duyệt/tài khoản khác nhau nhận đúng hồ sơ tương ứng; sửa localStorage không làm đổi user hoặc quyền do API trả về.
7. Request POST từ Origin không được phép bị từ chối; lỗi mạng/DB không giả lập đăng nhập thành công và không rò rỉ chi tiết nội bộ.
8. Google thật: lần đầu tạo user, lần sau dùng đúng user đó; hủy/đóng popup không tạo tài khoản hoặc để nút kẹt ở loading.
9. Credential Google giả, hết hạn, sai audience hoặc nonce bị từ chối; thử lại cùng nonce không tạo phiên mới. Trùng email giữa hai cách đăng nhập không tự liên kết hoặc tạo user trùng.
10. Backend và frontend build thành công; các màn hình học hiện tại vẫn mở được. Kiểm tra UI trực tiếp cho loading, lỗi, F5, đổi tài khoản và logout.

**Sau mốc local, khi có yêu cầu mới**

Đồng bộ dữ liệu học và phát hành online cần plan riêng. Trước khi phát hành online phải chốt hạ tầng/domain và quy trình xác minh email, khôi phục tài khoản; lúc đó mới thêm dịch vụ email, token khôi phục, backup và cấu hình HTTPS. Các hạng mục này không nằm trong tiêu chí hoàn thành đợt local hiện tại.

Khi triển khai Prisma, cố định phiên bản tương thích Node và dùng workflow migration đúng phiên bản: tạo migration ở môi trường phát triển, áp dụng migration đã lưu khi phát hành. Không dùng lệnh reset hoặc tạo lại DB trên dữ liệu người dùng. Tham khảo [Prisma migration workflow](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production).

**Thông tin còn cần cho task Google**

Đang hỏi người dùng đã có Google Cloud project và OAuth Web client chưa. Nếu chưa có, T4 bao gồm hướng dẫn tạo; nếu đã có, T4 kiểm tra origin và cấu hình client. Thông tin này không cản việc lập plan hoặc dựng phần email/mật khẩu. Để nghiệm thu Google, người dùng tự đăng nhập trong trình duyệt; không cung cấp mật khẩu Google cho ứng dụng hoặc qua chat.

Những mặc định đề xuất về thời hạn phiên, chính sách mật khẩu và cấu trúc file là quyết định kỹ thuật có thể điều chỉnh khi triển khai; không cần người dùng chọn từng thư viện. Chỉ mở rộng task khi nhu cầu cụ thể đòi hỏi.
