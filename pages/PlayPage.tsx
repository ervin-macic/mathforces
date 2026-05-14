import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SolvedProblem, Problem } from '../types';
import Timer from '../components/Timer';
import TypewriterHint from '../components/TypewriterHint';
import { MathJax } from 'better-react-mathjax';
import { selectNextProblem } from '../lib/recommendationEngine';
import { randomIntExclusive } from '../lib/random';
import { postAttempt } from '../lib/apiClient';

declare const confetti: any;

type AnimationStage = 'PROBLEM_VIEW' | 'RATING_VIEW' | 'RATING_EXITING' | 'PROBLEM_EXITING' | 'PROBLEM_RESETTING';
type PlayView = 'START_SCREEN' | 'PLAYING' | 'SUMMARY';

interface PlayPageProps {
    problems: Problem[];
    /** True while problems are being fetched from the API */
    problemsLoading?: boolean;
    solvedProblems: SolvedProblem[];
    /** Authenticated user id; null when playing as a guest. */
    userId: number | null;
    onProblemSolved: (problem: SolvedProblem) => void;
    onSessionEnd: () => void;
    onSessionStart: () => void;
    /** Practice start screen only (immersive route has no navbar). */
    onBackToAbout?: () => void;
}

/** Cheap UUID v4-ish generator for session ids. */
function uuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return (crypto as Crypto).randomUUID();
    }
    return 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Play mode requires a full hint ladder (DB columns hint1–hint3). */
function problemHasAllHints(problem: Problem): boolean {
  const hints = problem.hints;
  if (!hints || hints.length < 3) return false;
  return hints.slice(0, 3).every(h => typeof h === 'string' && h.trim() !== '');
}

/** Only http(s) URLs become anchors; plain-text refs stay non-interactive. */
function isHttpUrl(ref: string): boolean {
  const t = ref.trim();
  return /^https?:\/\//i.test(t);
}

function SourceAttribution({ problem }: { problem: Problem }) {
  const refRaw = problem.source_ref?.trim();
  const tag = problem.source_tag?.trim();
  if (!refRaw && !tag) return null;

  const refIsLink = refRaw ? isHttpUrl(refRaw) : false;
  const plainParts = [
    tag ? `[${tag}]` : '',
    refRaw && !refIsLink ? refRaw : '',
  ].filter(Boolean);

  return (
    <div>
      <p className="font-bold text-accent/80 mb-2">Source</p>
      {refRaw && refIsLink ? (
        <a
          href={refRaw}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-light-secondary hover:text-accent transition-colors break-all"
        >
          {tag ? `${tag}: ` : ''}
          {refRaw}
          {' '}
          ↗
        </a>
      ) : (
        <p className="text-sm text-light/80">
          {plainParts.length > 0 ? plainParts.join(' ') : (tag ?? refRaw ?? '')}
        </p>
      )}
    </div>
  );
}

