import { ToastProvider, ToastFeedback, AccountToastFeedback } from '@nihongo/client/toast';
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './layout/Sidebar';
import { TopHeader } from './layout/TopHeader';
import { HomePage } from '../features/kanji/pages/HomePage';
import { PersonalRoadmapPage } from '../features/roadmaps/pages/PersonalRoadmapPage';
import { ReviewPage } from '../features/review/pages/ReviewPage';
import { ChuDongPage } from '../features/vocabulary/pages/ChuDongPage';
import { AlphabetPage } from '../features/kana/pages/AlphabetPage';
import { CurriculumPage } from '../features/curriculum/pages/CurriculumPage';
import { GrammarPage } from '../features/grammar/pages/GrammarPage';
import { AccentPage } from '../features/pitch-accent/pages/AccentPage';
import { WritePage } from '../features/writing/pages/WritePage';
import { LeaderboardPage } from '../features/leaderboard/pages/LeaderboardPage';
import { UpgradePage } from '../features/subscription/pages/UpgradePage';
import { JlptRoadmapPage } from '../features/roadmaps/pages/JlptRoadmapPage';
import { DocHieuPage } from '../features/reading/pages/DocHieuPage';
import { ShadowingPage } from '../features/shadowing/pages/ShadowingPage';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { pagePaths, pathForTab, tabForPath, kanjiPath, grammarPath } from './routes';
import { KanjiRoute } from './DetailRoutes';
import { NotFoundPage } from './NotFoundPage';

import { SettingsModal } from '../features/settings/components/SettingsModal';
import { MascotAssistant } from '../features/assistant/components/MascotAssistant';
import { AuthModal } from '../features/auth/components/AuthModal';
import { LearningSettingsContext, useDeviceSettings } from '../features/settings/hooks/useLearningSettings';
import { cancelJapaneseSpeech } from '../shared/audio/speech';
import { SpeechToastFeedback } from '../shared/audio/SpeechToastFeedback';
import { useAuth } from '@nihongo/client/auth/useAuth';
import { ContentCatalogProvider, CatalogGate } from '../features/content/hooks/useContentCatalog';
import { ReviewProvider } from '../features/review/hooks/useReview';

function AdminRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(`${import.meta.env.VITE_ADMIN_ORIGIN || 'http://localhost:3002'}${location.pathname}${location.search}${location.hash}`);
  }, [location.pathname, location.search, location.hash]);
  return <p className="p-8" role="status">Đang chuyển sang cổng quản trị…</p>;
}

