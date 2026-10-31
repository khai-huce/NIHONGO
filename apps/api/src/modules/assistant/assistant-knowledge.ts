import type { PrismaClient } from '@prisma/client';
import type { JlptResourceInput, JlptResourceKind, JlptResourceView } from '@nihongo/shared/contracts/jlpt';
import { resolveResources, searchResources } from '../jlpt/jlpt.resources.js';

export interface AssistantSource { id: string; title: string; url: string; content: string }
interface HelpSource extends AssistantSource { tags: readonly string[]; prefixes: readonly string[] }
const guide = (id: string, title: string, url: string, content: string, tags: string[], prefixes = [url]): HelpSource =>
  Object.freeze({ id: `help:${id}`, title, url, content, tags: Object.freeze(tags), prefixes: Object.freeze(prefixes) });

/** Curated product facts, not user data. Keep changes aligned with the corresponding feature docs/source. */
export const assistantHelpSources: readonly HelpSource[] = Object.freeze([
  guide('site', 'Sử dụng NIHONGO', '/kanji', 'NIHONGO có Hán tự, Bảng chữ cái, Giáo trình từ vựng, Ngữ pháp, Chủ động, Ôn tập, Lộ trình Kanji, Lộ trình JLPT, Đọc hiểu, Shadowing, Trọng âm và Xếp hạng. Dùng menu để mở từng chức năng. Nội dung công khai lấy từ kho đã xuất bản; mục chưa có dữ liệu phải báo chưa có. Trợ lý chỉ hướng dẫn, không tự thêm sao, sửa bài, làm bài, ghi điểm, mở khóa hoặc đổi quyền. Nếu không có dữ liệu cá nhân được cung cấp thì không biết tiến độ, lịch ôn, email hoặc nội dung riêng của người hỏi.', ['bắt đầu', 'chức năng', 'sử dụng', 'hướng dẫn', 'web', 'nihongo'], []),
  guide('kanji', 'Hán tự và tra chữ viết tay', '/kanji', 'Tại Hán tự, tìm theo chữ hoặc âm Hán Việt, chọn cấp và bấm chữ để mở chi tiết từ kho đã xuất bản. Chi tiết có cách đọc, nghĩa và nội dung biên tập đã có; thiếu thông tin không đồng nghĩa lỗi tải. Vùng vẽ có Tra chữ, Hoàn tác, Xóa: vẽ rồi bấm Tra chữ và chọn gợi ý. DaKanji xử lý ở máy chủ, có thể nhận nhầm; chữ ngoài kho báo chưa có, không tạo nghĩa giả. Chỉ bấm ngôi sao chủ động mới thêm vào Ôn tập. Các nhãn số lượng giới thiệu cũ không phải số đếm kho hiện tại.', ['kanji', 'hán tự', 'hán việt', 'viết tay', 'tra chữ', 'bộ thủ', 'chiết tự']),
  guide('kana', 'Bảng chữ cái', '/tu-vung/bang-chu-cai', 'Chọn Hiragana hoặc Katakana. Bấm chữ để nghe/chọn chữ bắt đầu. Flashcard lật chữ/romaji, chuyển chữ, đổi chiều, trộn và tự động; biết/chưa biết chỉ trong lượt đang mở, đóng hoặc F5 không lưu. Luyện viết là viết tự do theo mẫu, có hoàn tác/xóa/ẩn mẫu/chuyển chữ, chưa chấm nét hoặc hướng dẫn thứ tự nét. Quiz nghe lưu lượt hoàn thành theo tài khoản; không lưu lượt dở. Khách dùng được các phần luyện tập. Loa cần giọng Nhật trên thiết bị.', ['kana', 'hiragana', 'katakana', 'bảng chữ cái', 'romaji', 'âm ghép', 'flashcard chữ']),
  guide('curriculum', 'Giáo trình từ vựng', '/tu-vung/giao-trinh', 'Mở giáo trình → chủ đề → bài. Mỗi bài có đúng ba chế độ Flashcard, Trắc nghiệm, Nhồi nhét. Hoàn thành một trong ba chế độ ghi nhận bài hoàn thành theo tài khoản; học lại giữ mốc. Nút Review ở giáo trình mở hộp chọn bài để ghép từ và học đủ ba chế độ. Review lưu kết quả riêng theo nhóm bài, không tự đánh dấu bài gốc hoàn thành; giữ từng UUID từ gốc. Bấm sao từng từ hoặc Thêm cả bài vào ôn tập là thao tác chủ động. Danh sách hiện tại chỉ gồm giáo trình đã xuất bản, không bảo đảm luôn có Tango/Minna.', ['giáo trình', 'từ vựng', 'tango', 'review gộp', 'chủ đề', 'nhồi nhét', 'trắc nghiệm']),
  guide('active', 'Bài học Chủ động và nhập từ', '/ca-nhan/chu-dong', 'Chọn hoặc tạo bài, nhập/sửa từ và học bằng Flashcard, Trắc nghiệm hoặc Nhồi nhét. Đăng nhập lưu bài theo tài khoản; bài khách trên thiết bị giữ riêng, không tự chuyển vào tài khoản. Nhập JSON/text mở xem trước, chỉ xác nhận mới thêm; bỏ trùng khi cả từ, cách đọc, Hán Việt, nghĩa giống sau trim. Mỗi bài tối đa 500 từ. AI Format dành cho tài khoản: tối đa 6.000 ký tự/50 từ, dùng Gemini, cho xem trước và sửa bốn trường; phần AI bổ sung cần rà soát. AI không tự lưu hoặc thêm sao; lỗi giữ bản nhập. Nút dữ liệu demo có thể thay nội dung bài, không dùng nó như thao tác thêm mới.', ['chủ động', 'nhập từ', 'json', 'text', 'ai format', 'bài riêng', 'bài cá nhân', 'demo']),
  guide('review', 'Ôn tập và ngôi sao', '/ca-nhan/on-tap', 'Chủ động bấm ngôi sao để thêm thẻ vào Kanji/Từ vựng/Ngữ pháp. Bỏ sao dừng ôn và giữ lịch/lịch sử; gắn lại tiếp tục lịch cũ, quá hạn thì ôn ngay. Chọn tab → Ôn tập ngay → lật thẻ → Quên rồi/Khó/Tốt/Dễ. Chỉ chuyển khi server lưu thành công. Lịch: Quên rồi 1 phút, Khó 6 phút, Tốt tối thiểu 1 ngày và gấp đôi khoảng trước, Dễ tối thiểu 4 ngày và gấp ba, tối đa 365 ngày. Học lại từ đầu phải xác nhận, chỉ reset thẻ đang gắn sao của tab đó, giữ lịch sử. Đã thuộc/hoàn thành bài không tự thêm sao.', ['ôn tập', 'srs', 'ngôi sao', 'gắn sao', 'bỏ sao', 'quên rồi', 'khó', 'thẻ', 'đến hạn', 'reset']),
  guide('roadmap', 'Lộ trình Kanji cá nhân', '/ca-nhan/lo-trinh', 'Lộ trình Kanji khác Lộ trình JLPT. Tab của tôi cho tạo từ các chữ có trong kho, đổi tên và xóa; số chữ mỗi ngày chỉ sửa trước khi bắt đầu học. Học ngay tiếp tục ngày chưa hoàn thành; đánh giá Đã thuộc hoặc Chưa thuộc đủ mọi chữ mới hoàn thành ngày. Học lại giữ hoàn thành. Tab mặc định dùng catalog N5 n5-v1 gồm 28 chữ/3 ngày, không phải bộ N5 đầy đủ; N4–N1 không thay bằng chữ N5. Lưu riêng theo tài khoản, khách riêng. Không tự thêm sao.', ['lộ trình kanji', 'lộ trình cá nhân', 'ngày lộ trình', 'số chữ', 'mỗi ngày', '28 chữ']),
  guide('jlpt', 'Lộ trình JLPT và kiểm tra cuối buổi', '/tron-doi/jlpt', 'Chọn cấp JLPT để xem lộ trình đã xuất bản. Chỉ đạt bài kiểm tra cuối buổi mới hoàn thành buổi; không yêu cầu đánh dấu đủ mục học. Ngưỡng mặc định 80%, admin chỉnh 1–100%; dùng đúng ngưỡng của đề đang mở. Buổi mở tuần tự; thi lại không giới hạn, giữ mốc đã đạt và điểm cao nhất. Đáp án dở lưu theo tài khoản để F5 tiếp tục; nộp đủ câu và chờ lưu xong. Đề bị admin thay đổi làm lượt đang mở hết hiệu lực, không thu hồi kết quả cũ. Lộ trình NIHONGO N5 đã được biên soạn có AI hỗ trợ; không phải đề JLPT chính thức hoặc nội dung được chứng nhận bản ngữ. Không khẳng định cấp khác có giáo án khi chưa tra kho.', ['jlpt', 'n5', 'n4', 'n3', 'n2', 'n1', 'cuối buổi', 'mở khóa', 'nộp bài', 'điểm đạt', '80%', 'thi lại']),
  guide('grammar', 'Ngữ pháp và bài tập', '/ngu-phap', 'Mở giáo trình → bài → mẫu câu để xem cấu trúc, giải nghĩa, phạm vi sử dụng, lưu ý và ví dụ. Nút Làm bài tập mở ba dạng Việt→Nhật, Nhật→Việt, Sắp xếp. Kiểm tra dùng đáp án được chấp nhận trên server; AI đánh giá dùng Gemini, cũng quyết định đúng/sai và tiến độ. Lần chấm thành công đầu giữ điểm; thử lại luyện thêm; xem đáp án trước không tính đúng. Lỗi AI không ghi điểm. Đăng nhập lưu từng câu/F5; khách giữ lượt riêng. Không có Audio trực quan; loa ví dụ vẫn có. Hoàn thành đủ bài tập đang có giữ mốc khi học lại.', ['ngữ pháp', 'mẫu câu', 'bài tập', 'dịch', 'việt nhật', 'nhật việt', 'sắp xếp', 'ai đánh giá', 'minna']),
  guide('sentence', 'Phân tích câu', '/ngu-phap', 'Trong trang Ngữ pháp có khung Phân tích câu, tối đa 300 ký tự. Nút kính lúp dùng Kuromoji trên backend để tách từ, cách đọc, từ loại và dạng gốc, khách cũng dùng được; từ chưa có trong kho vẫn có thể có từ loại do từ điển hình thái. Nghĩa/Hán Việt chỉ lấy kho đã xuất bản, thiếu thì báo thiếu. Nút phân tích cấu trúc bằng Gemini cần đăng nhập và quota, bổ sung dịch/cụm/bước dịch/cấu trúc/giải thích theo câu nhập. Chỉ mẫu đã xuất bản khớp duy nhất mới có link/sao; không tự nhập phân tích AI vào kho. Không có lời hứa hoạt động offline.', ['phân tích câu', 'kính lúp', 'kuromoji', 'từ loại', 'cấu trúc câu', 'tách từ', 'ngữ cảnh']),
  guide('reading', 'Đọc hiểu', '/tron-doi/doc-hieu', 'Đọc hiểu có kho bài thư viện và bài riêng do người dùng nhập. Tài khoản lưu bài riêng; khách riêng. Audio bài đọc dùng file MP3 tạo bằng Edge TTS phía server và phát theo câu, có tốc độ/tạm dừng/tua. Nếu dịch, furigana, từ vựng hoặc quiz chưa được biên tập thì hiển thị thiếu, không tự có nội dung mẫu. Không khẳng định đã có chức năng tự dịch hoặc sinh quiz ở Đọc hiểu. Kho công khai chỉ dùng bản xuất bản; bản nháp admin không thay bản đang học.', ['đọc hiểu', 'bài đọc', 'audio', 'mp3', 'edge tts', 'nanami']),
  guide('shadowing', 'Shadowing và chép chính tả', '/tron-doi/shadowing', 'Khách học video thư viện. Đăng nhập để thêm video YouTube dưới 30 phút, tạo phụ đề/dịch bằng Gemini hoặc nhập JSON/SRT/VTT; xem trước, rà soát/chỉnh rồi mới lưu. Lưu câu đang học, bookmark và kết quả trả lời đầu theo tài khoản; thử lại chỉ luyện thêm. Bookmark không phải sao Ôn tập, không tự SRS/XP. Ẩn video hoặc tab thì tạm dừng; chỉ tốc độ YouTube hỗ trợ. Hạn mức AI Shadowing 3 video/tài khoản và 10 toàn hệ thống/24 giờ, cộng quota AI chung. Không bảo đảm phụ đề/dịch/mốc AI luôn đúng.', ['shadowing', 'youtube', 'video', 'phụ đề', 'srt', 'vtt', 'chép chính tả', 'bookmark', 'nghe viết']),
  guide('pitch', 'Tra trọng âm', '/trong-am', 'Tra từ bằng Kanji/kana/romaji để xem mục và biến thể trọng âm từ Kanjium CC BY-SA 4.0. Dạng chia chỉ hiện khi nguồn có dữ liệu, không suy đoán bằng AI. Loa TTS là phát âm tham khảo, không bảo đảm đúng biến thể trọng âm đang xem. Tra cứu không tự thêm sao, XP hoặc tiến độ.', ['trọng âm', 'pitch', 'accent', 'kanjium', 'heiban', 'atamadaka', 'nakadaka', 'odaka']),
  guide('writing', 'Luyện viết Kanji', '/luyen-viet', 'Chọn Kanji từ kho, viết trên canvas, đổi màu/cỡ bút và xóa nét. Đây là luyện viết tự do; không có chứng nhận đúng nét/thứ tự nét hoặc chấm AI. Tra nhận diện chữ viết tay là chức năng ở trang Hán tự, không phải chấm bài luyện viết. Nút tải file/PDF chưa có chức năng xuất file hoàn chỉnh.', ['luyện viết', 'canvas', 'màu bút', 'cỡ bút', 'chấm nét', 'thứ tự nét']),
  guide('leaderboard', 'XP và xếp hạng', '/xep-hang', 'Có Tổng XP và XP tháng; cùng điểm đồng hạng. Ôn SRS đến hạn lưu thành công +2/thẻ/ngày; ngày lộ trình Kanji hoàn thành lần đầu +10; câu đúng trong lượt quiz/nhồi nhét/kana hoàn thành hoặc ngữ pháp lần chấm đầu +1/câu/ngày. Tối đa 200 XP/tài khoản/ngày Việt Nam. Không cộng bù lịch sử, không thưởng xem trang/reset/gắn sao. Thẻ ghi nhớ là sao đang bật; ngày lộ trình là tổng ngày hoàn thành của lộ trình hiện còn. Chưa có trận Đấu trí thật; không tự cộng XP từ JLPT, Shadowing hoặc trợ lý.', ['xp', 'xếp hạng', 'điểm thưởng', 'đấu trí', 'premium', 'đồng hạng', '200']),
  guide('notifications', 'Chuông thông báo ôn tập', '/ca-nhan/on-tap', 'Chuông trên header nhắc thẻ gắn sao đến hạn theo ba loại. Mở hộp chưa đánh dấu đọc; bấm thông báo hoặc Đánh dấu tất cả đã đọc mới lưu. Bấm thông báo mở đúng tab Ôn tập. Mỗi loại nhắc một lần/ngày Việt Nam; tăng số thẻ cùng ngày không bật lại chưa đọc, ngày mới nhắc lại. Ôn hết hoặc bỏ sao hết thẻ đến hạn thì nhóm biến mất. Khách cần đăng nhập. Hiện chỉ nhắc trong web, chưa email/push hoặc thông báo admin.', ['chuông', 'thông báo', 'chấm đỏ', 'đã đọc', 'nhắc ôn', 'email', 'push']),
  guide('settings', 'Cài đặt học và phát âm', '/kanji', 'Mở nút Cài đặt để chọn font chữ Nhật, furigana và tốc độ phát âm. Cài đặt lưu trên thiết bị, chưa đồng bộ tài khoản. Furigana điều khiển kana chú thích đã có, không tự tạo cách đọc hoặc ẩn On/Kun/cách đọc từ vựng/đáp án. Đọc hiểu/Shadowing nhận cài đặt chung ban đầu; thay đổi riêng trong màn giữ đến khi rời màn/F5. Loa dùng giọng Nhật của trình duyệt ở các màn TTS thiết bị; nếu thiếu giọng Nhật sẽ báo lỗi, khác audio Edge ở Đọc hiểu và video YouTube ở Shadowing.', ['cài đặt', 'font', 'furigana', 'tốc độ', 'loa', 'phát âm', 'không nghe', 'giọng nhật']),
  guide('account', 'Đăng nhập và dữ liệu riêng', '/kanji', 'Dùng nút Đăng nhập trên header. Dữ liệu học theo tài khoản được lưu qua API; đăng nhập không tự nhận bài khách/localStorage vào tài khoản. Khách và tài khoản giữ riêng. Nếu đổi tài khoản trong lúc lưu hoặc phiên hết hạn, hãy đăng nhập/tải lại rồi thử từ đúng tài khoản. Không gửi mật khẩu, API key hoặc mã phiên trong chat; trợ lý không đổi quyền, mật khẩu hoặc đăng nhập thay bạn. Trợ lý không biết dữ liệu cá nhân nếu không được cung cấp trong nguồn của lượt trả lời.', ['đăng nhập', 'đăng xuất', 'tài khoản', 'mật khẩu', 'dữ liệu khách', 'google', 'f5', 'đổi thiết bị']),
  guide('unavailable', 'Các chức năng chưa hoàn thiện', '/nang-cap', 'Trang Nâng cấp và Tạo file hiện chưa có luồng mua hàng/thanh toán hoặc xuất PDF hoàn chỉnh. Nút tải file luyện viết, bảng chia thể và trận Đấu trí chưa được hoàn thiện; không hướng dẫn như chức năng đã hoạt động, không đưa link thanh toán hoặc hứa cấp Premium. Chưa có đồng bộ cài đặt theo tài khoản. Hỏi người dùng nêu lỗi/chức năng cụ thể để hướng dẫn phần đã có.', ['mua', 'thanh toán', 'nâng cấp', 'trọn đời', 'tạo file', 'tải file', 'pdf', 'bảng chia thể', 'đấu trí'], ['/nang-cap', '/tron-doi/tao-file']),
]);

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const slug = '[a-z0-9][a-z0-9-]{0,79}';
const detailPatterns = [new RegExp(`^/kanji/k-[a-z0-9-]{1,30}$`),
  new RegExp(`^/tu-vung/giao-trinh/${slug}(?:/bai/${uuid})?$`),
  new RegExp(`^/ngu-phap/giao-trinh/${slug}(?:/bai/${uuid})?$`),
  new RegExp(`^/ngu-phap/mau/${uuid}(?:/bai-tap)?$`),
  new RegExp(`^/tron-doi/(?:doc-hieu|shadowing)/${uuid}$`)];
