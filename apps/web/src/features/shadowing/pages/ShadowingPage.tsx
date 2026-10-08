import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import type { ShadowingDetailResponse } from '@nihongo/shared/contracts/shadowing';
import { useAccountResource } from '../../../shared/hooks/useAccountResource';
import { ShadowingLibrary } from '../components/ShadowingLibrary';
import { ShadowingWorkspace } from '../components/ShadowingWorkspace';

type Props = { userId: string | null; authBusy: boolean; onLogin: () => void };
function ShadowingDetail({ userId, authBusy }: Props) {
  const { id } = useParams(), navigate = useNavigate();
  const resource = useAccountResource<ShadowingDetailResponse>(id ? `/shadowing/videos/${encodeURIComponent(id)}` : null, userId, authBusy);
  if (resource.loading) return <p role="status" className="p-8">Đang tải video và tiến độ…</p>;
  if (resource.error || !resource.data) return <div className="p-8"><p role="alert">{resource.error || 'Không tìm thấy video.'}</p><button className="underline mr-4 mt-3" onClick={() => void resource.reload()}>Thử lại</button><button className="underline" onClick={() => navigate('/tron-doi/shadowing')}>Về danh sách</button></div>;
  return <ShadowingWorkspace key={`${userId}-${resource.data.video.id}-${resource.data.video.version}`} detail={resource.data} userId={userId} onBack={() => navigate('/tron-doi/shadowing')} onReload={() => void resource.reload()} />;
}
export function ShadowingPage(props: Props) {
  return <Routes><Route index element={<ShadowingLibrary key={props.userId ?? 'guest'} {...props} />} /><Route path=":id" element={<ShadowingDetail {...props} />} /></Routes>;
}
