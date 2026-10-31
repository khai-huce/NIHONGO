# Cấu trúc dự án NIHONGO

Dự án dùng một repository với npm workspaces, gồm ba ứng dụng và hai gói dùng chung. Trang học, trang quản trị và Express có nơi đặt mã riêng; vẫn dùng cùng backend, database và cơ chế phiên đăng nhập hiện có. Việc tổ chức này không thay đổi giao diện, đường dẫn trang học hay quy tắc tính tiến độ.

## 1. Tìm mã ở đâu?

```text
NIHONGO/
├── apps/
│   ├── web/                     # React: trang học, cổng 3000
│   │   ├── src/
│   │   │   ├── app/             # Khởi tạo ứng dụng, route, bố cục chung
│   │   │   ├── features/        # Chức năng học, nhóm theo nghiệp vụ
│   │   │   └── shared/          # UI, hook, tiện ích chỉ trang học dùng
│   │   ├── public/
│   │   └── tests/
│   ├── admin/                   # React: quản trị nội dung, cổng 3002
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── features/        # kanji, reading, curriculum, grammar, auth
│   │   │   └── shared/          # Dialog, API quản trị, kiểu dữ liệu quản trị
│   │   ├── public/
│   │   └── tests/
│   └── api/                     # Node.js/Express, cổng 3001
│       ├── src/
│       │   ├── index.ts         # Khởi động server
│       │   ├── app.ts           # Ghép middleware và route của các module
│       │   ├── config/          # Đọc, kiểm tra biến môi trường
│       │   ├── common/          # Tiện ích backend dùng chung
│       │   ├── integrations/    # Kết nối Gemini và quota chung C03/A03
│       │   └── modules/         # auth, content, grammar, reading, review...
│       ├── prisma/             # Schema và toàn bộ lịch sử migration
│       ├── content/            # Dữ liệu nguồn phục vụ các script nhập
│       ├── scripts/            # Seed/import, quản lý quyền, TTS, chuẩn bị test
│       ├── storage/            # File tạo khi chạy, gồm audio bài đọc
│       └── tests/              # Kiểm thử API và nghiệp vụ backend
├── packages/
│   ├── shared/
│   │   ├── src/contracts/      # Hình dạng dữ liệu dùng chung
│   │   ├── src/study/          # Quy tắc học thuần, dùng được ở FE và API
│   │   ├── src/curriculum/     # Đọc/chuẩn hóa JSON giáo trình
│   │   ├── fixtures/           # Dữ liệu đối chiếu, giữ ID cũ cho kiểm thử
│   │   └── tests/
│   └── client/
│       ├── src/api.ts          # Gọi API từ trình duyệt
│       ├── src/auth/           # Hook phiên đăng nhập cho web và admin
│       ├── src/reading.ts      # Dữ liệu/tiện ích bài đọc cho hai frontend
│       └── styles/            # Các quy tắc CSS nền thực sự dùng chung
├── tools/                      # Thiết lập môi trường, kiểm tra cấu trúc
├── docs/                       # Hướng dẫn nghiệp vụ, API, dữ liệu và backlog
├── compose.yaml                # PostgreSQL local
└── package.json                # Lệnh chạy toàn dự án và khai báo workspaces
```

Mỗi ứng dụng có `package.json`, cấu hình TypeScript và biến môi trường riêng. Web và admin có cấu hình Vite riêng. Dùng một `package-lock.json` ở thư mục gốc để quản lý bộ dependency của workspace.

## 2. Cách tổ chức một chức năng

Frontend nhóm mã theo `features/<tên-chức-năng>`. Ví dụ `apps/web/src/features/grammar/` chứa trang và component ngữ pháp; `apps/admin/src/features/grammar/` chứa trình quản trị ngữ pháp. Component, hook và tiện ích chỉ phục vụ một chức năng được đặt cạnh chức năng đó. Chỉ tạo thêm thư mục `pages`, `components`, `hooks` hoặc `utils` khi thực sự có mã tương ứng.

Backend nhóm theo `modules/<tên-nghiệp-vụ>`. Ví dụ `apps/api/src/modules/grammar/` giữ route, schema kiểm tra đầu vào, xử lý lưu/xuất bản, chấm bài và prompt Gemini của ngữ pháp. A03 nằm ở `modules/sentence-analysis/`, sở hữu tách từ, tra catalog, prompt, kiểm tra phản hồi và cache phân tích. `app.ts` ghép các module; không đưa nghiệp vụ mới vào file khởi động server.

