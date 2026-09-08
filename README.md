**NIHONGO — chạy frontend và Express backend ở local**

Frontend dùng React/Vite. Backend dùng Express/TypeScript, Prisma và PostgreSQL. Đợt này database chỉ lưu tài khoản và phiên đăng nhập; nội dung và tiến độ học vẫn ở trình duyệt/file dữ liệu hiện có.

**Cài đặt lần đầu**

Cần Node.js 22.12 trở lên và Docker Desktop đang chạy Linux containers. Mở terminal tại thư mục dự án và chạy:

```powershell
npm ci
npm --prefix server ci
npm run setup:env
npm run db:up
npm run db:migrate
npm --prefix server run db:generate
```

`setup:env` tạo `.env`, `server/.env`, `server/.env.test` khi chưa có và sinh SESSION_SECRET ngẫu nhiên. Lệnh không ghi đè cấu hình đã tồn tại. Các file chứa giá trị thật được gitignore; chỉ các file `.example` được lưu trong Git.

PostgreSQL local chạy tại `localhost:5433`, database `nihongo`. Compose cung cấp tài khoản thử local và volume lưu dữ liệu; cấu hình này chỉ dành cho máy phát triển. Dùng `npm run db:stop` khi cần dừng DB mà vẫn giữ dữ liệu.

**Chạy ứng dụng**

Terminal 1:

```powershell
npm run dev:server
```

Terminal 2:

```powershell
npm run dev
```

