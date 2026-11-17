# Rà soát database NIHONGO — 13/11/2026

Đã đọc schema, migration, mã API và truy vấn metadata/số bản ghi trên database đang cấu hình tại `apps/api/.env`. Các truy vấn database chạy trong transaction `READ ONLY`; không sửa bảng, dữ liệu, migration hoặc cấu hình. Không đếm database QA/test, bảng hệ thống PostgreSQL hay index thành bảng nghiệp vụ.

## Kết quả kiểm kê

- **49 bảng thực tế = 48 bảng ứng dụng + `_prisma_migrations`.**
- Prisma có 48 model, khớp danh sách bảng ứng dụng; không có bảng ứng dụng ngoài schema hoặc model thiếu bảng.
- 28 migration đã hoàn tất, không có migration đang dở.
- 49 khóa chính, 76 khóa ngoại, 43 CHECK; 128 index, trong đó 61 unique index (bao gồm index của khóa chính). Không thấy index invalid hoặc cặp index trùng cấu hình theo truy vấn đã dùng. Các số này là kiểm kê, không phải điểm chất lượng hay đánh giá hiệu năng.
- 15 bảng đang có 0 bản ghi. Tất cả 48 model/bảng có tham chiếu trong source API hoặc script; đây là bằng chứng chưa nên xóa, không chứng minh mọi nhánh đã được dùng trên môi trường chính.
- Có 41 cột JSON/JSONB. Cần phân biệt tài liệu/snapshot với thực thể có danh tính và quan hệ độc lập.

| Nhóm | Số bảng | Danh sách |
|---|---:|---|
| Tài khoản và phiên | 2 | `users`, `sessions` |
| Kho nền, Kanji và trọng âm | 5 | `content_sources`, `kanji_content`, `radical_content`, `catalog_definitions`, `pitch_accent_entries` |
| Học Kanji/Kana và lộ trình Kanji | 4 | `kanji_progress`, `personal_roadmaps`, `default_roadmap_progress`, `kana_quiz_results` |
| Từ vựng cá nhân | 3 | `vocab_lessons`, `vocab_progress`, `vocab_study_results` |
| Giáo trình từ vựng | 7 | `curriculum_courses`, `curriculum_topics`, `curriculum_lessons`, `curriculum_progress`, `curriculum_study_results`, `curriculum_review_sets`, `curriculum_review_results` |
| Ngữ pháp | 5 | `grammar_courses`, `grammar_lessons`, `grammar_patterns`, `grammar_progress`, `grammar_attempts` |
| Đọc hiểu và audio | 2 | `reading_articles`, `reading_audio` |
| Shadowing | 4 | `shadowing_videos`, `shadowing_studies`, `shadowing_grades`, `shadowing_attempts` |
| Lộ trình JLPT | 6 | `jlpt_roadmaps`, `jlpt_sessions`, `jlpt_resources`, `jlpt_enrollments`, `jlpt_session_progress`, `jlpt_attempts` |
| Ôn tập SRS | 2 | `review_cards`, `review_events` |
| XP và thông báo | 2 | `xp_events`, `notification_reads` |
| Yêu cầu AI | 6 | `grammar_ai_requests`, `sentence_analysis_requests`, `shadowing_ai_requests`, `vocab_ai_requests`, `assistant_requests`, `reading_analysis_requests` |
| Hạ tầng migration | 1 | `_prisma_migrations` |
| **Tổng** | **49** | |

## Những phần nên giữ

- Tách trạng thái hiện tại khỏi lịch sử: `review_cards` và `review_events`; tiến độ JLPT và các lần thi; tiến độ ngữ pháp và các lần làm. Chúng trả lời những câu hỏi khác nhau, không phải cùng một dữ liệu ghi lặp vô ích.
- Nguồn nội dung dùng chung qua `content_sources`. Các liên kết JLPT dùng FK thật tới kho có sẵn; CHECK buộc đúng một loại nội dung tương ứng. Không sao chép toàn bộ kho vào lộ trình.
- Bản nháp và bản xuất bản có vòng đời khác nhau. Snapshot đề/đáp án trong lịch sử giúp giữ ý nghĩa kết quả khi nội dung được sửa.
- Thẻ ôn và XP được giữ sau khi nguồn bị xóa theo yêu cầu nghiệp vụ. Không thêm FK xóa dây chuyền một cách máy móc vào các khóa nguồn này.
- Từ vựng cá nhân, giáo trình công khai và Review gộp có quyền sở hữu, cách xóa và quy tắc hoàn thành khác nhau. Các bảng kết quả giống cột chưa đủ lý do gộp ngay.

## Điểm cần cải thiện

### DB01 — Bổ sung ràng buộc quan hệ, ưu tiên trước

1. `kanji_progress.kanji_id` chưa có FK tới `kanji_content.id`.
2. `default_roadmap_progress.catalog_id` chưa có FK tới `catalog_definitions.id`.
3. `curriculum_lessons.course_id` và `topic_id` có FK riêng nhưng chưa ràng buộc chủ đề thuộc đúng giáo trình. API đang kiểm tra; database nên có ràng buộc tương ứng, hoặc bỏ cột quan hệ suy ra được nếu truy vấn không cần.
4. `jlpt_attempts.roadmap_id/session_id` và `jlpt_enrollments.roadmap_id/last_session_id` cũng cần bảo đảm buổi thuộc đúng lộ trình. Có thể dùng FK ghép và khóa duy nhất phù hợp.
5. Rà soát quan hệ chủ tài khoản, ví dụ `vocab_progress.user_id` phải trùng chủ của `lesson_id`.

