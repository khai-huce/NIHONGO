# C01 + R01 + R02 — Kho nội dung và audio thật

Kế hoạch gốc rà soát ngày 17/09/2026, giữ lại dưới đây để đối chiếu phạm vi. Ngày 20/09 người dùng đã duyệt nội dung/điều chỉnh chữ UI và chọn **Microsoft Edge TTS (`edge-tts`)**. Đã triển khai migration/DB/API/FE; trạng thái, cấu hình, quyết định hiện hành và bằng chứng nghiệm thu ở [CONTENT_PLATFORM.md](CONTENT_PLATFORM.md). Những ghi chú “chờ duyệt/chưa triển khai/Google” phía dưới mô tả giai đoạn khảo sát, không còn là điều kiện chặn.

## Quyết định đã xác nhận

- Giữ React/Vite, Express/TypeScript, Prisma/PostgreSQL. Nội dung Kanji và bài đọc phải có database/API làm nguồn dữ liệu cho các màn học.
- Chuẩn bị phần backend để trang admin sau này nhập/sửa kiến thức, từ vựng, giáo án, Kanji. Đợt này chưa thiết kế lại giao diện học hoặc xây toàn bộ giao diện admin.
- C01: đề xuất nguồn N5 và trình rõ nội dung cần duyệt trước khi nhập/xuất bản; không tự coi dữ liệu mẫu hoặc nội dung AI là tài liệu chuẩn.
- Đã chọn KANJIDIC2 làm nguồn nền cho bộ 103 chữ N5 tham khảo; trợ lý chuẩn bị bản nháp tiếng Việt để người dùng duyệt trước khi xuất bản.
- R02: dùng file audio do dịch vụ TTS phía server tạo; phải chốt nhà cung cấp và chi phí trước khi gọi dịch vụ.
- Người dùng **chưa chọn Google**, sẽ chọn nhà cung cấp/ngân sách khác. Google và giá dưới đây chỉ là phương án đã tham khảo, không phải cấu hình được duyệt. Phần tích hợp dịch vụ R02 chờ lựa chọn này; không cài khóa hoặc phát sinh request trả phí.
- Bổ sung R01: lưu bài đọc cá nhân theo tài khoản, đồng thời chuẩn bị kho bài do admin quản lý. Dịch/furigana/từ/ngữ pháp/quiz chưa có sẽ hiển thị trạng thái thiếu dữ liệu trong khung hiện có, không gán mẫu.
- Giữ toàn bộ tiến độ, sao, lịch sử và giao diện đã duyệt. Không reset DB, không tự nhập bài localStorage của thiết bị vào tài khoản.
- Đã chốt: khi admin sửa nghĩa/cách đọc/gợi nhớ Kanji, cập nhật nội dung thẻ Ôn tập liên quan và giữ nguyên lịch ôn/lịch sử.

## Hiện trạng đã kiểm chứng

- Kanji: 35 chữ (28 N5, 3 N4, 2 N3, 1 N2, 1 N1); bộ thủ có 50 mục. Chưa có bảng/API kho kiến thức hoặc metadata nguồn/duyệt.
- ID Kanji lặp lại ở dữ liệu FE, danh sách chấp nhận phía server và helper lộ trình. Phải chuyển cả ba sang cùng catalog; đổi riêng màn tra cứu là chưa đủ.
- ID `k-*` được dùng trong tiến độ, snapshot thẻ ôn và đánh giá lộ trình; lộ trình cá nhân còn lưu danh sách ký tự.
- `n5-v1` cố định 28 chữ, thứ tự và cách chia 10–10–8. Không được mở rộng trực tiếp rồi diễn giải lại số ngày hoàn thành cũ.
- Bài đọc hiện ở localStorage chung thiết bị; bài mới bị gán bản dịch, từ, ngữ pháp và quiz cố định. Timer tự đếm không theo audio. TTS trình duyệt có phát âm thật nhưng tạm dừng đang hủy và phát lại từ đầu câu.
- Văn bản người dùng đi vào HTML không được kiểm soát; cần render text/ruby có cấu trúc khi nối dữ liệu thật.

## Kiến trúc vừa đủ cho trang admin sau này

