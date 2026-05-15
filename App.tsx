import React, { useState, useEffect, useMemo } from 'react';
import {
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
  Navigate,
} from 'react-router-dom';
import { Page, SolvedProblem, Problem } from './types';
import { MathJaxContext, type MathJax3Object } from 'better-react-mathjax';
import { pathForPage, pageFromPath } from './lib/pagePaths';
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
import { ScrollToTop } from './components/ScrollToTop';

const mathJaxConfig = {
  loader: { load: ['input/tex', 'output/chtml'] },
  /**
   * Hidden MathML (`mjx-assistive-mml`) follows MathJax menu settings and overrides plain
   * `enableAssistiveMml`; align menu defaults with `handleMathJaxStartup` rerender.
   */
  options: {
    enableAssistiveMml: false,
    menuOptions: {
      settings: {
        assistiveMml: false,
      },
    },
  },
  tex: {
    inlineMath: [['$', '$']],
    processEscapes: true,
  },
  chtml: {
    displayAlign: 'center',
    scale: 1,
    linebreaks: {
      automatic: true,
      width: 'container',
    },
  },
};

/** After startup, menu `applySettings()` may still match saved localStorage — force lean DOM once. */
function handleMathJaxStartup(mj: MathJax3Object): void {
  void mj.startup.promise.then(() => {
    const doc = mj.startup.document as {
      menu?: {
        settings: { assistiveMml?: boolean };
        applySettings(): void;
      };
      options: { enableAssistiveMml?: boolean };
      rerender(start?: number): unknown;
    };
    if (!doc.menu) return;
    doc.menu.settings.assistiveMml = false;
    doc.options.enableAssistiveMml = false;
    doc.menu.applySettings();
    void doc.rerender();
  });
}

interface MainShellProps {
  user: AuthUser | null;
  onNavigateFromChrome: (page: Page) => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

function MainShell({
  user,
  onNavigateFromChrome,
  onLoginClick,
  onLogoutClick,
}: MainShellProps) {
  const activePage = pageFromPath(useLocation().pathname);

  const appStyle: React.CSSProperties = useMemo(() => {
    if (activePage === Page.SessionSettings) {
      return {
        backgroundImage: `
      radial-gradient(ellipse 80% 100% at 90% 10%, rgba(226, 183, 19, 0.15), transparent 70%),
      radial-gradient(ellipse 80% 100% at 10% 90%, rgba(226, 183, 19, 0.08), transparent 70%)
    `,
        backgroundRepeat: 'no-repeat',
      };
    }
    if (
      activePage === Page.About ||
      activePage === Page.Leaderboard ||
      activePage === Page.Terms
    ) {
      return {
        backgroundImage: `
      radial-gradient(ellipse 80% 100% at 90% 10%, rgba(226, 183, 19, 0.10), transparent 70%),
      radial-gradient(ellipse 80% 100% at 10% 90%, rgba(226, 183, 19, 0.05), transparent 70%)
    `,
        backgroundRepeat: 'no-repeat',
      };
    }
    return {};
  }, [activePage]);

  const needsContainer = activePage === Page.Progress;

  return (
    <div className="min-h-screen flex flex-col" style={appStyle}>
      <Navbar
        activePage={activePage}
        onNavigate={onNavigateFromChrome}
        user={user}
        onLoginClick={onLoginClick}
        onLogoutClick={onLogoutClick}
      />
      <main
        className={`flex-grow ${needsContainer ? 'container mx-auto' : ''}`}
      >
        <Outlet />
      </main>
      <Footer activePage={activePage} onNavigate={onNavigateFromChrome} />
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [solvedProblems, setSolvedProblems] = useState<SolvedProblem[]>([]);
  const [appProblems, setAppProblems] = useState<Problem[]>([]);
  const [problemsReady, setProblemsReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(
    () => getStoredAuth()?.user ?? null,
  );
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [, setIsSessionActive] = useState(false);

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

  const navigateFromChrome = (page: Page) => {
    if (page !== Page.Play && page !== Page.Competition) {
      setIsSessionActive(false);
    }
    navigate(pathForPage(page));
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
    const p = location.pathname;
    if (['/progress', '/play', '/session', '/competition'].includes(p)) {
      navigate('/');
    }
  };

  return (
    <MathJaxContext config={mathJaxConfig} onStartup={handleMathJaxStartup}>
      {showLoginModal && (
        <LoginModal onLogin={handleLogin} onClose={() => setShowLoginModal(false)} />
      )}
      <ScrollToTop />
      <Routes>
        <Route
          path="/play"
          element={
            <PlayPage
              problems={appProblems}
              problemsLoading={!problemsReady}
              solvedProblems={solvedProblems}
              userId={user?.userId ?? null}
              onProblemSolved={handleAddSolvedProblem}
              onSessionStart={() => setIsSessionActive(true)}
              onBackToAbout={() => navigate('/')}
              onSessionEnd={() => {
                setIsSessionActive(false);
                navigate('/session');
              }}
            />
          }
        />
        <Route
          path="/competition"
          element={
            <CompetitionPage
              problems={appProblems}
              problemsLoading={!problemsReady}
              userId={user?.userId ?? null}
              onProblemSolved={handleAddSolvedProblem}
              onSessionStart={() => setIsSessionActive(true)}
              onSessionEnd={() => {
                setIsSessionActive(false);
                navigate('/session');
              }}
            />
          }
        />
        <Route
          path="/"
          element={
            <MainShell
              user={user}
              onNavigateFromChrome={navigateFromChrome}
              onLoginClick={() => setShowLoginModal(true)}
              onLogoutClick={handleLogout}
            />
          }
        >
          <Route
            index
            element={
              <AboutPage
                onStartPlay={() => navigate('/play')}
                onStartCompetition={() => navigate('/competition')}
                onChooseMode={() => navigate('/session')}
              />
            }
          />
          <Route
            path="session"
            element={
              <SessionSettingsPage
                onModeSelect={mode => {
                  navigate(mode === 'endless' ? '/play' : '/competition');
                }}
              />
            }
          />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route
            path="progress"
            element={
              <ProgressPage solvedProblems={solvedProblems} isLoggedIn={!!user} />
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MathJaxContext>
  );
}

export default App;
