import { createPortal } from 'react-dom';
import { FlashcardView, type FlashcardProgress } from '../../kanji/components/FlashcardView';
import type { KanjiItem } from '@nihongo/shared/contracts/core';

type Props = {
  study: {
    session: { items: KanjiItem[] } | null;
    close: () => void;
    flashcardProgress: FlashcardProgress;
    reloadKey: number;
  };
  userId: string | null;
  authBusy: boolean;
  onLogin: () => void;
  onDetail: (item: KanjiItem) => void;
};

export function RoadmapStudyOverlay({ study, userId, authBusy, onLogin, onDetail }: Props) {
  if (!study.session) return null;
  return createPortal(<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6">
    <div className="w-full max-w-[672px]">
      <FlashcardView key={study.reloadKey} items={study.session.items} userId={userId} authBusy={authBusy} onClose={study.close} onLogin={onLogin} onDetail={onDetail}
        study={{ ...study.flashcardProgress, guestPersistent: !userId }} />
    </div>
  </div>, document.body);
}
