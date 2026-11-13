# A05a/A05b — Nội dung bổ trợ bài đọc cá nhân

**Hoàn thành local 13/11/2026:** A05a đã nghiệm thu Gemini thật; A05b đã nghiệm thu thành công lúc 17:31 giờ Việt Nam bằng `gemini-3.5-flash-lite` riêng theo phê duyệt mới. Các đoạn lỗi/chờ duyệt phía dưới là nhật ký trước mốc hoàn thành, không còn là trạng thái hiện tại.

## Phạm vi

- Chỉ bài cá nhân đã lưu của tài khoản hiện tại. Không sửa bài thư viện, nhập bài khách hoặc đưa kết quả AI vào kho kiến thức chung.
- A05a dùng Gemini/model chung như A04; A05b dùng model riêng đã duyệt qua `READING_QUIZ_GEMINI_MODEL` (local: `gemini-3.5-flash-lite`). Cả hai vẫn dùng key/quota miễn phí chung, một yêu cầu cho mỗi thao tác, tối đa 3.000 ký tự Unicode và 100 câu. Không tự chia bài, retry, fallback model hoặc bật thanh toán.
- **Tạo từ vựng/ngữ pháp:** tối đa 15 từ và 5 mẫu ngữ pháp có trong bài. Chỉ tạo nhóm đang trống; nếu đã có từ vựng thì chỉ bổ sung ngữ pháp, và ngược lại.
- **Tạo câu hỏi:** tối đa 5 câu đọc hiểu, mỗi câu có 4 lựa chọn và một đáp án đúng. Đề/lựa chọn tiếng Nhật, giải thích tiếng Việt và dẫn chứng từ bài. Bài ngắn có thể ít câu hơn hoặc không đủ nội dung để tạo; không sinh cho đủ số lượng.
- Giữ khung học hiện có. Hai nút được thêm cạnh Phân tích bài đọc; mỗi nút mở xem trước, sửa/xóa mục rồi xác nhận mới lưu.
- Không tạo XP, thẻ ôn hoặc kết quả học. Làm quiz vẫn giữ trong lượt mở; F5 bắt đầu lại phần trả lời. Lưu kết quả theo tài khoản thuộc R03.

## Cách dùng

1. Đăng nhập → **Trọn đời → Đọc hiểu** → tạo hoặc mở một bài cá nhân đã lưu.
2. Bấm **Tạo từ vựng/ngữ pháp** hoặc **Tạo câu hỏi**. Chỉ văn bản Nhật, ID câu và danh sách nhóm cần tạo được gửi sang Gemini; không gửi email, lịch sử học hoặc bài khác.
3. Xem từng mục màu vàng. Sửa từ/cách đọc kana/Hán Việt/nghĩa; hoặc mẫu/ý nghĩa/ví dụ/dịch ví dụ; hoặc đề/bốn lựa chọn/đáp án/giải thích. Có thể **Bỏ mục này**. Dẫn chứng phải trích nguyên văn từ đúng câu được chọn.
4. Bấm **Áp dụng vào bài**. Bài được lưu một lần và tải lại từ server; F5 giữ nội dung đã xác nhận. Các nhóm đã có, tiếng Nhật, dịch/furigana và audio giữ nguyên.
5. Đóng xem trước trước khi áp dụng không sửa bài. Mở lại cùng phiên bản dùng cache riêng tài khoản, không gọi thêm Gemini. Nhóm đã có nội dung không được tạo đè.

AI có thể giải thích sai hoặc tạo lựa chọn chưa rõ ràng. Luôn rà soát đáp án với bài gốc trước khi lưu. Validation chỉ xác minh hình thức, căn cứ văn bản và quyền ghi; không chứng nhận tính đúng đắn ngôn ngữ. Nội dung có nhãn **AI hỗ trợ** kèm dẫn chứng; không gọi là đề JLPT chính thức.

## Đối chiếu kho đã xuất bản

