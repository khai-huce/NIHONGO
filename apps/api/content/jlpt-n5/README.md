# NIHONGO N5 — bản nội dung 2026-10-25

Người dùng đã duyệt biên soạn, nhập và xuất bản giáo trình thật. Bộ này đã xuất bản local ngày 26/10/2026, không phải dữ liệu QA. Không sao chép giáo trình Tango/Minna hoặc đề thi JLPT.

## Nội dung và nguồn

| Nội dung | Số lượng | Cách sử dụng |
|---|---:|---|
| Buổi học | 40 | 2 buổi kana, 31 buổi tích hợp, 3 chặng ôn, 4 buổi tổng ôn/kiểm tra |
| Từ vựng | 662 / 31 bài | OpenJLPT, bản dịch Việt do NIHONGO biên soạn với AI hỗ trợ |
| Kanji | 103 | Tham chiếu ID đã xuất bản trong kho KANJIDIC2, không tạo bản sao |
| Ngữ pháp | 62 mẫu / 124 ví dụ | Nguyên bản NIHONGO, mỗi mẫu có cấu trúc/giải thích/phạm vi/lưu ý |
| Bài tập ngữ pháp | 186 | Việt→Nhật, Nhật→Việt, sắp xếp cho từng mẫu |
| Đọc/nghe | 31 bài / 156 câu | Văn bản nguyên bản, dịch Việt, furigana từ Kuromoji/IPADIC, MP3 Nanami |
| Kiểm tra cuối buổi | 516 câu qua 40 đề | Trắc nghiệm bốn lựa chọn; các chặng ôn nhắc lại kiến thức đã học |

Từ vựng giữ 662 UUID và mapping nguồn tại [`docs/data/tu-vung-n5`](../../../../docs/data/tu-vung-n5/README.md), revision OpenJLPT `c42fd9fa3777bfc1775446f7c418d549dfd6e4cf`, giấy phép **CC BY-SA 4.0**, cùng các thông báo OpenJLPT/Tanos/JMdict-EDICT/EDRDG tại đó. Bản dẫn xuất tiếng Việt tiếp tục CC BY-SA 4.0; metadata `openjlpt-n5-c42fd9fa-vi-v2` giữ ghi công. Sửa bốn cách viết phổ thông (明い→明るい, 終る→終わる, さ来年→再来年, 曲る→曲がる), không đổi UUID/cách đọc/nghĩa. Không gán Hán Việt/từ loại/ví dụ nếu chưa biên soạn.

Giáo án, ngữ pháp, bài đọc và câu hỏi nguyên bản ghi nguồn `nihongo-n5-original-20261025`, quyền theo yêu cầu chủ dự án. Kanji tiếp tục dùng nguồn/giấy phép đã lưu ở C01. Metadata nguồn bất biến.

N5 là cấp tham khảo; không có tuyên bố đây là danh mục JLPT chính thức hoặc bộ đề chuẩn hóa. Phần nghe dùng TTS luyện nghe rồi đối chiếu văn bản; đề cuối buổi hiện là câu hỏi văn bản, không phải dạng thi nghe có audio riêng. Nghĩa Việt, nội dung và furigana đã kiểm tra nội bộ có AI hỗ trợ, chưa có chứng nhận biên tập viên bản ngữ hoặc nghe nghiệm thu toàn bộ 156 câu. Tiếp tục sửa qua kho admin khi có phản hồi.

## Các file

- `grammar.mjs`, `readings.mjs`: nội dung gốc có thể rà soát và biên tập.
- `build.mts`: ghép nguồn, giữ ID ổn định, dựng đề/đáp án/liên kết, validation schema; không ghi DB.
- `bundle.json`: gói đã biên soạn cho importer liên kho, **không phải** file để dán nguyên vào modal JSON giáo trình từ vựng.
- `validation.json`: số lượng, bao phủ buổi, thay đổi cách viết và SHA256 của bundle.
- `audio.mts`: tạo/tiếp tục tạo MP3 theo từng bài, cache theo văn bản/giọng; không ghi DB.
- `../../scripts/jlpt-n5-import.ts`: preview mặc định, commit theo hash; từ chối ghi đè phiên bản đã được admin sửa.