const PlayPage: React.FC<PlayPageProps> = ({
  problems,
  problemsLoading = false,
  solvedProblems,
  userId,
  onProblemSolved,
  onSessionEnd,
  onSessionStart,
  onBackToAbout,
}) => {
  const playableProblems = useMemo(
    () => problems.filter(problemHasAllHints),
    [problems],
  );

  const [playView, setPlayView] = useState<PlayView>('START_SCREEN');
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [sessionSolvedProblems, setSessionSolvedProblems] = useState<SolvedProblem[]>([]);
  // IDs of all problems shown this session, in order — fed to the recommendation engine
  const [sessionProblemIds, setSessionProblemIds] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [animationStage, setAnimationStage] = useState<AnimationStage>('PROBLEM_VIEW');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [isHintTyping, setIsHintTyping] = useState(false);
  const [lastAction, setLastAction] = useState<'solved' | 'skipped' | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => uuid());

  const hintsSectionRef = useRef<HTMLDivElement>(null);

  const currentProblem = playableProblems[currentProblemIndex];

  useEffect(() => {
    if (playableProblems.length === 0) return;
    setCurrentProblemIndex(i => Math.min(i, playableProblems.length - 1));
  }, [playableProblems]);

  useEffect(() => {
    setRevealedAnswer(false);
  }, [currentProblemIndex]);

  useEffect(() => {
    if (playView !== 'PLAYING') return;
    if (hintLevel === 0 && !revealedAnswer) return;
    const id = requestAnimationFrame(() => {
      hintsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [hintLevel, revealedAnswer, playView]);

  const goToNextProblem = useCallback(() => {
    setCurrentProblemIndex(currentIndex => {
      const currentProblem = playableProblems[currentIndex];
      const allSolved = [...solvedProblems, ...sessionSolvedProblems];

      const nextIndex = selectNextProblem(
        playableProblems,
        allSolved,
        sessionProblemIds,
        currentProblem?.id ?? null,
        lastAction,
      );

      // Track the newly chosen problem in the session history
      const nextProblem = playableProblems[nextIndex];
      if (nextProblem) {
        setSessionProblemIds(prev => [...prev, nextProblem.id]);
      }

      return nextIndex;
    });
    setLastAction(null);
  }, [playableProblems, lastAction, solvedProblems, sessionSolvedProblems, sessionProblemIds]);

  // Keep a stable ref to the latest goToNextProblem so the animation effect
  // doesn't need it as a dependency — prevents effect teardown from cancelling
  // the 20ms timer that restores PROBLEM_VIEW after state updates.
  const goToNextProblemRef = useRef(goToNextProblem);
  goToNextProblemRef.current = goToNextProblem;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (animationStage === 'RATING_EXITING' || animationStage === 'PROBLEM_EXITING') {
      timer = setTimeout(() => {
        setAnimationStage('PROBLEM_RESETTING');
      }, 150);
    } else if (animationStage === 'PROBLEM_RESETTING') {
      goToNextProblemRef.current();
      setHintLevel(0);
      setIsHintTyping(false);
      setRevealedAnswer(false);

      timer = setTimeout(() => {
        setAnimationStage('PROBLEM_VIEW');
        setSelectedRating(null);
        setHoverRating(null);
      }, 20);
    }

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationStage]);

  const handleStartSession = () => {
    if (playableProblems.length === 0) return;
    const randomIndex = randomIntExclusive(playableProblems.length);
    const startProblem = playableProblems[randomIndex];
    setCurrentProblemIndex(randomIndex);
    setSessionSolvedProblems([]);
    setSessionProblemIds(startProblem ? [startProblem.id] : []);
    setHintLevel(0);
    setIsHintTyping(false);
    setRevealedAnswer(false);
    setAnimationStage('PROBLEM_VIEW');
    setPlayView('PLAYING');
    setSessionId(uuid());
    onSessionStart();
  };

  const handleEndSession = () => setPlayView('SUMMARY');

  const handleExitSummary = () => {
    setPlayView('START_SCREEN');
    onSessionEnd();
  };

  const handleSolveProblem = () => {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.6 },
        colors: ['#e2b713', '#d1d0c5', '#ffffff'],
        scalar: 1.2
      });
    }
    setAnimationStage('RATING_VIEW');
  };

  const handleRequestHint = () => {
    if (hintLevel < 3 && !isHintTyping) {
      setIsHintTyping(true);
      setHintLevel(prev => prev + 1);
    }
  };

  const handleConfirmSolve = (rating: number) => {
    const problem = playableProblems[currentProblemIndex];
    const newSolvedProblem: SolvedProblem = {
      problem,
      timeSpent: currentTime,
      difficultyRating: rating,
      solvedAt: new Date(),
      usedHintLevel: hintLevel,
      status: 'solved',
    };
    onProblemSolved(newSolvedProblem);
    setSessionSolvedProblems(prev => [...prev, newSolvedProblem]);
    setLastAction('solved');
    setAnimationStage('RATING_EXITING');

    if (userId !== null) {
      void postAttempt({
        userId,
        problemId: problem.id,
        sessionId,
        status: 'solved',
        timeSpentSec: currentTime,
        userRating: rating,
        usedHintLevel: hintLevel,
      });
    }
  };

  const handleSkipProblem = () => {
    // Record the skip so it contributes to the knowledge profile
    const problem = playableProblems[currentProblemIndex];
    const skippedEntry: SolvedProblem = {
      problem,
      timeSpent: currentTime,
      difficultyRating: 0,
      solvedAt: new Date(),
      usedHintLevel: hintLevel,
      status: 'skipped',
    };
    onProblemSolved(skippedEntry);
    setSessionSolvedProblems(prev => [...prev, skippedEntry]);
    setLastAction('skipped');
    setAnimationStage('PROBLEM_EXITING');

    if (userId !== null) {
      void postAttempt({
        userId,
        problemId: problem.id,
        sessionId,
        status: 'skipped',
        timeSpentSec: currentTime,
        usedHintLevel: hintLevel,
      });
    }
  };

  const getAnimationClasses = () => {
    let problemClasses = 'absolute inset-0 transition-transform duration-500 ease-in-out';
    let ratingClasses = 'absolute inset-0 transition-transform duration-500 ease-in-out';

    switch (animationStage) {
      case 'PROBLEM_VIEW':
        problemClasses += ' translate-y-0';
        ratingClasses += ' translate-y-full';
        break;
      case 'RATING_VIEW':
        problemClasses += ' -translate-y-full';
        ratingClasses += ' translate-y-0';
        break;
      case 'RATING_EXITING':
        problemClasses += ' -translate-y-full transition-none';
        ratingClasses += ' -translate-y-full';
        break;
      case 'PROBLEM_EXITING':
        problemClasses += ' -translate-y-full';
        ratingClasses += ' translate-y-full transition-none';
        break;
      case 'PROBLEM_RESETTING':
        problemClasses += ' translate-y-full transition-none';
        ratingClasses += ' translate-y-full transition-none';
        break;
    }
    return { problemClasses, ratingClasses };
  };

  const { problemClasses, ratingClasses } = getAnimationClasses();

  if (playView === 'START_SCREEN') {
    const canStart = !problemsLoading && playableProblems.length > 0;
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {onBackToAbout && (
            <button
              type="button"
              onClick={onBackToAbout}
              className="mb-6 w-full text-left text-light-secondary hover:text-accent transition-colors sm:mb-8"
            >
              &larr; Back to About
            </button>
          )}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-light mb-2 tracking-tight">Practice</h1>
            <p className="text-light/60">One problem at a time, adapted to you.</p>
          </div>

          <div className="bg-secondary/50 border border-secondary rounded-2xl p-6 mb-6 space-y-3">
            {[
              { icon: '∞', text: 'Problems served until you end the session' },
              { icon: '💡', text: 'Up to 3 progressive hints per problem — reveal only what you need' },
              { icon: '📈', text: 'MOHS difficulty adapts based on your solve history' },
              { icon: '⏱', text: 'Timer per problem — visible but no time limit' },
            ].map(item => (
              <div key={item.text} className="flex items-start gap-3 text-sm text-light/65">
                <span className="shrink-0 w-5 text-center">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {problemsLoading && (
            <p className="text-center text-light-secondary text-sm mb-5">Loading problems…</p>
          )}
          {!problemsLoading && problems.length === 0 && (
            <p className="text-center text-light-secondary text-sm mb-5 leading-relaxed">
              No problems loaded. Start the API and set{' '}
              <code className="text-accent font-mono">VITE_API_URL</code> in{' '}
              <code className="text-accent font-mono">.env.local</code>.
            </p>
          )}
          {!problemsLoading && problems.length > 0 && playableProblems.length === 0 && (
            <p className="text-center text-light-secondary text-sm mb-5 leading-relaxed">
              No problems with a full set of hints are available yet. Add hints in the database
              to start a session.
            </p>
          )}

          <button
            onClick={handleStartSession}
            disabled={!canStart}
            className="w-full bg-accent text-primary font-bold text-xl py-4 rounded-xl hover:opacity-90 transition-all shadow-md shadow-black/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {problemsLoading ? 'Loading…' : 'Start Session'}
          </button>
        </div>
      </div>
    );
  }

  if (playView === 'SUMMARY') {
    const solvedOnly = sessionSolvedProblems.filter(p => p.status !== 'skipped');
    const totalTime = solvedOnly.reduce((acc, p) => acc + p.timeSpent, 0);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <button onClick={handleExitSummary} className="absolute top-8 left-8 text-light-secondary hover:text-accent transition-colors z-20">
          &larr; Exit Session
        </button>
        <div className="w-full max-w-3xl text-center">
          <h1 className="text-4xl font-bold text-accent mb-6">Session Summary</h1>
          <div className="bg-secondary rounded-lg shadow-xl p-8 space-y-4 mb-8">
            <div className="flex justify-between text-lg">
              <span className="text-light/80">Problems Solved:</span>
              <span className="font-bold">{solvedOnly.length}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="text-light/80">Problems Skipped:</span>
              <span className="font-bold">{sessionSolvedProblems.length - solvedOnly.length}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="text-light/80">Total Time (solved):</span>
              <span className="font-bold">{Math.floor(totalTime / 60)}m {totalTime % 60}s</span>
            </div>
          </div>
          <button
            onClick={handleStartSession}
            className="bg-accent text-primary font-bold text-xl px-10 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
          >
            Begin New Session
          </button>
        </div>
      </div>
    );
  }

  if (!currentProblem) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <p className="text-light-secondary">No problem to display.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 h-dvh max-h-dvh overflow-hidden">
      {/* Problem View */}
      <div className={`${problemClasses} min-h-0 overflow-y-auto overscroll-y-contain`}>
        <div
          className="sticky top-0 z-30 flex w-full shrink-0 items-center justify-between gap-4 border-b border-secondary/40 bg-primary/95 px-4 pb-3 backdrop-blur-sm pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-8"
        >
          <button
            type="button"
            onClick={handleEndSession}
            className="shrink-0 text-left text-sm text-light-secondary hover:text-accent transition-colors sm:text-base"
          >
            &larr; End Session
          </button>
          <Timer key={currentProblemIndex} onTimeUpdate={setCurrentTime} />
        </div>
        <div className="flex min-h-0 w-full flex-col items-center justify-start px-4 pb-[max(6rem,env(safe-area-inset-bottom,0px))] pt-4 sm:px-8">
          <div className="w-full max-w-5xl text-center">
            <div className="text-left text-base text-light leading-snug sm:text-lg sm:leading-relaxed md:text-xl lg:text-2xl mb-8 px-2 font-mono md:mb-10 md:px-4">
              <MathJax dynamic>{currentProblem.statement}</MathJax>
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button onClick={handleSkipProblem} className="w-full sm:w-auto bg-secondary text-light px-8 py-3 rounded-lg hover:bg-accent hover:text-primary transition-all font-semibold text-lg shadow-md hover:shadow-lg">
                Skip
              </button>
              <button
                onClick={handleRequestHint}
                disabled={hintLevel >= 3 || isHintTyping}
                className="w-full sm:w-auto bg-secondary text-light px-8 py-3 rounded-lg hover:bg-accent hover:text-primary transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg">
                Hint {hintLevel > 0 ? `(${hintLevel}/3)` : ''}
              </button>
              <button onClick={handleSolveProblem} className="w-full sm:w-auto bg-accent text-primary font-bold px-8 py-3 rounded-lg hover:opacity-90 transition-all text-lg shadow-md hover:shadow-lg">
                Mark as Solved
              </button>
            </div>
            <div
              ref={hintsSectionRef}
              className="mt-8 w-full max-w-4xl mx-auto scroll-mt-28 text-left px-2 sm:px-4 md:scroll-mt-32"
            >
              {Array.from({ length: hintLevel }).map((_, index) => (
                <div key={index} className="bg-secondary/50 p-4 rounded-lg mb-3 text-light/90">
                  <p className="font-bold text-accent/80 mb-1">Hint {index + 1}:</p>
                  <TypewriterHint
                    text={currentProblem.hints[index]}
                    onTypingComplete={() => {
                      if (index === hintLevel - 1) {
                        setIsHintTyping(false);
                      }
                    }}
                  />
                </div>
              ))}
              {hintLevel === 3 && !isHintTyping && (
                <div className="mt-6 space-y-4">
                  {!revealedAnswer ? (
                    <button
                      type="button"
                      onClick={() => setRevealedAnswer(true)}
                      className="w-full sm:w-auto bg-accent/20 text-accent border border-accent/40 px-6 py-3 rounded-lg font-semibold hover:bg-accent/30 transition-colors"
                    >
                      Show solution & source
                    </button>
                  ) : (
                    <div className="min-w-0 max-w-full bg-secondary/50 p-4 rounded-lg space-y-4 text-light/90">
                      {(currentProblem.source_ref || currentProblem.source_tag) && (
                        <SourceAttribution problem={currentProblem} />
                      )}
                      <div>
                        <p className="font-bold text-accent/80 mb-2">Solution</p>
                        {currentProblem.solution ? (
                          <div className="min-w-0 max-w-full overflow-x-auto text-lg text-light leading-relaxed font-mono [scrollbar-gutter:stable]">
                            <MathJax dynamic>{currentProblem.solution}</MathJax>
                          </div>
                        ) : (
                          <p className="text-sm text-light-secondary">
                            No written solution in the dataset for this problem.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Rating View */}
      <div className={ratingClasses}>
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <div className="bg-secondary p-8 rounded-lg shadow-2xl w-full max-w-lg mx-4 text-center">
            <h2 className="text-2xl font-bold mb-4 text-accent">Problem Solved!</h2>
            <p className="mb-6 text-light/80">Rate the difficulty of this problem.</p>
            <div className="mb-8" onMouseLeave={() => setHoverRating(null)}>
              {/* Five stars on narrow viewports; each maps to 2,4,…,10 on the same 1–10 scale */}
              <div className="flex justify-center gap-2 sm:hidden">
                {[...Array(5)].map((_, i) => {
                  const ratingValue = (i + 1) * 2;
                  return (
                    <button
                      key={ratingValue}
                      type="button"
                      onClick={() => {
                        setSelectedRating(ratingValue);
                        setTimeout(() => handleConfirmSolve(ratingValue), 150);
                      }}
                      onMouseEnter={() => setHoverRating(ratingValue)}
                      className="group focus:outline-none"
                      aria-label={`Rate ${ratingValue} out of 10`}
                    >
                      <svg
                        className={`h-8 w-8 transition-colors ${
                          ratingValue <= (hoverRating || selectedRating || 0)
                            ? 'text-accent'
                            : 'text-light-secondary'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.959a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.448a1 1 0 00-.364 1.118l1.287 3.959c.3.921-.755 1.688-1.54 1.118l-3.368-2.448a1 1 0 00-1.176 0l-3.368 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.959a1 1 0 00-.364-1.118L2.05 9.386c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
                      </svg>
                    </button>
                  );
                })}
              </div>
              <div className="hidden justify-center gap-2 sm:flex">
                {[...Array(10)].map((_, i) => {
                  const ratingValue = i + 1;
                  return (
                    <button
                      key={ratingValue}
                      type="button"
                      onClick={() => {
                        setSelectedRating(ratingValue);
                        setTimeout(() => handleConfirmSolve(ratingValue), 150);
                      }}
                      onMouseEnter={() => setHoverRating(ratingValue)}
                      className="group focus:outline-none"
                      aria-label={`Rate ${ratingValue} out of 10`}
                    >
                      <svg
                        className={`h-8 w-8 transition-colors ${
                          ratingValue <= (hoverRating || selectedRating || 0)
                            ? 'text-accent'
                            : 'text-light-secondary'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.959a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.448a1 1 0 00-.364 1.118l1.287 3.959c.3.921-.755 1.688-1.54 1.118l-3.368-2.448a1 1 0 00-1.176 0l-3.368 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.959a1 1 0 00-.364-1.118L2.05 9.386c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-sm text-light-secondary">Select a star to continue to the next problem.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayPage;