- Từ vựng đối chiếu chính xác từ + cách đọc (chuẩn hóa kana) với từ trong giáo trình và ví dụ Kanji đã xuất bản. Hiện nghĩa/nguồn tham khảo ở preview; không ghi đè nghĩa theo ngữ cảnh do người dùng sửa.
- Ngữ pháp chỉ gắn liên kết/cấp JLPT khi có duy nhất một mẫu đã xuất bản khớp công thức sau chuẩn hóa. Không nhận ID, URL hoặc cấp JLPT từ Gemini/client. Chưa khớp thì báo rõ, không gán cấp giả.
- GET bài đọc tra lại kho hiện tại. Mẫu bị lưu trữ hoặc trở nên không duy nhất không còn liên kết/cấp JLPT trên phần AI của bài đã lưu; nội dung cá nhân vẫn được giữ.

## API và lưu trữ

- `POST /api/reading/articles/:articleId/supplements`: `{id, expectedUserId, version, kind: "study" | "quiz"}`.
- Response: `{userId,id,articleId,version,kind,cached,result,catalog}`. `result` gồm `groups`, `warnings`, `vocabList`, `grammarList`, `quizList`. Nhóm không được yêu cầu/đã có luôn là mảng rỗng.
- Mỗi mục mới có `evidence: [{sentenceId,quote}]` (1–3 trích dẫn). Ví dụ ngữ pháp phải nằm trong trích dẫn; từ phải có nguyên dạng hoặc dạng gốc từ Kuromoji, kể cả từ ghép như 勉強する. Không bỏ qua các token ở giữa để ghép từ không có trong bài.
- `POST /api/reading/articles/:articleId/supplements/apply`: `{requestId,expectedUserId,version,kind,vocabList,grammarList,quizList}`. Giới hạn toàn bộ body 128 KiB UTF-8. FE đo trước, giữ bản xem trước quá lớn để người dùng rút gọn thay vì mất kết quả.
- Chỉ sửa/bỏ mục trong preview; ID câu hỏi do server tạo, giữ ổn định khi xóa mục khác. Apply không nhận catalog metadata. Lưu kết quả và `aiEvidence` vào các mảng JSONB hiện có của `reading_articles.content`, tăng version trong transaction.
- Migration cộng thêm `202611120001_reading_supplements` thêm `purpose` vào `reading_analysis_requests`: `annotations` (A04 cũ/mặc định), `study`, `quiz`. Dùng lại FK tài khoản/bài, hash, cache và quota; không tạo kho/tables nội dung song song, không reset dữ liệu cũ.

## Bảo vệ dữ liệu và xử lý lỗi

- Kiểm tra owner, phiên/tài khoản, bài cá nhân chưa xóa, phiên bản và hash trước/sau provider và trước ghi dưới khóa hàng. Đổi user/bài/version trên FE hủy phản hồi cũ.
- Request UUID/cache phân biệt tài khoản, bài, model, phiên bản và mục đích; A04 không lấy kết quả A05 và ngược lại. Cache-hit không gọi provider; provider lỗi vẫn tính quota chung.
- Hai tab áp dụng cạnh tranh: chỉ bản hợp lệ được lưu. Retry cùng UUID/payload sau mất phản hồi trả thành công mà không tăng version lần nữa; sửa payload hoặc bài đã đổi bị chặn.
- Lỗi chưa xác định kết quả lưu khóa bản sửa và cho thử lại cùng nội dung hoặc tải lại bài. Không tự đoán thành công hay ghi dở các nhóm.
- Provider tối đa 90s, FE 105s, pending 120s. Lỗi 503/quota/định dạng hiển thị lỗi thật, không dùng dữ liệu mẫu thay thế.

## Nghiệm thu local

Nghiệm thu ngày 12–13/11/2026. Bằng chứng nằm trong `.artifacts/a05/`; database UI/Gemini riêng `nihongo_a05_ui_test`, database unit/integration riêng `nihongo_test`.