| Cần sửa | Nơi bắt đầu |
|---|---|
| Trang học hoặc điều hướng chung | `apps/web/src/app/` |
| Bài học từ vựng tự nhập | `apps/web/src/features/vocabulary/`, `apps/api/src/modules/vocabulary/` |
| Giáo trình từ vựng | Các thư mục `features/curriculum/` và `modules/curriculum/` |
| Ngữ pháp và chấm bài | Các thư mục `features/grammar/` và `modules/grammar/` |
| Phân tích câu A03 | `apps/web/src/features/grammar/`, `apps/api/src/modules/sentence-analysis/`, contract `packages/shared/src/contracts/sentence-analysis.ts` |
| Tra cứu trọng âm C05 | `apps/web/src/features/pitch-accent/`, `apps/api/src/modules/pitch-accent/`, manifest/import ở `apps/api/content/pitch-accent/` và `scripts/pitch-import.ts` |
| Kết nối Gemini và quota C03/A03 | `apps/api/src/integrations/gemini.ts`, `gemini-quota.ts` |
| Đọc hiểu và audio | Các thư mục `features/reading/` và `modules/reading/` |
| Sao và ôn tập | `apps/web/src/features/review/`, `apps/api/src/modules/review/` |
| Lộ trình và tiến độ | `apps/web/src/features/roadmaps/`, `apps/api/src/modules/roadmaps/` |
| Database | `apps/api/prisma/schema.prisma` và `apps/api/prisma/migrations/` |
| Thành phần dùng chung trong admin | `apps/admin/src/shared/` |
| Kiểu dữ liệu truyền giữa các phần | `packages/shared/src/contracts/` |

Không bắt buộc mỗi module phải có đủ controller/service/repository. Chỉ tách file khi có trách nhiệm riêng rõ ràng. Các trang lớn có thể tiếp tục tách component trong feature của chúng khi chỉnh chức năng; đổi thư mục không đồng nghĩa đã viết lại toàn bộ các trang đó.

## 3. Quy tắc phụ thuộc

```text
web ──────┬──> @nihongo/client ──> @nihongo/shared
admin ────┘             web/admin ──> @nihongo/shared
api ───────────────────────────────> @nihongo/shared
```

- Không import mã từ ứng dụng khác: web không lấy component của admin; admin không lấy hook từ web; API không lấy parser trong admin.
- `@nihongo/shared` không phụ thuộc React, trình duyệt, Express hay Prisma. Quy tắc thuần và hợp đồng dữ liệu có thể được cả ba ứng dụng dùng.
- `@nihongo/client` dành cho trình duyệt; API không import gói này. Gói client có thể dùng React và shared, nhưng không import ngược từ `apps/`.
- API tiếp tục tự kiểm tra dữ liệu, phiên và quyền. Kiểu TypeScript hoặc kiểm tra frontend không thay thế kiểm tra backend.
- Mã dùng chung giữa nhiều feature trong một ứng dụng đặt tại `src/shared/` của ứng dụng đó. Chỉ chuyển vào `packages/` khi có nhu cầu chia sẻ giữa các ứng dụng.
- Khi cần dùng code của package, dùng các đường dẫn đã khai báo như `@nihongo/client/api`, `@nihongo/shared/contracts/vocabulary`, `@nihongo/shared/study/vocab-study`; tránh đường dẫn tương đối xuyên nhiều thư mục app.

Ví dụ: dialog của trình nhập giáo trình/ngữ pháp nằm tại `apps/admin/src/shared/ui/AdminDialog.tsx`. Hook đọc dữ liệu theo route và tài khoản nằm tại `apps/web/src/shared/hooks/useAccountResource.ts`, để chức năng ngữ pháp không phải phụ thuộc một hook mang tên giáo trình.

## 4. Vị trí dành cho trợ lý AI

Từ A06 ngày 30/10/2026, `apps/web/src/features/assistant/` dùng API Gemini thật, giữ khung chat và bỏ trạng thái online. Component chỉ trình bày; hook quản lý hội thoại trong bộ nhớ, thư viện kiểm tra request/response và liên kết. Xem [Trợ lý NIHONGO](ASSISTANT.md) để biết phạm vi và kết quả nghiệm thu mới nhất.

`apps/api/src/modules/assistant/` tách route, schema, provider orchestration, hướng dẫn/kho public và thống kê cá nhân. Chỉ đọc dữ liệu học của phiên hiện tại khi câu hỏi yêu cầu; dùng lại bộ phân giải nội dung published của JLPT. Model không có công cụ ghi database hay thực hiện thao tác. Bảng `assistant_requests` chỉ giữ metadata chống gửi lặp/quota, không giữ hội thoại; cache trả lại khi mất mạng nằm trong bộ nhớ có thời hạn.

