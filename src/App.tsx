import React, { useState, useEffect } from 'react';
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
import { KanjiDetailView } from './components/KanjiDetailView';
import { GrammarDetailView, GrammarDetailItem } from './components/GrammarDetailView';
import { SettingsModal } from './components/SettingsModal';
import { MascotAssistant } from './components/MascotAssistant';
import { AuthModal } from './components/AuthModal';
import { KanjiItem, UserSettings } from './types';
import { useAuth } from './hooks/useAuth';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('kanji');
  const [selectedKanji, setSelectedKanji] = useState<KanjiItem | null>(null);
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarDetailItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const auth = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nhai_kanji_favorites');
      return saved ? JSON.parse(saved) : ['k-1', 'k-14', 'k-22'];
    } catch {
      return ['k-1', 'k-14', 'k-22'];
    }
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('nhai_kanji_settings');
      return saved ? JSON.parse(saved) : {
        darkMode: false,
        fontFamily: 'Itim',
        showFurigana: 'always',
        audioSpeed: 0.9
      };
    } catch {
      return {
        darkMode: false,
        fontFamily: 'Itim',
        showFurigana: 'always',
        audioSpeed: 0.9
      };
    }
  });

  useEffect(() => {
    localStorage.setItem('nhai_kanji_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('nhai_kanji_settings', JSON.stringify(settings));
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-screen bg-sketch-paper text-[#292524] dark:text-[#f5f5f4] font-sketch transition-colors duration-200 flex flex-col overflow-hidden">
      
      {/* 1. Full-width Top Header */}
      <TopHeader
        currentUser={auth.currentUser}
        authBusy={auth.checking || auth.loggingOut}
        onUpgradeClick={() => {
          setSelectedKanji(null);
          setActiveTab('upgrade');
        }}
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
          setActiveTab={(tab) => {
            setSelectedKanji(null);
            setSelectedGrammar(null);
            setActiveTab(tab);
          }}
          settings={settings}
          setSettings={setSettings}
          setIsSettingsOpen={setIsSettingsOpen}
        />

        {/* Main Body */}
        <main className="flex-1 h-full overflow-y-auto">
          {selectedKanji ? (
            <KanjiDetailView
              item={selectedKanji}
              onBack={() => setSelectedKanji(null)}
              isFavorite={favorites.includes(selectedKanji.id)}
              onToggleFavorite={toggleFavorite}
            />
          ) : selectedGrammar ? (
            <GrammarDetailView
              item={selectedGrammar}
              onBack={() => setSelectedGrammar(null)}
              onSelectGrammar={(item) => setSelectedGrammar(item)}
            />
          ) : (
            <>
              {/* 1. Hán tự */}
              {activeTab === 'kanji' && (
                <HomePage
                  onSelectKanji={(item) => setSelectedKanji(item)}
                  onOpenWrite={() => setActiveTab('write')}
                />
              )}

              {/* 2. Từ vựng submenus */}
              {activeTab === 'vocab-giao-trinh' && <CurriculumPage />}
              {activeTab === 'vocab-bang-chu-cai' && <AlphabetPage />}

              {/* 3. Ngữ pháp */}
              {activeTab === 'bunpo' && <BunpoPage />}

              {/* 4. Cá nhân hoá submenus */}
              {(activeTab === 'personal' || activeTab === 'personal-lo-trinh') && <PersonalRoadmapPage />}
              {activeTab === 'personal-on-tap' && (
                <ReviewPage 
                  onSelectKanji={(item) => setSelectedKanji(item)} 
                  onSelectGrammar={(item) => setSelectedGrammar(item)} 
                />
              )}
              {activeTab === 'personal-chu-dong' && <ChuDongPage />}

              {/* 5. Trọng âm */}
              {activeTab === 'accent' && <AccentPage />}

              {/* 6. Xếp hạng */}
              {activeTab === 'leaderboard' && <LeaderboardPage />}

              {/* 7. Luyện viết */}
              {activeTab === 'write' && <WritePage />}

              {/* 8. Trọn đời & Nâng cấp */}
              {activeTab === 'lifetime-jlpt' && <JlptRoadmapPage />}
              {activeTab === 'lifetime-doc-hieu' && <DocHieuPage />}
              {activeTab === 'lifetime-shadowing' && <ShadowingPage />}
              {(activeTab === 'lifetime' || 
                activeTab === 'lifetime-tao-file' || 
                activeTab === 'upgrade') && <UpgradePage />}
            </>
          )}
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
  );
};