- API ban đầu: 22 ca A05 và 125 ca hồi quy liên quan (A04 24, Reading 27, Assistant 20, Grammar 13, Sentence Analysis 41), tổng 147 ca khác nhau đạt. Có kiểm tra quyền/Origin/session/version/cache/purpose, lưu cạnh tranh/idempotency, từ ghép dạng gốc, đối chiếu catalog, bảo toàn audio/dịch/ruby và nội dung đã có. Kết quả sau cấu hình model riêng ở mốc hoàn thành dưới đây.
- 228 FE/admin/shared tests, TypeScript API/tests, kiểm tra ranh giới import 255 file và build web/admin/API đạt. Lượt cuối sau điều chỉnh prompt chạy lại bộ A05 và API build. Vite còn cảnh báo kích thước bundle lớn có sẵn.
- UI desktop 1280×800 và màn hẹp 390×844: xem trước, sửa/xóa, dẫn chứng sai/lựa chọn trùng làm khóa Apply, lưu/F5 và đáp án theo lựa chọn đã sửa đạt. Bộ dữ liệu kiểm thử giao diện được ghi rõ là fixture, không dùng làm bằng chứng Gemini thật. Ảnh: `study-preview-desktop.png`, `study-preview-mobile.png`, `quiz-preview-mobile.png`, `saved-quiz-desktop.png`.
- Gemini thật `gemini-3.8-flash`: bài hai câu trả 5 từ/3 mẫu có dẫn chứng; đóng preview không ghi, mở lại dùng cache không gọi provider, sửa nghĩa rồi áp dụng version1 và F5 giữ nội dung. Ảnh `gemini-study-preview.png`, trạng thái `qa-real-study.json`. Lượt đầu ngày 12/11 gặp 503/timeout; lỗi không ghi nội dung giả hoặc thay model.
- Migration cộng thêm đã áp dụng vào DB local. Snapshot trước/sau giữ nguyên hash của 32 bài đọc và 32 bản ghi audio cũ; ledger cũ chưa có hàng. Không thay role, sao, XP hoặc nội dung tài khoản thật. Bằng chứng `main-before.json`, `main-after.json`, `migration.log`.

- **Chưa nghiệm thu A05b với provider thật:** các lượt tạo câu hỏi ngày 13/11 trả 503 hoặc timeout 90s, kể cả thử lại sau nhiều giờ. Luồng UI/lưu/quiz đã đạt bằng fixture, nhưng chưa có bản câu hỏi Gemini thật hợp lệ để xác nhận. Giữ model/quota, không tự fallback, reset hạn mức hoặc dùng fixture thay kết quả thật. Ảnh lỗi cùng bài có nội dung A05a đã lưu: `gemini-study-saved-quiz-unavailable.png`.
- Snapshot cuối `qa-final.json`: bài Gemini thật version1 có 5 từ/3 mẫu/0 câu hỏi; bài fixture version2 có 2 từ/2 mẫu/1 câu hỏi. XP0/sao0. Đã kết thúc phiên và dừng server QA riêng, giữ dữ liệu QA phục vụ lần nghiệm thu tiếp; không dừng dịch vụ chính.

**Bước còn thiếu tại mốc trên đã hoàn tất lúc 17:31:** xem mốc nghiệm thu cuối bên dưới.

### Kiểm tra lại theo yêu cầu 13/11/2026, 17:25 giờ Việt Nam

Chạy đúng API A05b với model đang cấu hình `gemini-3.8-flash`, phiên QA riêng và bài hai câu version1; không đổi prompt, tham số, model hay quota. Google trả HTTP503 sau 30.040ms, error status `UNAVAILABLE`, thông báo model đang có nhu cầu sử dụng cao và đề nghị thử lại. API trả503 sau 30.143ms, ledger quiz failed/providerCalled=true; không có câu hỏi để áp dụng. Bằng chứng đã loại khóa: `.artifacts/a05/live-recheck.json`; công cụ đo tạm `.artifacts/a05/recheck-live.mts` chỉ quan sát request thật, không giả provider.

Lượt này xác nhận lỗi quá tải từ provider, không phải lỗi validation JSON/ghi database. Thông báo “chưa phản hồi” của các lượt cũ gộp ngoại lệ fetch, nên chỉ từ thông báo đó không thể phân biệt chắc timeout/DNS/TLS. Không có thay đổi model hoặc hành vi tự retry trong bản bàn giao.