Luồng nội dung chung: **nhập/biên tập → kiểm tra và xem trước → xuất bản → database → API đọc → các màn học**. Tiến độ tài khoản tiếp tục ở các bảng riêng hiện có.

| Phần | Cách triển khai |
|---|---|
| Quyền quản trị | Vai trò `user/admin` ở server, tách khỏi Premium. API quản trị kiểm tra phiên và quyền từ DB; đăng ký thông thường không được nhận role. Tài khoản admin đầu tiên chỉ cấp qua lệnh quản trị với ID được chỉ định |
| Kho Kanji/bộ thủ | Entity riêng, ID ổn định, trường tìm kiếm có kiểu rõ ràng; readings/ví dụ/thành phần là dữ liệu có validation. Phân biệt bộ thủ tra cứu với thành phần chiết tự, không đổi nghĩa hai trường |
| Nguồn và biên tập | Lưu nguồn, giấy phép, phiên bản hoặc checksum dữ liệu, trạng thái nháp/xuất bản/lưu trữ, version chống ghi đè. Không công bố bản nháp qua API đọc; sửa nháp không tự thay bản đang xuất bản |
| Bài đọc | Văn bản gốc, đoạn/câu có ID và thứ tự, nội dung biên tập thật nếu có. Phân quyền rõ bài cá nhân và bài công khai; đọc bằng ID/direct URL, không lấy owner do client tự khai |
| Audio | File ở storage phía server; PostgreSQL lưu đường dẫn nội bộ/metadata, duration, mốc câu, giọng, nhà cung cấp và hash nội dung. API kiểm tra quyền khi phát bài riêng; không đưa file riêng vào thư mục public |
| Import | Validation và logic ghi dùng chung cho lệnh nhập ban đầu và API admin tương lai; báo lỗi/trùng/thay đổi trước khi ghi, transaction và retry an toàn; không ghi đè phần biên tập bằng một lần nhập lại |
| Mở rộng sau | Từ vựng, ngữ pháp, giáo trình/bài học có entity theo nghiệp vụ riêng và tham chiếu ID kiến thức. Chưa tạo bảng rỗng hoặc một CMS tổng quát cho tất cả loại nội dung |

Một ứng dụng Express và một PostgreSQL là đủ giai đoạn này. Chưa cần microservice, Redis, hàng đợi phân tán, hệ thống plugin CMS hoặc triển khai cloud.

## Chia task triển khai và nghiệm thu riêng

| Thứ tự | Task | Kết quả phải có |
|---|---|---|
| 1 | C01.0 — Nguồn và bản xem trước | Manifest bộ N5 đề xuất, mapping ID cũ/mới, đối chiếu sai khác, nguồn/giấy phép; phân biệt dữ liệu từ từ điển và phần tiếng Việt cần duyệt |
| 2 | C01.1 — Database và API kho nội dung | Migration cộng thêm, quyền admin tối thiểu, import có validation, API đọc danh sách/chi tiết Kanji/bộ thủ và API quản trị có quyền; nhập thử không sửa DB thật |
| 3 | C01.2 — Nối tất cả màn Kanji | Tra cứu, chi tiết, flashcard, luyện viết, xem chi tiết từ Ôn tập và lộ trình cùng đọc catalog qua API. Server xác minh ID bằng DB và tự lấy nội dung thẻ sao; không tin nghĩa/cách đọc client tự gửi |
| 4 | C01.3 — Lộ trình tương thích | Đưa định nghĩa `n5-v1` nguyên vẹn vào kho phiên bản. Bộ mở rộng có ID phiên bản khác, không chuyển tiến độ cũ ngầm; quy tắc chọn/chuyển phiên bản và UI cần thiết phải chốt trước khi mở bộ mới |
| 5 | R01 — Bài đọc thật | Tạo/danh sách/xem/xóa theo tài khoản và direct URL; bài công khai chỉ đọc bản đã xuất bản. Văn bản gốc không mất khi xử lý lỗi. Bỏ dữ liệu phân tích giả; render an toàn; đổi bài không mang đáp án bài trước sang |
| 6 | R02.1 — Tạo và lưu audio | Tích hợp nhà cung cấp được duyệt, khóa ở server; giới hạn độ dài theo 3000 ký tự đã hiển thị trên UI và theo byte của dịch vụ; cache theo nội dung/giọng, chống gửi lặp, có hạn mức và lỗi thật |
| 7 | R02.2 — Player và nghiệm thu thật | Play/pause/resume/tua/lặp/chuyển câu/tốc độ dùng thời gian media và mốc câu; hủy khi đổi bài/account/route. Giữ cài đặt P09. Sửa văn bản không dùng lại audio cũ sai nội dung; chưa có audio thì không hiển thị thời lượng giả |

