import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SolvedProblem, Problem } from '../types';
import Timer from '../components/Timer';
import TypewriterHint from '../components/TypewriterHint';
import { MathJaxFitBlock } from '../components/MathJaxFitBlock';
import { DifficultyStarRating } from '../components/DifficultyStarRating';
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

/**
 * Problem statement math + prose — largest body scale in play view.
 */
const PLAY_STATEMENT_MATH_BODY =
  'text-base leading-snug sm:leading-relaxed md:text-lg md:leading-relaxed lg:text-xl lg:leading-relaxed xl:text-2xl';

/**
 * Hints and solution: same size at every breakpoint, always smaller than the statement.
 */
const PLAY_HINT_SOLUTION_MATH_BODY =
  'text-sm leading-relaxed sm:leading-relaxed md:text-sm md:leading-loose lg:text-base lg:leading-loose xl:text-lg xl:leading-loose';

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
    const allowConfetti =
      typeof window !== 'undefined' &&
      typeof confetti === 'function' &&
      window.matchMedia('(min-width: 640px)').matches;
    if (allowConfetti) {
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
      <div className="flex min-h-dvh flex-col">
        {onBackToAbout ? (
          <header className="shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-8 sm:pt-6">
            <div className="mx-auto w-full max-w-lg">
              <button
                type="button"
                onClick={onBackToAbout}
                className="w-full text-left text-sm text-light-secondary transition-colors hover:text-accent sm:text-base"
              >
                &larr; Back to About
              </button>
            </div>
          </header>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col justify-center px-4 pb-12 pt-2 sm:px-8 sm:py-12">
          <div className="mx-auto w-full max-w-lg">
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
      <div className={`${problemClasses} min-h-0 min-w-0 overflow-y-auto overscroll-y-contain`}>
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
        <div className="flex min-h-0 min-w-0 w-full flex-col items-center justify-start px-4 pb-[max(6rem,env(safe-area-inset-bottom,0px))] pt-4 sm:px-8">
          <div className="w-full min-w-0 max-w-5xl text-center">
            {/* Phones: smaller type + horizontal scroll for wide MathJax; sm+ unchanged visually */}
            <MathJaxFitBlock
              key={`stmt-${currentProblem.id}`}
              layoutPaused={animationStage !== 'PROBLEM_VIEW'}
              className="mb-8 w-full min-w-0 max-w-full overflow-x-hidden px-2 text-left sm:mb-10 sm:px-4"
              contentClassName={`inline-block min-w-full align-top text-left text-light font-mono ${PLAY_STATEMENT_MATH_BODY}`}
            >
              {currentProblem.statement}
            </MathJaxFitBlock>
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-6">
              <button
                onClick={handleSkipProblem}
                className="w-full sm:w-auto bg-secondary text-light rounded-lg px-5 py-2.5 text-sm font-semibold shadow-md transition-all hover:bg-accent hover:text-primary hover:shadow-lg sm:px-8 sm:py-3 sm:text-lg"
              >
                Skip
              </button>
              <button
                onClick={handleRequestHint}
                disabled={hintLevel >= 3 || isHintTyping}
                className="w-full sm:w-auto bg-secondary text-light rounded-lg px-5 py-2.5 text-sm font-semibold shadow-md transition-all hover:bg-accent hover:text-primary hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:px-8 sm:py-3 sm:text-lg"
              >
                Hint {hintLevel > 0 ? `(${hintLevel}/3)` : ''}
              </button>
              <button
                onClick={handleSolveProblem}
                className="w-full sm:w-auto rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-primary shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:px-8 sm:py-3 sm:text-lg"
              >
                Mark as Solved
              </button>
            </div>
            <div
              ref={hintsSectionRef}
              className="mt-8 w-full max-w-4xl mx-auto scroll-mt-28 text-left px-2 sm:px-4 md:scroll-mt-32"
            >
              {Array.from({ length: hintLevel }).map((_, index) => (
                <div
                  key={index}
                  className={`bg-secondary/50 p-4 rounded-lg mb-3 text-light/90 font-mono ${PLAY_HINT_SOLUTION_MATH_BODY}`}
                >
                  <p className="font-bold text-accent/80 mb-1 text-xs sm:text-sm">Hint {index + 1}:</p>
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
                          <MathJaxFitBlock
                            key={`sol-${currentProblem.id}`}
                            layoutPaused={animationStage !== 'PROBLEM_VIEW'}
                            className="min-w-0 w-full max-w-full overflow-x-hidden text-left"
                            contentClassName={`block w-full max-w-full min-w-0 align-top text-light font-mono ${PLAY_HINT_SOLUTION_MATH_BODY}`}
                          >
                            {currentProblem.solution}
                          </MathJaxFitBlock>
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
            <DifficultyStarRating
              active={animationStage === 'RATING_VIEW'}
              onChooseRating={handleConfirmSolve}
            />
            <p className="text-sm text-light-secondary">Select a star to continue to the next problem.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayPage;
