import React, { useState } from 'react';
import { Page, SolvedProblem, Problem } from './types';
import { MathJaxContext } from 'better-react-mathjax';
import { DUMMY_SOLVED_PROBLEMS, PROBLEMS } from './constants';

import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import Footer from './components/Footer';
import AboutPage from './pages/AboutPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProgressPage from './pages/ProgressPage';
import PlayPage from './pages/PlayPage';
import SessionSettingsPage from './pages/SessionSettingsPage';
import CompetitionPage from './pages/CompetitionPage';

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
  const [appProblems, setAppProblems] = useState<Problem[]>(PROBLEMS);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const handleAddSolvedProblem = (problem: SolvedProblem) => {
    setSolvedProblems(prev => [...prev, problem]);

    // Adjust difficulty in the session state
    setAppProblems(prevProblems => {
      const updatedProblems = prevProblems.map(p => {
        if (p.id === problem.problem.id) {
          // New difficulty is the average of current difficulty and user rating
          const newDifficulty = (p.difficulty + problem.difficultyRating) / 2;
          console.log(`[SIMULATE DB UPDATE] Problem ID ${p.id}: New difficulty is ${newDifficulty.toFixed(2)} (was ${p.difficulty}, user rated ${problem.difficultyRating})`);
          return { ...p, difficulty: newDifficulty };
        }
        return p;
      });
      return updatedProblems;
    });
  };
  
  const handleNavigate = (page: Page) => {
    if (page !== Page.Play && page !== Page.Competition) {
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
          } else if (mode === 'competition') {
            setActivePage(Page.Competition);
          }
        }} />;
      case Page.Leaderboard:
        return <LeaderboardPage />;
      case Page.Progress:
        return <ProgressPage solvedProblems={solvedProblems} />;
      case Page.Competition:
        return <CompetitionPage 
            problems={appProblems}
            onProblemSolved={handleAddSolvedProblem}
            onSessionStart={() => setIsSessionActive(true)}
            onSessionEnd={() => {
                setIsSessionActive(false);
                setActivePage(Page.SessionSettings);
            }}
        />;
      case Page.Play:
      default:
        return <PlayPage 
            problems={appProblems}
            solvedProblems={solvedProblems}
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
      if ([Page.Progress, Page.Play, Page.SessionSettings, Page.Competition].includes(activePage)) {
        setActivePage(Page.About);
      }
  };

  const isImmersiveMode = activePage === Page.Play || activePage === Page.Competition;
  const isAboutPage = activePage === Page.About;
  const isSettingsPage = activePage === Page.SessionSettings;

  const appStyle: React.CSSProperties = {};
  if (isSettingsPage) {
    appStyle.backgroundImage = `
      radial-gradient(ellipse 80% 100% at 90% 10%, rgba(226, 183, 19, 0.15), transparent 70%),
      radial-gradient(ellipse 80% 100% at 10% 90%, rgba(226, 183, 19, 0.08), transparent 70%)
    `;
    appStyle.backgroundRepeat = 'no-repeat';
  } else if (isAboutPage || activePage === Page.Leaderboard) {
    appStyle.backgroundImage = `
      radial-gradient(ellipse 80% 100% at 90% 10%, rgba(226, 183, 19, 0.10), transparent 70%),
      radial-gradient(ellipse 80% 100% at 10% 90%, rgba(226, 183, 19, 0.05), transparent 70%)
    `;
    appStyle.backgroundRepeat = 'no-repeat';
  }


  return (
    <MathJaxContext config={mathJaxConfig}>
      <div className="min-h-screen flex flex-col" style={appStyle}>
        {showLoginModal && <LoginModal onLogin={handleLogin} onClose={() => setShowLoginModal(false)} />}
        {!isImmersiveMode && (
          <Navbar 
              activePage={activePage} 
              onNavigate={handleNavigate} 
              isLoggedIn={isLoggedIn}
              onLoginClick={() => setShowLoginModal(true)}
              onLogoutClick={handleLogout}
          />
        )}
        <main className={`flex-grow ${isImmersiveMode || isAboutPage || isSettingsPage || activePage === Page.Leaderboard ? "" : "container mx-auto"}`}>
          {renderContent()}
        </main>
        {!isImmersiveMode && <Footer />}
      </div>
    </MathJaxContext>
  );
}

export default App;