export const App: React.FC = () => {
  const navigate = useNavigate(), location = useLocation();
  const activeTab = tabForPath(location.pathname);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.scrollTo(0,0); }, [location.pathname]);
  const openDetail = (path: string) => navigate(path, {state:{from:location.pathname+location.search}});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const auth = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const { settings, setSettings, storageError } = useDeviceSettings();
  useEffect(() => {
    return () => cancelJapaneseSpeech();
  }, [location.pathname, auth.currentUser?.id]);

  if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) {
    return <AdminRedirect />;
  }

  return (
    <ToastProvider variant="web" scope={auth.currentUser?.id ?? 'guest'}>
    <AccountToastFeedback userId={auth.currentUser?.id ?? null} checking={auth.checking || auth.loggingOut} error={auth.error} />
    <SpeechToastFeedback />
    <ToastFeedback warning={storageError} />
    <LearningSettingsContext.Provider value={settings}>
    <ContentCatalogProvider>
    <ReviewProvider key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} onLogin={() => { setAuthModalMode('login'); setIsAuthModalOpen(true); }}>
    <div className="h-screen bg-sketch-paper text-[#292524] dark:text-[#f5f5f4] font-sketch transition-colors duration-200 flex flex-col overflow-hidden">
      
      {/* 1. Full-width Top Header */}
      <TopHeader
        currentUser={auth.currentUser}
        authBusy={auth.checking || auth.loggingOut}
        onUpgradeClick={() => navigate(pagePaths.upgrade)}
        onOpenAuthModal={(mode = 'login') => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onLogout={() => { void auth.logout(); }}
      />
      {auth.error && <div role="alert" className="px-4 py-2 bg-amber-50 text-amber-900 text-sm border-b border-amber-200">
        {auth.error}{' '}
        <button type="button" onClick={() => { void auth.refresh(); }} disabled={auth.checking || auth.loggingOut} className="underline font-bold">Tải lại tài khoản</button>
      </div>}



      {/* 2. Content Row: Left Sidebar + Main Content */}
      <div className="flex flex-1 h-[calc(100vh-48px)] overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={tab => navigate(pathForTab(tab))}
          settings={settings}
          setSettings={setSettings}
          setIsSettingsOpen={setIsSettingsOpen}
        />

        {/* Main Body */}
        <main ref={mainRef} className="flex-1 h-full overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/kanji" replace />} />
            <Route path={pagePaths.kanji} element={<CatalogGate><HomePage
              onSelectKanji={item => openDetail(kanjiPath(item.id))}
              onOpenWrite={() => navigate(pagePaths.write)}
              userId={auth.currentUser?.id ?? null}
              authBusy={auth.checking || auth.loggingOut || !!auth.error}
              onLogin={() => { setAuthModalMode('login'); setIsAuthModalOpen(true); }}
            /></CatalogGate>} />
            <Route path="/kanji/:id" element={<CatalogGate><KanjiRoute /></CatalogGate>} />
            <Route path={`${pagePaths['vocab-giao-trinh']}/*`} element={<CurriculumPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={pagePaths['vocab-bang-chu-cai']} element={<AlphabetPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={`${pagePaths.bunpo}/*`} element={<GrammarPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={pagePaths['personal-lo-trinh']} element={<CatalogGate><PersonalRoadmapPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error}
              onLogin={() => { setAuthModalMode('login'); setIsAuthModalOpen(true); }} onDetail={item => openDetail(kanjiPath(item.id))} /></CatalogGate>} />
            <Route path={pagePaths['personal-on-tap']} element={<ReviewPage
              onSelectKanji={item => openDetail(kanjiPath(item.id))}
              onSelectGrammar={item => openDetail(grammarPath(item.id))}
            />} />
            <Route path={pagePaths['personal-chu-dong']} element={<ChuDongPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={pagePaths.accent} element={<AccentPage />} />
            <Route path={pagePaths.leaderboard} element={<LeaderboardPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} onLogin={() => { setAuthModalMode('login'); setIsAuthModalOpen(true); }} />} />
            <Route path={pagePaths.write} element={<CatalogGate><WritePage /></CatalogGate>} />
            <Route path={pagePaths['lifetime-jlpt']} element={<JlptRoadmapPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} onLogin={() => { setAuthModalMode('login'); setIsAuthModalOpen(true); }} />} />
            <Route path={pagePaths['lifetime-doc-hieu']} element={<DocHieuPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={`${pagePaths['lifetime-doc-hieu']}/:articleId`} element={<DocHieuPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={`${pagePaths['lifetime-shadowing']}/*`} element={<ShadowingPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} onLogin={() => { setAuthModalMode('login'); setIsAuthModalOpen(true); }} />} />
            <Route path={pagePaths['lifetime-tao-file']} element={<UpgradePage />} />
            <Route path={pagePaths.upgrade} element={<UpgradePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

      </div>

      {/* Floating Mascot Assistant */}
      <MascotAssistant key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null}
        authBusy={auth.checking || auth.loggingOut || !!auth.error}
        onLogin={() => { setAuthModalMode('login'); setIsAuthModalOpen(true); }} />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
      />

      {/* Auth Modal (Login / Register) */}
      {isAuthModalOpen && <AuthModal
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        onLoginSuccess={auth.acceptUser}
      />}

    </div>
    </ReviewProvider>
    </ContentCatalogProvider>
    </LearningSettingsContext.Provider>
    </ToastProvider>
  );
};