const staticPaths = new Set(assistantHelpSources.map(source => source.url).concat('/tron-doi/tao-file'));

/** Normalizes context only. A syntactically valid detail is not evidence of public visibility. */
export function normalizeAssistantRoute(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020%]/u.test(value)) return null;
  let parsed: URL;
  try { parsed = new URL(value, 'https://nihongo.invalid'); } catch { return null; }
  if (parsed.origin !== 'https://nihongo.invalid') return null;
  let path = parsed.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') path = '/kanji';
  // Review sets and private roadmap/attempt IDs are never sent as public context.
  const review = path.match(new RegExp(`^(/tu-vung/giao-trinh/${slug})/review/${uuid}$`));
  if (review) path = review[1];
  if (!staticPaths.has(path) && !detailPatterns.some(pattern => pattern.test(path))) return null;
  const safe = new URLSearchParams();
  if (path === '/tron-doi/jlpt' || path === '/ca-nhan/lo-trinh') {
    const level = parsed.searchParams.get('level'); if (level && /^N[1-5]$/.test(level)) safe.set('level', level);
  }
  if (path === '/ca-nhan/lo-trinh' && parsed.searchParams.get('tab') === 'my') safe.set('tab', 'my');
  if (path === '/ca-nhan/on-tap') {
    const type = parsed.searchParams.get('type'); if (type && ['kanji', 'vocab', 'grammar'].includes(type)) safe.set('type', type);
  }
  if (path === '/tu-vung/bang-chu-cai') {
    const script = parsed.searchParams.get('script'); if (script && ['hiragana', 'katakana'].includes(script)) safe.set('script', script);
  }
  return path + (safe.size ? `?${safe}` : '');
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd').toLowerCase();
const dto = ({ id, title, url, content }: AssistantSource): AssistantSource => ({ id, title, url, content });
const sourceById = new Map(assistantHelpSources.map(source => [source.id, source]));
const resourceKinds = new Set<JlptResourceKind>(['kanji', 'vocabulary', 'grammar', 'reading', 'shadowing', 'kana']);
const resourceId = (kind: string, id: string) => `resource:${kind}:${id}`;
function resourceInput(id: string): JlptResourceInput | null {
  const match = id.match(/^resource:([a-z]+):(.+)$/);
  if (!match || !resourceKinds.has(match[1] as JlptResourceKind)) return null;
  const kind = match[1] as JlptResourceKind, targetId = match[2];
  const valid = kind === 'kanji' ? /^k-[a-z0-9-]{1,30}$/.test(targetId)
    : kind === 'kana' ? ['hiragana', 'katakana'].includes(targetId) : new RegExp(`^${uuid}$`).test(targetId);
  return valid ? { id, kind, targetId } : null;
}
const resourceSource = (row: JlptResourceView): AssistantSource | null => {
  if (!row.available || !row.href || normalizeAssistantRoute(row.href) !== row.href) return null;
  return { id: resourceId(row.kind, row.targetId), title: row.title.slice(0, 200), url: row.href,
    content: `Mục trong kho đã xuất bản. Loại: ${row.kind}; trình độ: ${row.level ?? 'chưa ghi'}. Tên: ${row.title.slice(0, 200)}. ${row.subtitle.slice(0, 800)}. Mở đường dẫn nguồn để học nội dung hiện tại. Đây là thông tin mục trong kho, không phải kết quả/tiến độ của người học.` };
};
function routeResource(route: string | null): JlptResourceInput | null {
  const path = route?.split('?')[0] ?? '';
  let match = path.match(/^\/kanji\/(k-[a-z0-9-]+)$/);
  if (match) return resourceInput(resourceId('kanji', match[1]));
  match = path.match(new RegExp(`^/tu-vung/giao-trinh/${slug}/bai/(${uuid})$`));
  if (match) return resourceInput(resourceId('vocabulary', match[1]));
  match = path.match(new RegExp(`^/ngu-phap/mau/(${uuid})(?:/bai-tap)?$`));
  if (match) return resourceInput(resourceId('grammar', match[1]));
  match = path.match(new RegExp(`^/tron-doi/(doc-hieu|shadowing)/(${uuid})$`));
  return match ? resourceInput(resourceId(match[1] === 'doc-hieu' ? 'reading' : 'shadowing', match[2])) : null;
}

