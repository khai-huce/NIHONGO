# NIHONGO

Website học tiếng Nhật dùng React/Vite, Express/TypeScript, Prisma và PostgreSQL. Repository dùng **npm workspaces** để tách trang học, trang admin và API; một lần cài dependency ở thư mục gốc.

## Cấu trúc

```text
apps/web/       Trang học — cổng 3000
apps/admin/     Quản trị nội dung — cổng 3002
apps/api/       Express, nghiệp vụ, Prisma, audio — cổng 3001
packages/shared/ Kiểu dữ liệu và quy tắc học thuần dùng chung
packages/client/ API client, đăng nhập và mã trình duyệt dùng chung
tools/          Thiết lập môi trường, kiểm tra ranh giới import
docs/           Hướng dẫn, thiết kế và backlog
```

Mỗi frontend chia theo `src/features/`; backend chia theo `src/modules/`. Xem [kiến trúc và cách tìm code](docs/ARCHITECTURE.md), gồm vị trí trợ lý AI tương lai và bảng đường dẫn cũ → mới. Trợ lý nổi hiện vẫn mô phỏng; đợt tổ chức mã không bổ sung chức năng AI mới.

## Cài đặt lần đầu

Cần Node.js 22.12 trở lên và PostgreSQL local (Docker Desktop nếu dùng Compose). Chạy tại thư mục gốc:

```powershell
npm ci
npm run setup:env
npm run db:up
npm run db:generate
npm run db:migrate
```

Không cần chạy `npm install` riêng trong từng app. `setup:env` chỉ tạo file còn thiếu và sinh session secret; không ghi đè giá trị đang có. PostgreSQL local dùng cổng 5433, database `nihongo`; giữ nguyên tên Compose/volume. Không reset database khi nâng cấp cấu trúc.

Chỉ khi cài **database mới** và cần nhập bộ Kanji ban đầu đã duyệt:

```powershell
npm run content:seed --workspace @nihongo/api -- --commit
```

Các giáo trình/bài đọc/ngữ pháp do admin nhập và xuất bản; không tự tạo nội dung mẫu. Audio đọc hiểu dùng Edge TTS; hướng dẫn Python và nguồn nội dung: [CONTENT_PLATFORM.md](docs/CONTENT_PLATFORM.md).

## Chạy ứng dụng

Mỗi lệnh chạy trong một terminal riêng, tại thư mục gốc:

```powershell
npm run dev:server
npm run dev
npm run dev:admin
```

- [Trang học](http://localhost:3000): `apps/web`.
- [Admin](http://localhost:3002/admin/kanji): `apps/admin`.
- [API health](http://localhost:3001/api/health): trả `{"status":"ok"}` khi DB hoạt động.

Giữ API chạy khi sử dụng frontend. Hai giao diện proxy `/api` về cổng 3001, dùng chung database và phiên trên hostname `localhost`. Google trong admin mở trang học để đăng nhập; API admin luôn kiểm tra quyền thật.

## Biến môi trường

| File | Nội dung |
|---|---|
| `apps/web/.env` | `VITE_GOOGLE_CLIENT_ID`, `VITE_ADMIN_ORIGIN` và cấu hình công khai trang học |
| `apps/admin/.env` | `VITE_APP_ORIGIN` và cấu hình công khai admin |
| `apps/api/.env` | Database, session secret, `GOOGLE_CLIENT_ID`, Gemini, TTS |
| `apps/api/.env.test` | Database kiểm thử riêng có tên kết thúc `_test` |

File giá trị thật và audio không được đưa vào Git. Không đặt bí mật trong `VITE_*`. Khởi động lại app tương ứng sau khi đổi env.

Google Client ID ở web và API phải khớp. Authorized JavaScript Origins của OAuth Web client gồm `http://localhost` và `http://localhost:3000`; không đặt hai giá trị đó vào Redirect URIs. Backend dùng `APP_ORIGIN=http://localhost:3000` và `ADMIN_ORIGIN=http://localhost:3002`.

Gemini chấm ngữ pháp và phân tích câu được cấu hình tại `apps/api/.env`, dùng chung hạn mức ứng dụng; xem [GRAMMAR.md](docs/GRAMMAR.md) và [SENTENCE_ANALYSIS.md](docs/SENTENCE_ANALYSIS.md). Kính lúp phân tích câu dùng Kuromoji ở API cho cả khách; nút AI cần đăng nhập, không yêu cầu Premium. Audio mặc định tại `apps/api/storage/reading/`; Python TTS local tại `apps/api/.venv-tts/`. Cả hai thư mục đã được chuyển cùng API và giữ dữ liệu.

## Build và kiểm thử

```powershell
npm run check:boundaries
npm run typecheck
npm run test:frontend
npm run test:server
npm run build
```

`test:server` dùng `nihongo_test`, không dùng database người học. Các bài test cần chạy lần lượt khi cùng dùng database này. Build tạo `apps/web/dist`, `apps/admin/dist`, `apps/api/dist`; chạy API đã build bằng `npm run start --workspace @nihongo/api`. `build:web`, `build:admin`, `build:server` hỗ trợ build riêng.

Trên Windows, dừng API trước khi `npm run db:generate` để tránh Prisma DLL bị khóa. Thay schema cần migration mới được rà SQL; không dùng reset. Dữ liệu runtime/log và bản build cũ có thể nằm trong `.artifacts/` (ignored), không phải source.

## Tài liệu chức năng

- [Task và trạng thái nghiệm thu](docs/FEATURE_BACKLOG.md), [điều hướng](docs/ROUTES.md).
- [Kanji và nền nội dung](docs/CONTENT_PLATFORM.md), [admin Kanji](docs/ADMIN_KANJI.md).
- [Admin Đọc hiểu và audio](docs/ADMIN_READING.md).
- [Nhập giáo trình từ vựng](docs/HUONG_DAN_GIAO_TRINH.md), [thiết kế giáo trình/Review](docs/CURRICULUM.md).
- [Ngữ pháp và ba dạng bài tập](docs/GRAMMAR.md).
- [Phân tích câu tiếng Nhật, nguồn từ điển và Gemini](docs/SENTENCE_ANALYSIS.md).
- [Ôn tập/SRS](docs/REVIEW.md), [bài học cá nhân](docs/VOCAB_LESSONS.md).
- [XP và Xếp hạng Tổng XP/XP tháng](docs/LEADERBOARD.md).