Mở [NIHONGO local](http://localhost:3000). Express nghe tại `127.0.0.1:3001`; Vite proxy `/api` sang Express. Dùng hostname `localhost` thống nhất với APP_ORIGIN và Google config. Chưa cấu hình phục vụ bản build frontend hoặc triển khai online trong đợt này.

Kiểm tra [API health qua Vite](http://localhost:3000/api/health): trả `{"status":"ok"}` khi PostgreSQL hoạt động. Khi không có DB, trả HTTP 503.

**Bật đăng nhập Google**

Email/mật khẩu chạy độc lập. Khi chưa có client ID, giao diện báo Google chưa sẵn sàng; không tạo tài khoản Google giả.

1. Vào [Google Cloud Console — Clients](https://console.cloud.google.com/auth/clients), tạo/chọn project của bạn.
2. Hoàn thành Branding và Audience cho ứng dụng NIHONGO; cấu hình tài khoản test nếu Console yêu cầu. Chỉ dùng thông tin định danh cơ bản cho đăng nhập.
3. Tạo OAuth client loại **Web application**. Thêm Authorized JavaScript Origins: `http://localhost` và `http://localhost:3000`.
4. Sao chép client ID dạng `....apps.googleusercontent.com` vào hai nơi:

```dotenv
# .env ở thư mục gốc
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

```dotenv
# server/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

5. Khởi động lại cả Vite và backend, mở modal và dùng nút Google. Bạn tự chọn tài khoản Google/hoàn thành các bước đăng nhập trong cửa sổ Google.

Luồng dùng Google Identity Services và JavaScript callback, xác minh ID token ở backend rồi tạo session nội bộ. Không cần client secret, redirect callback Express, hoặc lưu Google access/refresh token. Hướng dẫn chính thức: [Google setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [server token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

Nếu email đã đăng ký bằng mật khẩu, đăng nhập Google cùng email sẽ báo dùng cách đăng nhập đã có. Đợt này chưa có chức năng liên kết hai cách đăng nhập; không tự liên kết chỉ dựa trên email.

**Database và API**

Schema: `server/prisma/schema.prisma`; migration: `server/prisma/migrations/202609080001_auth/migration.sql`.

- `users`: hồ sơ, email chuẩn hóa duy nhất, hash Argon2id hoặc Google subject duy nhất. `is_premium` mặc định false và không nhận từ request đăng ký.
- `sessions`: session PostgreSQL theo schema của `connect-pg-simple`; cookie `nihongo.sid` có HttpOnly/SameSite=Lax, hết hạn sau 7 ngày không hoạt động với phiên đã đăng nhập. Nonce Google có hạn 10 phút và chỉ dùng một lần.

| Endpoint | Mục đích |
|---|---|
| `GET /api/health` | Kiểm tra kết nối DB |
| `POST /api/auth/register` | `{ name, email, password }`; tạo user và phiên |
| `POST /api/auth/login` | `{ email, password }`; đăng nhập |
| `GET /api/auth/me` | Lấy hồ sơ từ phiên hiện tại |
| `POST /api/auth/logout` | `{}`; hủy phiên và cookie |
| `POST /api/auth/google/nonce` | `{}`; chuẩn bị lượt đăng nhập Google |
| `POST /api/auth/google` | `{ credential }`; xác minh và đăng nhập |

POST yêu cầu `Content-Type: application/json` và `Origin: http://localhost:3000`, kể cả khi gọi từ công cụ kiểm thử. Cookie được gửi tự động khi frontend gọi cùng origin. API chỉ trả các trường hồ sơ công khai cho UI, không trả password hash.

Mật khẩu đăng ký dài 15–128 ký tự và không bị trim. Đăng nhập sai trả thông báo chung. Request đăng nhập/đăng ký được giới hạn theo IP và email chuẩn hóa; lỗi API có dạng `{ error: { code, message } }`.

**Kiểm tra và phát triển tiếp**

```powershell
npm run test:server
npm run build:server
npm run build
```

Test tự tạo/migrate database `nihongo_test` trên PostgreSQL local, dọn dữ liệu trong database test trước mỗi case và kiểm tra API với DB thật. Script từ chối database không ở localhost hoặc có tên không kết thúc bằng `_test`. Test Google dùng RSA token ký bằng khóa test và thay nguồn certificate; thư viện Google vẫn thực hiện xác minh chữ ký/claims. Bộ test đó không thay thế lần đăng nhập Google thật trên trình duyệt.

Khi thay đổi schema: dùng `npm --prefix server run db:migrate:dev -- --name ten_thay_doi`, kiểm tra SQL sinh ra và giữ migration trong Git. Không dùng reset DB để áp dụng thay đổi vào dữ liệu người học. Hai bảng users/sessions được tạo bởi migration, không tạo ngầm khi server khởi động.

Trên Windows, dừng backend trước khi chạy `db:generate` sau thay đổi schema để tránh khóa file Prisma DLL. Lệnh build chỉ biên dịch TypeScript; bước generate đã nằm trong hướng dẫn cài đặt.

Prisma được cố định ở 6.19.3 để giữ workflow đơn giản tương thích Node đang có. Override `deepmerge-ts` 8.0.2 sửa cảnh báo dependency của Prisma CLI; chạy lại migration/generate/build khi nâng các phiên bản này.

**Các lỗi local thường gặp**

- Docker báo không tìm thấy pipe/engine: mở Docker Desktop, chờ Engine sẵn sàng rồi chạy lại `npm run db:up`.
- Docker báo `The file cannot be accessed by the system` tại `Docker/run/dockerInference` hoặc `docker-secrets-engine/engine.sock`: đây là lỗi socket tạm được ghi nhận trong [Docker issue #536](https://github.com/docker/desktop-feedback/issues/536). Sau khi Docker thoát, sao lưu bằng cách đổi tên cả hai thư mục runtime bị kẹt trước khi khởi động lại; kiểm tra thư mục chỉ chứa socket tạm, giữ bản sao và không factory reset/xóa volume để xử lý lỗi này. Đợt triển khai này đã khôi phục Engine theo cách đó.
- API báo không kết nối DB: kiểm tra `docker compose ps`, cổng 5433 và DATABASE_URL trong `server/.env`.
- Thiếu bảng: chạy `npm run db:migrate`.
- Google báo `400 origin_mismatch`: mở Google Cloud → Clients → đúng client đang cấu hình, thêm `http://localhost` và `http://localhost:3000` vào **Authorized JavaScript origins**, rồi Save. Mở ứng dụng bằng `http://localhost:3000`, tải lại và thử đăng nhập. Không nhập hai origin này vào Redirect URIs; `127.0.0.1` là origin khác. Kiểm tra hai client ID frontend/backend giống nhau; frontend dùng strictPort để không tự nhảy cổng.
- Đổi `.env` chưa có tác dụng: khởi động lại tiến trình tương ứng.
- Đăng xuất khi mất mạng: UI báo chưa xác nhận đăng xuất; kết nối lại và bấm đăng xuất lần nữa.

Trạng thái task và phạm vi chi tiết nằm trong `docs/BACKEND_AUTH_PLAN.md`. Xác minh email, quên mật khẩu, đồng bộ học tập và triển khai public là bước tiếp theo, chưa nằm trong phiên bản local này.
