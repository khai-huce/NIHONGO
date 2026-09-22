import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { HomePage } from './pages/HomePage';
import { PersonalRoadmapPage } from './pages/PersonalRoadmapPage';
import { ReviewPage } from './pages/ReviewPage';
import { ChuDongPage } from './pages/ChuDongPage';
import { AlphabetPage } from './pages/AlphabetPage';
import { CurriculumPage } from './pages/CurriculumPage';
import { BunpoPage } from './pages/BunpoPage';
import { AccentPage } from './pages/AccentPage';
import { WritePage } from './pages/WritePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { UpgradePage } from './pages/UpgradePage';
import { JlptRoadmapPage } from './pages/JlptRoadmapPage';
import { DocHieuPage } from './pages/DocHieuPage';
import { ShadowingPage } from './pages/ShadowingPage';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { pagePaths, pathForTab, tabForPath, kanjiPath, grammarPath } from './routes';
import { KanjiRoute, GrammarRoute } from './pages/DetailRoutes';
import { NotFoundPage } from './pages/NotFoundPage';

import { SettingsModal } from './components/SettingsModal';
import { MascotAssistant } from './components/MascotAssistant';
import { AuthModal } from './components/AuthModal';
import { LearningSettingsContext, useDeviceSettings } from './hooks/useLearningSettings';
import { cancelJapaneseSpeech, subscribeSpeechErrors } from './utils/speech';
import { useAuth } from './hooks/useAuth';
import { ContentCatalogProvider, CatalogGate } from './hooks/useContentCatalog';
import { ReviewProvider } from './hooks/useReview';

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
  const [speechError, setSpeechError] = useState<string | null>(null);
  useEffect(() => subscribeSpeechErrors(setSpeechError), []);
  useEffect(() => {
    setSpeechError(null);
    return () => cancelJapaneseSpeech();
  }, [location.pathname, auth.currentUser?.id]);

  if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) {
    return <AdminRedirect />;
  }

  return (
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

      {(speechError || storageError) && <div role="alert" className="fixed bottom-4 left-4 right-4 mx-auto max-w-xl z-[250] rounded-xl border border-amber-300 bg-amber-50 text-amber-950 px-4 py-3 text-sm shadow-lg flex items-center gap-3">
        <span className="flex-1">{speechError || storageError}</span>
        {speechError && <button type="button" onClick={() => setSpeechError(null)} className="underline font-bold">Đóng</button>}
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
            <Route path="/ngu-phap/:id" element={<GrammarRoute />} />
            <Route path={pagePaths['vocab-giao-trinh']} element={<CurriculumPage />} />
            <Route path={pagePaths['vocab-bang-chu-cai']} element={<AlphabetPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={pagePaths.bunpo} element={<BunpoPage />} />
            <Route path={pagePaths['personal-lo-trinh']} element={<CatalogGate><PersonalRoadmapPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error}
              onLogin={() => { setAuthModalMode('login'); setIsAuthModalOpen(true); }} onDetail={item => openDetail(kanjiPath(item.id))} /></CatalogGate>} />
            <Route path={pagePaths['personal-on-tap']} element={<ReviewPage
              onSelectKanji={item => openDetail(kanjiPath(item.id))}
              onSelectGrammar={item => openDetail(grammarPath(item.id))}
            />} />
            <Route path={pagePaths['personal-chu-dong']} element={<ChuDongPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={pagePaths.accent} element={<AccentPage />} />
            <Route path={pagePaths.leaderboard} element={<LeaderboardPage />} />
            <Route path={pagePaths.write} element={<CatalogGate><WritePage /></CatalogGate>} />
            <Route path={pagePaths['lifetime-jlpt']} element={<JlptRoadmapPage />} />
            <Route path={pagePaths['lifetime-doc-hieu']} element={<DocHieuPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={`${pagePaths['lifetime-doc-hieu']}/:articleId`} element={<DocHieuPage key={auth.currentUser?.id ?? 'guest'} userId={auth.currentUser?.id ?? null} authBusy={auth.checking || auth.loggingOut || !!auth.error} />} />
            <Route path={pagePaths['lifetime-shadowing']} element={<ShadowingPage />} />
            <Route path={pagePaths['lifetime-tao-file']} element={<UpgradePage />} />
            <Route path={pagePaths.upgrade} element={<UpgradePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

      </div>

      {/* Floating Mascot Assistant */}
      <MascotAssistant />

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
  );
};
