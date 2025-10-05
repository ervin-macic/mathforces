import React, { useState } from 'react';
import { Page, SolvedProblem } from './types';
import { MathJaxContext } from 'better-react-mathjax';
import { DUMMY_SOLVED_PROBLEMS } from './constants';

import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import AboutPage from './pages/AboutPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProgressPage from './pages/ProgressPage';
import PlayPage from './pages/PlayPage';
import SessionSettingsPage from './pages/SessionSettingsPage';

const mathJaxConfig = {
  loader: { load: ['input/tex', 'output/svg'] },
  tex: {
    inlineMath: [['$', '$']],
    processEscapes: true,
  },
  svg: {
    fontCache: 'global'
  }
};

function App() {
  const [activePage, setActivePage] = useState<Page>(Page.About);
  const [solvedProblems, setSolvedProblems] = useState<SolvedProblem[]>(DUMMY_SOLVED_PROBLEMS);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const handleAddSolvedProblem = (problem: SolvedProblem) => {
    setSolvedProblems(prev => [...prev, problem]);
  };
  
  const handleNavigate = (page: Page) => {
    if (page !== Page.Play) {
        setIsSessionActive(false);
    }
    setActivePage(page);
  };

  const renderContent = () => {
    switch (activePage) {
      case Page.About:
        return <AboutPage />;
      case Page.SessionSettings:
        return <SessionSettingsPage onModeSelect={(mode) => {
          if (mode === 'endless') {
            setActivePage(Page.Play);
          }
        }} />;
      case Page.Leaderboard:
        return <LeaderboardPage />;
      case Page.Progress:
        return <ProgressPage solvedProblems={solvedProblems} />;
      case Page.Play:
      default:
        return <PlayPage 
            onProblemSolved={handleAddSolvedProblem}
            onSessionStart={() => setIsSessionActive(true)}
            onSessionEnd={() => {
                setIsSessionActive(false);
                setActivePage(Page.SessionSettings);
            }}
        />;
    }
  };
  
  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowLoginModal(false);
  };
  
  const handleLogout = () => {
      setIsLoggedIn(false);
      setIsSessionActive(false);
      if (activePage === Page.Progress || activePage === Page.Play || activePage === Page.SessionSettings) {
        setActivePage(Page.About);
      }
  };

  const isPlayMode = activePage === Page.Play && isSessionActive;
  const isAboutPage = activePage === Page.About;
  const isSettingsPage = activePage === Page.SessionSettings;

  const mainStyle: React.CSSProperties = {};
  if (isSettingsPage) {
    mainStyle.backgroundImage = `
      radial-gradient(ellipse 80% 120% at 85% 10%, rgba(226, 183, 19, 0.25), transparent 80%),
      radial-gradient(ellipse 70% 120% at 15% 10%, rgba(209, 208, 197, 0.15), transparent 80%)
    `;
    mainStyle.backgroundRepeat = 'no-repeat';
  }

  return (
    <MathJaxContext config={mathJaxConfig}>
      <div className="min-h-screen">
        {showLoginModal && <LoginModal onLogin={handleLogin} onClose={() => setShowLoginModal(false)} />}
        {!isPlayMode && (
          <Navbar 
              activePage={activePage} 
              onNavigate={handleNavigate} 
              isLoggedIn={isLoggedIn}
              onLoginClick={() => setShowLoginModal(true)}
              onLogoutClick={handleLogout}
          />
        )}
        <main className={isPlayMode || isAboutPage || isSettingsPage ? "" : "container mx-auto"} style={mainStyle}>
          {renderContent()}
        </main>
      </div>
    </MathJaxContext>
  );
}

export default App;