Nguồn và chính sách cập nhật thẻ ôn đã chốt; nội dung tiếng Việt đang chuẩn bị để duyệt, chưa nhập DB. Trước khi gọi TTS thật phải có dịch vụ, hạn mức và cấu hình tài khoản được duyệt. Có thể triển khai nền C01.1/R01 độc lập với việc xuất bản toàn bộ nội dung N5 và chọn TTS.

Bản duyệt C01.0 đã chuẩn bị: [KANJI_N5_REVIEW.md](KANJI_N5_REVIEW.md), gồm 103 nghĩa/Hán Việt và ghi chú. Kiểm tra đủ mục, ID/chữ không trùng, 27 ID cũ đúng mapping và âm Hán Việt có trong nguồn đã đạt. Tất cả còn là nháp; ví dụ, gợi nhớ và chiết tự chưa được chuẩn bị/duyệt.

Phần chữ UI tối thiểu của R01 cần người dùng duyệt trước khi sửa: hai đoạn giới thiệu cùng nội dung hiện hứa tự tạo audio/bản dịch sẽ thành “Lưu bài đọc tiếng Nhật để học và mở lại theo tài khoản. Audio, bản dịch và nội dung bổ trợ hiển thị khi đã sẵn sàng.” Dòng mô tả bài demo hiện hứa audio miễn phí không giới hạn sẽ thành “Xem bài đọc và nội dung bổ trợ đã được biên tập. Audio hiển thị khi đã sẵn sàng.” Giữ nguyên vị trí, khung, font và các nhãn/nút; trạng thái thiếu dữ liệu trong từng khung đã được duyệt theo câu trả lời R01.

## Nguồn đã chốt và phần dịch vụ còn chờ

### Nguồn C01

