import { useCallback, useEffect, useRef, useState } from 'react';
import { readingRequest } from './useReadings';
import { validateReadingAudio, type ReadingArticle, type ReadingAudio } from '@nihongo/client/reading';
import { ReadingPlayer, type ReadingPlayerState } from '../lib/reading-player';

const empty: ReadingPlayerState = { playing: false, currentTime: 0, sentenceId: null, error: '' };
export function useReadingAudio(article: ReadingArticle | null, userId: string | null, authBusy: boolean, speed: number, loop: boolean) {
  const [state, setState] = useState(empty);
  const [audio, setAudio] = useState<ReadingAudio | null>(null);
  const [generating, setGenerating] = useState(false);
  const player = useRef<ReadingPlayer | null>(null);
  const active = useRef(0), pending = useRef(false), controller = useRef<AbortController | null>(null);
  const settings = useRef({ speed, loop }); settings.current = { speed, loop };
  const context = useRef({ userId, articleId: article?.id, version: article?.version, authBusy });
  if (context.current.userId !== userId || context.current.articleId !== article?.id || context.current.version !== article?.version) active.current++;
  context.current = { userId, articleId: article?.id, version: article?.version, authBusy };

  const attach = useCallback((manifest: ReadingAudio, source: ReadingArticle) => {
    validateReadingAudio(manifest, source);
    player.current?.dispose();
    const instance = new ReadingPlayer(new Audio(), manifest, setState);
    instance.setRate(settings.current.speed); instance.setLoop(settings.current.loop);
    player.current = instance; setAudio(manifest);
    return instance;
  }, []);
  useEffect(() => {
    active.current++; pending.current = false; controller.current?.abort(); player.current?.dispose(); player.current = null;
    setState(empty); setAudio(null); setGenerating(false);
    if (article?.audio) {
      try { attach(article.audio, article); }
      catch (error) { setState({ ...empty, error: error instanceof Error ? error.message : 'Audio không hợp lệ.' }); }
    }
    return () => { active.current++; controller.current?.abort(); player.current?.dispose(); player.current = null; };
  }, [article?.id, article?.version, article?.audio, userId, attach]);
  useEffect(() => { player.current?.setRate(speed); }, [speed]);
  useEffect(() => { player.current?.setLoop(loop); }, [loop]);
  useEffect(() => { if (authBusy) player.current?.pause(); }, [authBusy]);

  const ensure = async (): Promise<ReadingPlayer | null> => {
    if (!article || authBusy || pending.current) return null;
    if (player.current) return player.current;
    if (!userId || article.id.startsWith('guest-') || article.id.startsWith('user-')) {
      setState(s => ({ ...s, error: 'Đăng nhập và tạo bài trong tài khoản để sử dụng audio.' })); return null;
    }
    const request = active.current, abort = new AbortController(); controller.current = abort; pending.current = true;
    setGenerating(true); setState(s => ({ ...s, error: '' }));
    try {
      const result = await readingRequest<{ userId: string; audio: ReadingAudio }>(`/${encodeURIComponent(article.id)}/audio`, {
        method: 'POST', body: { expectedUserId: userId, version: article.version }, signal: abort.signal, timeout: 210000,
      });
      if (request !== active.current || abort.signal.aborted) return null;
      if (result.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.');
      const instance = attach(result.audio, article);
      return context.current.authBusy ? null : instance;
    } catch (error) {
      if (request === active.current && !abort.signal.aborted) setState(s => ({ ...s, error: error instanceof Error ? error.message : 'Chưa tạo được audio. Bấm phát để thử lại.' }));
      return null;
    } finally { if (request === active.current) { pending.current = false; setGenerating(false); } }
  };
  const toggle = async () => {
    if (state.playing) player.current?.pause();
    else (await ensure())?.play();
  };
  const sentence = async (id: string) => { (await ensure())?.sentence(id); };
  return { ...state, audio, generating, toggle, sentence,
    seek: (seconds: number) => player.current?.seek(seconds), previous: () => player.current?.previous(), next: () => player.current?.next() };
}