Đã kiểm tra dữ liệu hiện tại ở bảy trường hợp: Kanji không có catalog, tiến độ mặc định không có catalog, bài/chủ đề khác giáo trình, enrollment/buổi khác lộ trình, lần thi/buổi khác lộ trình, tiến độ từ khác chủ bài và tiến độ trỏ tới từ không còn trong bài. **Cả bảy đều 0 bản ghi sai.** Một số bảng đang trống nên kết quả 0 không thay thế ràng buộc cho dữ liệu tương lai.

Bằng chứng: `apps/api/prisma/schema.prisma` (KanjiProgress, DefaultRoadmapProgress, CurriculumLesson, JlptEnrollment, JlptAttempt); kiểm tra phía API tại `apps/api/src/modules/curriculum/curriculum.service.ts`, hàm `reserveDraftIds`.

### DB02 — Chuẩn hóa thực thể từ vựng và bài tập, ưu tiên kế tiếp

`vocab_lessons.words` và `curriculum_lessons.words` chứa các từ có UUID; `grammar_patterns.content` chứa ví dụ/bài tập có UUID. Trong khi đó `vocab_progress.word_id` và `grammar_attempts.exercise_id` không có bảng thực thể tương ứng để đặt FK. Mã ứng dụng phải tra JSON và giữ các mảng `retainedWordIds`/`retainedExerciseIds` để bảo vệ danh tính.

Nên thiết kế riêng các mục từ trong bài và bài tập cần được tham chiếu độc lập, giữ UUID cũ; bản nháp, phản hồi AI và snapshot lịch sử vẫn có thể dùng JSONB. Không gộp các từ chỉ vì trùng chữ: nghĩa/ví dụ, nguồn và quyền sở hữu có thể khác nhau. Giữ cơ chế tombstone/lưu trữ nếu bỏ nội dung mà vẫn phải bảo toàn lịch sử.

Đây là việc giúp mô hình quan hệ rõ hơn cho admin, thống kê và trợ lý AI. **Số bảng có thể tăng sau chuẩn hóa**, trong khi thiết kế tốt hơn. Không nên chuyển mọi JSON thành bảng chỉ để chứng minh chuẩn hóa.

Bằng chứng: `apps/api/prisma/schema.prisma` (VocabLesson/VocabProgress, CurriculumLesson, GrammarPattern/GrammarAttempt); `apps/api/src/modules/vocabulary/vocab-review.ts`; `apps/api/src/modules/curriculum/curriculum.service.ts`.

### DB03 — Thống nhất metadata yêu cầu AI, cần thiết kế trước khi gộp

Sáu bảng AI lặp phần user, request hash, trạng thái, thời gian và có chung mục đích hạn mức/chống gửi lặp. `apps/api/src/integrations/gemini-quota.ts` hiện đếm 12 truy vấn cho quota cá nhân/toàn hệ thống qua sáu bảng.

Có thể thiết kế nhật ký yêu cầu dùng chung cho phần metadata và quota, với loại chức năng/model/provider/cờ đã gọi provider. Phần riêng vẫn phải giữ: FK bài đọc/mẫu ngữ pháp, version/apply hash, lease video và quy tắc không lưu hội thoại trợ lý. Có thể cần bảng chi tiết theo chức năng; không cam kết giảm số bảng và không đổi thành một bảng JSON tổng hợp mất ràng buộc. Lợi ích chính là thống nhất cách tính quota và vận hành.

Ưu tiên thấp hơn DB01/DB02; chưa có bằng chứng hệ thống đang chậm do 12 truy vấn, cần đo trước khi tối ưu hiệu năng.

## Cách trình bày khi bảo vệ

- Trình bày một ERD tổng quan theo nhóm, rồi ERD chi tiết từng nhóm; không đưa cả 49 bảng lên một hình duy nhất.
- Với mỗi bảng, giải thích đối tượng lưu, khóa chính/ngoại, quan hệ 1–n/n–n, vòng đời xóa/lưu trữ và truy vấn phục vụ.
- Nêu rõ ranh giới dữ liệu quan hệ, tài liệu biên tập và snapshot lịch sử. Không tuyên bố toàn bộ hệ thống đạt 3NF/BCNF khi chưa phân tích phụ thuộc hàm và những phần phi chuẩn hóa có chủ ý.
- Dùng yêu cầu nghiệp vụ để giải thích việc giữ lịch sử sau xóa/reset, tách bản nháp khỏi bản công khai và không trộn dữ liệu cá nhân với kho admin.

Đánh giá: chưa thấy bảng nào đủ cơ sở kết luận là dư thừa và nên xóa. Có nợ thiết kế cần xử lý ở FK và thực thể nằm trong JSON; không nên tái cấu trúc toàn database chỉ để giảm con số 49. Chưa có thay đổi database nào được thực hiện trong lần rà soát này.

## Phạm vi và nguồn đối chiếu

Đây là kiểm kê và rà soát thiết kế có mục tiêu, không phải chứng nhận đầy đủ mọi ràng buộc hay benchmark hiệu năng. Bằng chứng truy vấn lưu local tại `.artifacts/db-review/inventory.json` và `usage-checks.json`; không chứa khóa API, mật khẩu hay nội dung bài cá nhân.

- [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html): khóa ngoại và ràng buộc nhiều cột bảo vệ quan hệ tại database.
- [PostgreSQL — Designing JSON Documents](https://www.postgresql.org/docs/current/datatype-json.html#JSON-DOC-DESIGN): quan hệ và JSON có thể cùng tồn tại; cấu trúc tài liệu và cách cập nhật cần được thiết kế theo nhu cầu ứng dụng.