SHA256 bản đã xuất bản: `4ff4a7235d421b010a3164880b8acde7f26f5f4ae8d5124a0344297c7978e273`.

## Tái tạo và nhập

Chạy từ thư mục gốc repo, đã cài dependency và cấu hình `apps/api/.env`. Cần database đã migrate, 103 Kanji C01 published và tài khoản admin hiện có. Không reset DB.

```powershell
npx tsx apps/api/content/jlpt-n5/build.mts
& apps/api/.venv-tts/Scripts/python.exe -m pip install -r apps/api/requirements-tts.txt
npx tsx apps/api/content/jlpt-n5/audio.mts
```

Audio cần mạng, gửi văn bản nguyên bản sang Microsoft Edge TTS; không dùng dịch vụ trả phí. `requirements-tts.txt` pin 7.3.1 để sửa handshake của bản cũ. Cache tại `.artifacts/j02/audio/<article-id>/<text-voice-hash>/`; chỉ tạo phần chưa có. Kiểm tra cache/manifest/file trước import.

Chạy importer từ `apps/api` để đọc đúng `.env`:

```powershell
Set-Location apps/api
npx tsx scripts/jlpt-n5-import.ts
npx tsx scripts/jlpt-n5-import.ts --commit --hash=4ff4a7235d421b010a3164880b8acde7f26f5f4ae8d5124a0344297c7978e273
```

Đọc báo cáo preview trước commit. Nếu tự build lại làm đổi hash, dùng đúng hash mới sau khi rà soát. `--database=nihongo_j02_ui_test --owner-email=j02-ui@example.test` chỉ dành cho database local kết thúc `_test` và admin QA đã tồn tại; không tự cấp quyền. Mặc định chủ bài đọc là admin người dùng đã chỉ định.

Import theo từng kho bằng service hiện có; mỗi bước transactional và có thể chạy lại sau lỗi, không phải một transaction bao trùm cả hệ thống/file. Các lần chạy lại giữ UUID, không nhân bản. Nếu admin đã sửa nháp/public/nguồn thì importer dừng; dùng admin để cập nhật tiếp, không ép ghi đè. Lưu MP3 bằng create-only và so byte, không xóa audio cũ. Khóa bài đọc và kiểm tra version trước publish; kiểm tra lại snapshot cuối trước báo thành công.

File phục vụ sau nhập: `apps/api/storage/reading/<audio-id>/<claim-token>/<index>.mp3` (hoặc `TTS_STORAGE_DIR`). DB giữ manifest, hash, giọng, thời lượng và liên kết bài; MP3 không nằm trong Git. Cần sao lưu cả database và thư mục storage khi chuyển máy.

## Học và quản trị

- Trang học: `/tron-doi/jlpt?level=N5`, ID `6dbeae93-67cd-5b02-a28e-8875d42e4620`.
- Admin: `/admin/jlpt/6dbeae93-67cd-5b02-a28e-8875d42e4620` trên cổng 3002.
- Kho từ vựng mới: slug `tu-vung-n5-openjlpt`; ngữ pháp: `ngu-phap-n5-nihongo`.
- Sửa kiến thức tại kho gốc; sửa thứ tự/liên kết/đề/ngưỡng tại Lộ trình JLPT, lưu nháp rồi xuất bản.
- Mặc định đạt 80% mở buổi tiếp theo. Tiến độ, lượt thi và đáp án dở riêng tài khoản. Hướng dẫn đầy đủ ở [`docs/JLPT_ROADMAP.md`](../../../../docs/JLPT_ROADMAP.md).

Không sửa giáo trình Tango hiện có, nguồn Kanji, `n5-v1` hoặc lịch sử học. Kiểm tra nhập lại và hash 40 bảng cũ đã xác nhận dữ liệu gốc giữ nguyên; không tạo XP/SRS.