Từ A03 ngày 04/10/2026, C03 và A03 dùng chung `apps/api/src/integrations/gemini.ts` cho kết nối provider và `gemini-quota.ts` cho hạn mức tổng trong 24 giờ. Prompt, schema và quy tắc chấm/lưu vẫn do `modules/grammar/grammar-ai.ts` và `modules/sentence-analysis/sentence-ai.ts` sở hữu riêng. Kuromoji/IPADIC chỉ chạy phía API, được nạp một lần trong tiến trình; catalog public được đối chiếu trong module phân tích câu. Xem [phạm vi A03](SENTENCE_ANALYSIS.md). Phần tích hợp này không tự bổ sung chức năng cho trợ lý nổi.

Không thêm server AI riêng, hàng đợi, vector database hoặc framework agent cho phạm vi trợ lý hướng dẫn này. A06 và AI Format A02 dùng lại Gemini transport/quota chung; prompt và validation vẫn thuộc từng module. Khóa dịch vụ AI luôn ở môi trường của API, không đưa vào frontend hoặc `packages/shared`.

## 5. Chạy dự án và biến môi trường

Chạy các lệnh sau từ thư mục gốc. Mỗi ứng dụng chạy trong một terminal riêng:

| Lệnh | Kết quả |
|---|---|
| `npm install` | Cài dependency cho các workspace |
| `npm run setup:env` | Tạo file môi trường còn thiếu từ bản mẫu, giữ file đã có |
| `npm run dev` | Trang học tại `http://localhost:3000` |
| `npm run dev:admin` | Admin tại `http://localhost:3002` |
| `npm run dev:server` | Express tại `http://localhost:3001` |
| `npm run db:up` | Khởi động PostgreSQL local theo Compose |
| `npm run db:migrate` | Áp dụng migration vào database đã cấu hình |
| `npm run build` | Build web, admin và API |
| `npm run typecheck` | Kiểm tra TypeScript |
| `npm run check:boundaries` | Kiểm tra các ranh giới phụ thuộc |
| `npm run test:frontend` | Kiểm thử web/admin và logic shared |
| `npm run test:server` | Kiểm thử backend với môi trường test |

Các lệnh trên là cách kiểm tra, không phải xác nhận một lượt kiểm thử đã đạt. Bằng chứng nghiệm thu của từng đợt được ghi trong [FEATURE_BACKLOG.md](FEATURE_BACKLOG.md).

- `apps/web/.env`: cấu hình công khai cho trang học, ví dụ Google Client ID.
- `apps/admin/.env`: cấu hình công khai riêng của admin.
- `apps/api/.env`: kết nối database, phiên, Google, Gemini và TTS phía server.
- `apps/api/.env.test`: database kiểm thử riêng.

Mỗi file có bản `.example` tương ứng. Không đặt bí mật trong biến `VITE_*`, vì chúng có thể xuất hiện trong mã gửi tới trình duyệt. Hai frontend vẫn chuyển tiếp `/api` tới Express và dùng cùng cơ chế đăng nhập; việc tách thư mục không tạo database hay hệ thống tài khoản thứ hai.

Audio mặc định nằm tại `apps/api/storage/reading/`, hoặc thư mục riêng do `TTS_STORAGE_DIR` chỉ định. Đây là dữ liệu khi chạy, không đặt trong `public/`. Lịch sử migration được giữ tại API; không reset database để chuyển cấu trúc dự án.

## 6. Đường dẫn cũ và mới

| Trước đây | Hiện tại |
|---|---|
| `src/App.tsx`, `src/routes.ts` | `apps/web/src/app/` |
| `src/pages/`, `src/components/`, `src/hooks/` | Phân theo chức năng trong `apps/web/src/features/` hoặc `apps/web/src/shared/` |
| `src/admin/`, entry `admin/` | `apps/admin/` |
| `server/src/` | `apps/api/src/`, chia các nghiệp vụ vào `modules/` |
| `server/prisma/`, `server/scripts/`, `server/storage/` | Các thư mục tương ứng trong `apps/api/` |
| `shared/*.mjs` | `packages/shared/src/study/` |
| `src/utils/api.ts`, `src/hooks/useAuth.ts` | `packages/client/src/api.ts`, `packages/client/src/auth/useAuth.ts` |
| `src/types/index.ts` | `packages/shared/src/contracts/core.ts` |
| `src/admin/curriculum-editor-data.ts` | `packages/shared/src/curriculum/editor-data.ts` |
| `tests/` | `apps/web/tests/`, `apps/admin/tests/`, `packages/shared/tests/` theo phần được kiểm tra |
| `.env` ở gốc / `server/.env` | `apps/web/.env` / `apps/api/.env`; admin có môi trường riêng |

Các tên route, UUID nội dung, khóa lưu dữ liệu khách và quy tắc nghiệp vụ không đổi chỉ vì file được chuyển chỗ. Dữ liệu legacy phục vụ đối chiếu nằm trong fixture; không dùng nó làm nguồn nội dung công khai thay cho database.
