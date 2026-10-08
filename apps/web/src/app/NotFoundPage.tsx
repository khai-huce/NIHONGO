import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <div className="p-8 space-y-4">
    <h1 className="text-2xl font-bold">Không tìm thấy trang</h1>
    <p>Đường dẫn hoặc nội dung này không tồn tại.</p>
    <Link className="underline font-bold" to="/kanji">Về trang Hán tự</Link>
  </div>;
}
