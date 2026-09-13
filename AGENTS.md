# Làm việc với dự án NIHONGO

- Khi người dùng hỏi đề xuất task tiếp theo hoặc yêu cầu hoàn thiện chức năng FE giả lập, đọc `docs/FEATURE_BACKLOG.md` và đối chiếu source/status hiện tại trước khi đề xuất.
- Ưu tiên đã chốt: bài học, tiến độ và lộ trình cá nhân. Nguồn dữ liệu học chốt riêng trước từng nhóm; không tự giả định đã có nội dung đầy đủ.
- Giữ giao diện, bố cục, nhãn và thông tin hiện có khi nối chức năng thật. Không tự thiết kế lại trang.
- Chỉ ⭐ chủ động thêm vào Ôn tập. Bỏ sao giữ lịch/lịch sử; gắn lại tiếp tục lịch cũ. Đã thuộc/hoàn thành bài không tự thêm thẻ.
- P02 đã chốt: sửa từ Chủ động cập nhật nội dung thẻ ôn hiện có, giữ lịch/lịch sử; xóa từ/bài giữ thẻ. Người dùng đã duyệt nút ⭐ cạnh phát âm trên thẻ Ôn tập để bỏ sao khi nguồn không còn.
- P03 đã chốt: nhập JSON/text chỉ thêm mới, bỏ trùng đủ bốn trường sau trim; người dùng duyệt hộp thoại xem trước rồi xác nhận lưu. Bài khách giữ riêng, không triển khai chuyển vào tài khoản. AI Format chưa có dịch vụ, không giả kết quả AI.
- P04 đã chốt: Flashcard Chủ động lưu Đã biết/Chưa biết theo UUID từ và tài khoản. Mở lại ở từ đầu tiên chưa đánh giá; đủ hết thì hiện kết quả cũ. Học lại xác nhận số từ đã đánh giá, chỉ reset bài hiện tại; sửa nội dung giữ trạng thái theo UUID. Không tác động sao/SRS; khách chỉ có tiến độ trong lượt đang mở. Kết quả quiz/gõ thuộc P05 riêng.
- Không tự nhận dữ liệu localStorage dùng chung thiết bị vào tài khoản; không reset DB hoặc xóa dữ liệu để triển khai.
- Sau task được người dùng yêu cầu làm, cập nhật trạng thái và bằng chứng nghiệm thu trong backlog. Yêu cầu đề xuất/lập plan không tự mở rộng thành triển khai mọi task.