/** Rebuilds citations from known IDs; caller-supplied URLs/content are never trusted. No cache of visibility. */
export async function resolveAssistantSources(db: PrismaClient, ids: readonly string[]): Promise<AssistantSource[]> {
  const unique = [...new Set(ids)].slice(0, 10);
  const resources = unique.map(resourceInput).filter((value): value is JlptResourceInput => value !== null);
  const rows = resources.length ? await db.$transaction(tx => resolveResources(tx, resources), { isolationLevel: 'RepeatableRead' }) : [];
  const dynamic = new Map(rows.map(resourceSource).filter((value): value is AssistantSource => value !== null).map(value => [value.id, value]));
  return unique.map(id => sourceById.has(id) ? dto(sourceById.get(id)!) : dynamic.get(id)).filter((value): value is AssistantSource => !!value);
}

function searchTerms(question: string): string[] {
  const terms = [...question.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々]{1,60}/gu)].map(match => match[0]);
  for (const match of question.matchAll(/["“「『]([^"”」』\r\n]{2,60})["”」』]/gu)) terms.push(match[1].trim());
  return [...new Set(terms)].filter(Boolean).slice(0, 2);
}
function selectKinds(question: string, route: string | null): JlptResourceKind[] {
  const q = fold(question), kinds: JlptResourceKind[] = [];
  if (/kanji|han tu|han viet/.test(q) || route?.startsWith('/kanji/')) kinds.push('kanji');
  if (/tu vung|giao trinh|tango/.test(q) || route?.startsWith('/tu-vung/giao-trinh')) kinds.push('vocabulary');
  if (/ngu phap|mau cau|minna/.test(q) || route?.startsWith('/ngu-phap')) kinds.push('grammar');
  if (/doc hieu|bai doc/.test(q) || route?.startsWith('/tron-doi/doc-hieu')) kinds.push('reading');
  if (/shadowing|video|youtube/.test(q) || route?.startsWith('/tron-doi/shadowing')) kinds.push('shadowing');
  return [...new Set(kinds.length ? kinds : ['kanji', 'grammar', 'vocabulary'] as JlptResourceKind[])].slice(0, 3);
}

export async function getAssistantKnowledge(db: PrismaClient, input: { question: string; currentRoute?: string | null }): Promise<AssistantSource[]> {
  const question = input.question.slice(0, 3000), route = normalizeAssistantRoute(input.currentRoute), q = fold(question);
  const ranked = assistantHelpSources.filter(source => source.id !== 'help:site').map(source => ({ source,
    score: source.tags.reduce((score, tag) => score + (q.includes(fold(tag)) ? 2 : 0), 0)
      + (route && source.prefixes.some(prefix => route.split('?')[0] === prefix || route.startsWith(`${prefix}/`)) ? 1 : 0),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  const help = [sourceById.get('help:site')!, ...ranked.slice(0, 5).map(item => item.source)].map(dto);
  const context = routeResource(route), terms = searchTerms(question);
  const isBrowseRequest = /\b(tim|goi y|de xuat|co bai|co giao trinh|danh sach|kho)\b/.test(q);
  // Ordinary help requests do not enumerate catalogs. Search only explicit terms or a request to find public lessons.
  if (!context && !terms.length && !isBrowseRequest) return help;
  const kinds = selectKinds(question, route), level = question.match(/\bN[1-5]\b/i)?.[0].toUpperCase();
  const dynamic = await db.$transaction(async tx => {
    const inputs: JlptResourceInput[] = context ? [context] : [];
    if (terms.length || isBrowseRequest) {
      for (const kind of kinds) {
        for (const term of terms.length ? terms : ['']) {
          const result = await searchResources(tx, { kind, q: term, ...(level ? { level } : {}), page: 1 });
          for (const item of result.items.slice(0, 2)) inputs.push({ id: resourceId(item.kind, item.targetId), kind: item.kind, targetId: item.targetId });
        }
      }
    }
    const unique = [...new Map(inputs.map(item => [resourceId(item.kind, item.targetId), item])).values()].slice(0, 4);
    return resolveResources(tx, unique);
  }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
  return [...help, ...dynamic.map(resourceSource).filter((value): value is AssistantSource => value !== null)];
}