Các phương án đã trình duyệt (người dùng sau đó chọn phương án 1):

1. **Khuyến nghị:** cấu hình `READING_QUIZ_GEMINI_MODEL=gemini-3.5-flash-lite` riêng A05b, mặc định khi chưa cấu hình vẫn theo model chung. Giữ quota miễn phí, schema/preview/lưu hiện có; không tự fallback. Nghiệm thu tối đa hai lượt thật trên QA, kiểm tra căn cứ/đáp án rồi sửa/lưu/F5/làm bài. Chất lượng và tính sẵn sàng cần xác minh, chưa coi là đã đạt.
2. Giữ 3.8, thử `thinkingLevel=low` riêng A05b và bỏ sampling override cho yêu cầu đó; giữ giới hạn output hiện tại. Có thể giảm thời gian trả lời nhưng không khắc phục công suất phục vụ gây 503. Không chọn phương án này.
3. Giữ toàn bộ cấu hình, chờ và thử lại sau; không có thời điểm phục hồi chắc chắn. Chưa bổ sung tự retry vì đây là thay đổi số lượt provider/quota.

Tài liệu Google đã đối chiếu: [xử lý lỗi và retry](https://aistudio.google.com/docs/troubleshooting), [thinking 3.8](https://aistudio.google.com/docs/whats-new-gemini-3.8#understanding-reasoning-levels), [khả năng 3.5 Flash-Lite](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite), [Free Tier](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite). Google ghi 3.6+ bỏ qua temperature tùy chỉnh (sau này có thể 400); đây là điểm nên chuẩn hóa, không phải bằng chứng nguyên nhân 503.

### Nghiệm thu thành công với model riêng A05b

- Người dùng duyệt `gemini-3.5-flash-lite` riêng A05b và tối đa hai lượt gọi thật. Đã cấu hình `READING_QUIZ_GEMINI_MODEL` tại API; không đổi `GEMINI_MODEL`, key hay quota. Khi không có override thì dùng model chung; lỗi không tự chuyển model. Request quiz có override dùng sampling mặc định của model; các chức năng khác giữ tham số cũ.
- Đúng **một** lượt provider thật: HTTP200 sau 1.785ms, API200 sau 1.890ms, một câu hỏi đúng nguồn cho bài hai câu. Đề hỏi nơi Tanaka học tiếng Nhật, bốn lựa chọn Nhật, đáp án thứ hai là thư viện; giải thích Việt và dẫn chứng nguyên văn đúng câu thứ hai. Bài ngắn chỉ tạo một câu, không thêm cho đủ năm. Bằng chứng `live-flash-lite-1.json`.
- UI mở lại lấy cache (`providerCalled=false`), sửa giải thích, áp dụng version1→2; F5 giữ câu hỏi, năm từ và ba mẫu cũ. Chọn đáp án thứ hai hiện “Chính xác!”, giải thích đã sửa và đúng căn cứ. Ảnh `gemini-quiz-preview-success.png`, `gemini-quiz-saved-f5.png`. Snapshot `qa-accepted.json`: một request 3.5 thật, một cache đã áp dụng, XP0/sao0.
- Cache chứa model và phiên bản prompt quiz; không dùng kết quả 3.8 cho 3.5, request UUID cũ không được dùng lại khi đổi model. Ba test mới kiểm tra chọn model/sampling, cache/ledger theo model và lỗi không fallback vẫn tính quota chung. Lượt cuối **62/62 ca API** đạt (25 A05 +24 A04 +13 Grammar), tổng 150 ca API khác nhau với 88 hồi quy còn lại đã đạt trước đó. API build, TypeScript tests và boundaries 255 đạt; báo cáo `model-override-tests.json`.
- Lượt gọi thứ hai không cần dùng. Không thay nội dung database chính hoặc thêm dữ liệu thử vào kho chung. Nội dung AI vẫn cần người học rà soát; hoàn thành luồng chức năng không đồng nghĩa mọi câu do AI sinh đều chính xác.
