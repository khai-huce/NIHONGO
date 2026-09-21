import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useContentCatalog } from '../hooks/useContentCatalog';
import { KanjiDetailView } from '../components/KanjiDetailView';
import { GrammarDetailView, SAMPLE_GRAMMAR_ITEMS } from '../components/GrammarDetailView';
import { grammarPath, pagePaths } from '../routes';
import { NotFoundPage } from './NotFoundPage';

function useReturnPath(fallback: string) {
  const { state } = useLocation();
  const from = typeof state?.from === 'string' ? state.from : '';
  return Object.values(pagePaths).includes(from.split('?')[0]) ? from : fallback;
}

export function KanjiRoute() {
  const { id } = useParams(), navigate = useNavigate();
  const { allKanji: KANJI_DATABASE } = useContentCatalog();
  const from = useReturnPath('/kanji');
  const item = KANJI_DATABASE.find(k => k.id === id);
  return item ? <KanjiDetailView key={item.id} item={item} onBack={() => navigate(from)} /> : <NotFoundPage />;
}

export function GrammarRoute() {
  const { id } = useParams(), navigate = useNavigate();
  const from = useReturnPath('/ngu-phap');
  const item = Object.values(SAMPLE_GRAMMAR_ITEMS).find(g => g.id === id);
  return item ? <GrammarDetailView key={item.id} item={item} onBack={() => navigate(from)} onSelectGrammar={g => navigate(grammarPath(g.id), {state:{from}})} /> : <NotFoundPage />;
}