Đề xuất [KANJIDIC2 của EDRDG](https://www.edrdg.org/wiki/KANJIDIC_Project.html). Bản tải kiểm tra ngày 17/09/2026 có 13.108 mục, trong đó 103 mục có `jlpt=4` theo hệ cấp trước 2010; 103/103 mục có âm đọc Vietnamese. Dùng nhóm này làm **bộ N5 tham khảo theo nguồn**, không gọi là danh sách N5 chính thức hiện hành: [JLPT không công bố danh sách từ/Kanji/ngữ pháp cho hệ thi mới](https://www.jlpt.jp/e/faq/).

Checksum SHA-256 file nén đã đối chiếu: `8c8089ad06b6fa27ef2de65b2c136043c9e76f2cbe065843aa917fa20c91adba`. Bản trích 103 mục cùng metadata và mapping ID lưu ở `docs/data/kanji-n5-source-preview.json`; chưa import DB. Có 27 ID cũ được giữ, 76 ID mới đề xuất theo Unicode. Tám mục cũ ngoài bộ chọn vẫn phải được giữ để bảo toàn dữ liệu đang học.

Nguồn cung cấp dữ liệu từ điển như chữ, On/Kun, số nét, bộ thủ và âm Hán Việt. Nghĩa tiếng Việt, ví dụ dịch và gợi nhớ cần biên tập/duyệt riêng. Chữ `体` trong bộ 28 N5 hiện có không thuộc nhóm 103 nói trên; phải trình sai khác, giữ ID/tiến độ và không âm thầm xóa hoặc đổi lộ trình.

[Giấy phép EDRDG](https://www.edrdg.org/edrdg/licence.html): CC BY-SA 4.0, ghi nguồn/giấy phép và có quy trình cập nhật dữ liệu. Điều kiện này áp dụng cho dữ liệu tương ứng; trang giấy phép xác nhận phần mềm dùng dữ liệu không bắt buộc có giấy phép mã nguồn mở. Vị trí ghi nguồn trên web cần duyệt cùng UI tối thiểu trước khi phát hành nội dung.

### Dịch vụ R02 — chưa chốt

Phương án đã khảo sát nhưng **chưa được người dùng chọn**: Google Cloud Text-to-Speech, giọng Nhật Neural2 (`ja-JP-Neural2-B`), audio cùng mốc câu từ SSML. [API timepoints](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/text/synthesize) trả audio và thời gian marker. Nhà cung cấp được chọn sau này phải được nghiệm thu audio/mốc câu thực tế; nếu không trả mốc, phải chọn cách đồng bộ khác và công bố đúng giới hạn trước khi triển khai.

[Giá đối chiếu 17/09/2026](https://cloud.google.com/text-to-speech/pricing): Neural2 miễn phí đến 1 triệu ký tự/tháng theo bảng giá, sau đó 16 USD/triệu; WaveNet miễn phí đến 4 triệu, sau đó 4 USD/triệu. Cần bật billing. Hạn mức riêng đề xuất cho ứng dụng local: 100.000 ký tự tính phí/tháng, tương đương 1,60 USD Neural2 hoặc 0,40 USD WaveNet theo đơn giá trước khi trừ miễn phí, chưa tính thuế/dịch vụ khác. Hạn mức ứng dụng không giới hạn các ứng dụng khác dùng chung tài khoản Google.

Văn bản bài cần tạo audio được gửi sang nhà cung cấp; email, thông tin đăng nhập và tiến độ không cần gửi. Audio tạo một lần rồi phát lại; đổi tốc độ phát không gọi TTS lại. Cần quyết định rõ lúc nào người dùng yêu cầu tạo audio và cấu hình credentials local trước nghiệm thu thật; không gửi khóa bí mật vào chat.

### Chính sách thẻ ôn

Đã được người dùng đồng ý: khi admin xuất bản bản sửa Kanji, cập nhật nội dung snapshot thẻ ôn liên quan, tăng version để chặn màn cũ, giữ dueAt/interval/lịch sử. Áp dụng cả thẻ đang gắn sao và thẻ đã bỏ sao để lần gắn lại dùng nội dung mới, không làm mất lịch cũ.

## Nghiệm thu bắt buộc

- Sửa/xuất bản nội dung qua API quản trị → màn học lấy đúng bản từ DB sau tải lại, không cần sửa mảng trong source; mất API báo lỗi, không tự thay bằng dữ liệu mẫu.
- User/khách không ghi được nội dung chung hoặc đọc nháp; tài khoản A/B không đọc bài/audio riêng của nhau. Bài cũ trên thiết bị không tự trở thành bài tài khoản.
- ID/link/sao/lịch/history/lộ trình cũ giữ nguyên. Kanji mới đã xuất bản có thể tra cứu, gắn sao, đánh giá và thêm vào lộ trình mà không chỉnh danh sách ID hardcode.
- Import trùng, cập nhật đồng thời, rollback và publish có version được kiểm tra; không xóa cứng nội dung đã được học.
- Hai bài khác nhau không dùng lại dữ liệu phân tích cố định; input HTML không được chạy; chưa có nội dung phải hiển thị đúng trạng thái thiếu.
- Audio thật: nghe, pause/resume đúng vị trí, tua, lặp, tốc độ, cuối bài, đổi route, mất mạng, retry và không tạo hai audio cùng lúc. Duration và câu highlight phải khớp media; sửa bài vô hiệu hóa audio cũ.
- Kiểm thử giới hạn TTS và cache không phát sinh gọi lặp khi F5/phát lại; không gọi dịch vụ trả phí trong bộ test tự động thông thường.
- Build FE/BE, test API/content/owner/import/player và hồi quy tiến độ/Ôn tập/P06–P10; cập nhật backlog theo từng task thực sự đạt. Không đánh dấu cả hệ thống hết mock khi A04/A05, từ vựng hoặc ngữ pháp chưa được làm.
