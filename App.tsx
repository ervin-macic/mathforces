import React, { useState, useEffect } from 'react';
import { Page, SolvedProblem, Problem } from './types';
import { MathJaxContext } from 'better-react-mathjax';
import { computeUpdatedMohs, shouldUpdateMohs } from './lib/mohsService';
import {
  fetchProblems,
  fetchMe,
  fetchUserAttempts,
  GoogleAuthResult,
} from './lib/apiClient';
import {
  AuthUser,
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
} from './lib/auth';

import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import Footer from './components/Footer';
import AboutPage from './pages/AboutPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProgressPage from './pages/ProgressPage';
import PlayPage from './pages/PlayPage';
import SessionSettingsPage from './pages/SessionSettingsPage';
import CompetitionPage from './pages/CompetitionPage';
import TermsPage from './pages/TermsPage';

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
  const [solvedProblems, setSolvedProblems] = useState<SolvedProblem[]>([]);
  const [appProblems, setAppProblems] = useState<Problem[]>([]);
  const [problemsReady, setProblemsReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuth()?.user ?? null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchProblems();
        console.log('[MathForces App] problems loaded into state', {
          count: list?.length ?? 0,
        });
        if (!cancelled) {
          setAppProblems(list);
          setProblemsReady(true);
        }
      } catch (e) {
        console.error('[MathForces App] fetchProblems threw', e);
        if (!cancelled) {
          setAppProblems([]);
          setProblemsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Validate stored token on mount; clear if it's no longer valid.
  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) return;
    let cancelled = false;
    (async () => {
      const me = await fetchMe();
      if (cancelled) return;
      if (!me) {
        clearStoredAuth();
        setUser(null);
        return;
      }
      // Refresh local copy with the latest profile fields.
      const refreshed: AuthUser = {
        userId: me.userId,
        username: me.username,
        displayName: me.displayName,
        email: me.email,
        picture: me.picture,
      };
      setStoredAuth({ token: stored.token, user: refreshed });
      setUser(refreshed);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When a user logs in (or is restored on mount), pull their persisted history.
  useEffect(() => {
    if (!user) {
      setSolvedProblems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const history = await fetchUserAttempts(user.userId);
      if (!cancelled) {
        console.log('[Mathforces App] loaded user attempts', {
          userId: user.userId,
          count: history.length,
        });
        setSolvedProblems(history);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleAddSolvedProblem = (problem: SolvedProblem) => {
    setSolvedProblems(prev => [...prev, problem]);

    // Only adjust MOHS difficulty for explicitly solved problems, not skips
    if (problem.status !== 'skipped' && problem.difficultyRating > 0) {
      setAppProblems(prevProblems =>
        prevProblems.map(p => {
          if (p.id !== problem.problem.id) return p;
          const newMohs = computeUpdatedMohs(
            p.difficulty,
            problem.difficultyRating,
            p.source_tag,
          );
          if (!shouldUpdateMohs(p.difficulty, newMohs)) return p;
          console.log(
            `[MOHS UPDATE] Problem ${p.id} "${p.topic}": ${p.difficulty} → ${newMohs} MOHS ` +
            `(user rated ${problem.difficultyRating}/10)`,
          );
          return { ...p, difficulty: newMohs };
        }),
      );
    }
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
        return (
          <AboutPage
            onStartPlay={() => setActivePage(Page.Play)}
            onStartCompetition={() => setActivePage(Page.Competition)}
            onChooseMode={() => setActivePage(Page.SessionSettings)}
          />
        );
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
      case Page.Terms:
        return <TermsPage />;
      case Page.Progress:
        return <ProgressPage solvedProblems={solvedProblems} isLoggedIn={!!user} />;
      case Page.Competition:
        return <CompetitionPage 
            problems={appProblems}
            problemsLoading={!problemsReady}
            userId={user?.userId ?? null}
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
            problemsLoading={!problemsReady}
            solvedProblems={solvedProblems}
            userId={user?.userId ?? null}
            onProblemSolved={handleAddSolvedProblem}
            onSessionStart={() => setIsSessionActive(true)}
            onSessionEnd={() => {
                setIsSessionActive(false);
                setActivePage(Page.SessionSettings);
            }}
        />;
    }
  };
  
  const handleLogin = (auth: GoogleAuthResult) => {
    const next: AuthUser = {
      userId: auth.userId,
      username: auth.username,
      displayName: auth.displayName,
      email: auth.email,
      picture: auth.picture,
    };
    setUser(next);
    setShowLoginModal(false);
  };
  
  const handleLogout = () => {
      clearStoredAuth();
      setUser(null);
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
  } else if (isAboutPage || activePage === Page.Leaderboard || activePage === Page.Terms) {
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
              user={user}
              onLoginClick={() => setShowLoginModal(true)}
              onLogoutClick={handleLogout}
          />
        )}
        <main className={`flex-grow ${isImmersiveMode ? 'min-h-0' : ''} ${isImmersiveMode || isAboutPage || isSettingsPage || activePage === Page.Leaderboard || activePage === Page.Terms ? "" : "container mx-auto"}`}>
          {renderContent()}
        </main>
        {!isImmersiveMode && <Footer activePage={activePage} onNavigate={handleNavigate} />}
      </div>
    </MathJaxContext>
  );
}

export default App;
