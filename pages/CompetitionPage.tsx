import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SolvedProblem, Problem } from '../types';
import { MathJaxFitBlock } from '../components/MathJaxFitBlock';
import { DifficultyStarRating } from '../components/DifficultyStarRating';
import {
  pickCompetitionProblems,
  canPickCompetitionProblems,
} from '../lib/competitionProblems';
import { postAttempt } from '../lib/apiClient';
import { firePracticeConfetti } from '../lib/confettiGate';
import {
    HINT_SOLUTION_MATH_BODY_COMPETITION,
    STATEMENT_MATH_BODY_COMPETITION,
} from '../lib/mathBodyTypography';

declare const confetti: any;

type CompetitionRatingsState = Record<number, number | undefined>;
type AnimationStage = 'INTRO' | 'ACTIVE' | 'RATING' | 'RATING_EXITING';

interface CompetitionPageProps {
    problems: Problem[];
    problemsLoading?: boolean;
    /** Authenticated user id; null for guest play. */
    userId: number | null;
    onProblemSolved: (problem: SolvedProblem) => void;
    onSessionEnd: () => void;
    onSessionStart: () => void;
}

const COMPETITION_DURATION = 4.5 * 60 * 60;

function uuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return (crypto as Crypto).randomUUID();
    }
    return 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Legacy shuffle when the DB cannot satisfy topic/MOHS rules (rare). */
const pickRandomProblems = (arr: Problem[], num: number): Problem[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, num);
};

const CountdownTimer: React.FC<{ seconds: number }> = ({ seconds }) => {
    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${secs}`;
    };
    return <div className="shrink-0 text-2xl font-bold text-accent font-mono tracking-wider sm:text-3xl">{formatTime(seconds)}</div>;
};

const CompetitionPage: React.FC<CompetitionPageProps> = ({
    problems,
    problemsLoading = false,
    userId,
    onProblemSolved,
    onSessionEnd,
    onSessionStart,
}) => {
    const [animationStage, setAnimationStage] = useState<AnimationStage>('INTRO');
    const [competitionProblems, setCompetitionProblems] = useState<Problem[]>([]);
    const [timeLeft, setTimeLeft] = useState(COMPETITION_DURATION);
    const [ratings, setRatings] = useState<CompetitionRatingsState>({});
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [sessionId, setSessionId] = useState<string>(() => uuid());
    const [solutionOpen, setSolutionOpen] = useState<[boolean, boolean, boolean]>([
        false,
        false,
        false,
    ]);

    useEffect(() => {
        if (!isTimerRunning) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsTimerRunning(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isTimerRunning]);

    const setupCompetition = useCallback(() => {
        const picked = pickCompetitionProblems(problems);
        if (picked) {
            setCompetitionProblems(picked);
        } else {
            console.warn(
                '[Competition] No triple matched distinct topics + MOHS bands; using random fallback.',
            );
            setCompetitionProblems(pickRandomProblems(problems, 3));
        }
        setTimeLeft(COMPETITION_DURATION);
        setRatings({});
        setSolutionOpen([false, false, false]);
        setIsTimerRunning(true);
    }, [problems]);

    const competitionFeasible = useMemo(
        () => canPickCompetitionProblems(problems),
        [problems],
    );

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (animationStage === 'RATING_EXITING') {
            timer = setTimeout(() => {
                setAnimationStage('INTRO');
            }, 500);
        }
        return () => clearTimeout(timer);
    }, [animationStage]);

    const startNewCompetition = () => {
        setupCompetition();
        setAnimationStage('ACTIVE');
        setSessionId(uuid());
        onSessionStart();
    };

    const handleGenerateNew = () => {
        setIsTimerRunning(false); 
        setupCompetition();
    };

    const toggleSolutionPanel = (index: number) => {
        setSolutionOpen(prev => {
            const next: [boolean, boolean, boolean] = [...prev] as [boolean, boolean, boolean];
            next[index] = !next[index];
            return next;
        });
    };

    const handleMarkAsDone = () => {
        setIsTimerRunning(false);
        if (typeof confetti === 'function') {
            firePracticeConfetti(confetti);
        }
        setAnimationStage('RATING');
    };

    const handleRatingChange = (problemId: number, rating: number) => {
        setRatings(prev => ({ ...prev, [problemId]: rating }));
    };

    const finalizeCompetitionPostRatings = (opts: { discardStarSelections: boolean }) => {
        const timeSpent = COMPETITION_DURATION - timeLeft;
        competitionProblems.forEach(problem => {
            const rating = opts.discardStarSelections ? undefined : ratings[problem.id];
            const useRating = rating !== undefined && rating > 0;

            if (useRating) {
                const newSolvedProblem: SolvedProblem = {
                    problem,
                    timeSpent,
                    difficultyRating: rating,
                    solvedAt: new Date(),
                    status: 'solved',
                };
                onProblemSolved(newSolvedProblem);
                if (userId !== null) {
                    void postAttempt({
                        userId,
                        problemId: problem.id,
                        sessionId,
                        status: 'solved',
                        timeSpentSec: timeSpent,
                        userRating: rating,
                    });
                }
            } else {
                const skippedEntry: SolvedProblem = {
                    problem,
                    timeSpent,
                    difficultyRating: 0,
                    solvedAt: new Date(),
                    status: 'skipped',
                };
                onProblemSolved(skippedEntry);
                if (userId !== null) {
                    void postAttempt({
                        userId,
                        problemId: problem.id,
                        sessionId,
                        status: 'skipped',
                        timeSpentSec: timeSpent,
                    });
                }
            }
        });
        setAnimationStage('RATING_EXITING');
    };

    /** Submit star ratings: filled stars update difficulty; unrated problems are implicit skips. */
    const handleSubmitRatings = () => {
        finalizeCompetitionPostRatings({ discardStarSelections: false });
    };

    /** Skip all ratings (ignores any stars); no difficulty updates from this contest. */
    const handleSkipAllRatings = () => {
        finalizeCompetitionPostRatings({ discardStarSelections: true });
    };
    
    const getAnimationClasses = () => {
        let activeClasses = 'absolute inset-0 transition-transform duration-500 ease-in-out';
        let ratingClasses = 'absolute inset-0 transition-transform duration-500 ease-in-out';
        switch (animationStage) {
            case 'ACTIVE':
                activeClasses += ' translate-y-0';
                ratingClasses += ' translate-y-full';
                break;
            case 'RATING':
                activeClasses += ' -translate-y-full';
                ratingClasses += ' translate-y-0';
                break;
            case 'RATING_EXITING':
                activeClasses += ' -translate-y-full transition-none';
                ratingClasses += ' -translate-y-full';
                break;
            default: // INTRO
                activeClasses += ' translate-y-full';
                ratingClasses += ' translate-y-full';
        }
        return { activeClasses, ratingClasses };
    };

    const { activeClasses, ratingClasses } = getAnimationClasses();

    if (animationStage === 'INTRO') {
        const canStart =
            !problemsLoading && problems.length >= 3 && competitionFeasible;
        return (
             <div className="flex min-h-dvh items-center justify-center">
              <div className="text-center p-8">
                  <h1 className="text-5xl font-bold mb-4">Competition Mode</h1>
                  <p className="text-xl text-light/80 mb-8">You'll have 4.5 hours to solve 3 problems.</p>
                  <p className="text-sm text-light-secondary mb-6 max-w-xl mx-auto leading-relaxed">
                      Each contest picks three different topics with MOHS roughly 5–10, 15–35, and at least 25 on the
                      three problems. Each new set is drawn uniformly from every valid combination.
                  </p>
                  {problemsLoading && (
                      <p className="text-light-secondary mb-6">Loading problems from the server…</p>
                  )}
                  {!problemsLoading && problems.length < 3 && (
                      <p className="text-light-secondary mb-6 max-w-lg mx-auto">
                          Need at least 3 problems in the database. Run the API with a populated{' '}
                          <code className="text-accent">mathforces.db</code> and set{' '}
                          <code className="text-accent">VITE_API_URL</code> in <code className="text-accent">.env.local</code>.
                      </p>
                  )}
                  {!problemsLoading && problems.length >= 3 && !competitionFeasible && (
                      <p className="text-light-secondary mb-6 max-w-lg mx-auto leading-relaxed">
                          Not enough variety in the database to build a contest set (need three distinct topics and
                          problems in each MOHS band: about 5–10, 15–35, and at least 25). Add more problems or widen coverage.
                      </p>
                  )}
                  <button
                      onClick={startNewCompetition}
                      disabled={!canStart}
                      className="bg-accent text-primary font-bold text-2xl px-12 py-4 rounded-lg hover:opacity-90 transition-all shadow-lg shadow-accent/20 hover:shadow-2xl hover:shadow-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                      Start Competition
                  </button>
                  <button onClick={onSessionEnd} className="block mx-auto mt-8 text-light-secondary hover:text-accent transition-colors">&larr; Back to Session Settings</button>
              </div>
            </div>
        );
    }
    
    return (
        <div className="relative flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden">
            <div className={`${activeClasses} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                <header
                    className="z-30 flex w-full shrink-0 items-center justify-between gap-4 border-b border-secondary/40 bg-primary/95 px-4 pb-3 backdrop-blur-sm pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-8"
                >
                    <button
                        type="button"
                        onClick={onSessionEnd}
                        className="shrink-0 text-left text-sm text-light-secondary hover:text-accent transition-colors sm:text-base"
                    >
                        &larr; End Session
                    </button>
                    <CountdownTimer seconds={timeLeft} />
                </header>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
                        <div className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-4 pt-4 sm:px-8">
                            <main className="grid w-full min-w-0 grid-cols-1 gap-4">
                                {competitionProblems.map((problem, index) => (
                                     <div key={problem.id} className="min-w-0">
                                        <div className="min-w-0 space-y-3 bg-secondary p-4 rounded-lg shadow-lg text-sm">
                                            <p className="text-sm font-semibold text-accent/90">Problem {index + 1}</p>
                                            <MathJaxFitBlock
                                                key={`stmt-${problem.id}`}
                                                layoutPaused={animationStage !== 'ACTIVE'}
                                                className="min-w-0 w-full max-w-full overflow-x-hidden text-light px-0 sm:px-1"
                                                contentClassName={`block w-full max-w-full min-w-0 text-left font-mono ${STATEMENT_MATH_BODY_COMPETITION}`}
                                            >
                                                {problem.statement}
                                            </MathJaxFitBlock>
                                            <button
                                                type="button"
                                                onClick={() => toggleSolutionPanel(index)}
                                                className="w-full rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/25 transition-colors sm:w-auto sm:px-4 sm:text-sm"
                                            >
                                                {solutionOpen[index]
                                                    ? `Hide solution (problem ${index + 1})`
                                                    : `View solution (problem ${index + 1})`}
                                            </button>
                                            {solutionOpen[index] && (
                                                <div className="border-t border-secondary pt-3">
                                                    {problem.solution?.trim() ? (
                                                        <MathJaxFitBlock
                                                            key={`sol-${problem.id}`}
                                                            layoutPaused={animationStage !== 'ACTIVE'}
                                                            className="min-w-0 w-full max-w-full overflow-x-hidden text-sm text-light/95"
                                                            contentClassName={`block w-full max-w-full min-w-0 text-left font-mono ${HINT_SOLUTION_MATH_BODY_COMPETITION}`}
                                                        >
                                                            {problem.solution}
                                                        </MathJaxFitBlock>
                                                    ) : (
                                                        <p className="text-sm text-light-secondary">
                                                            No written solution in the dataset for this problem.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </main>
                        </div>
                    </div>
                    <footer className="flex shrink-0 flex-col items-center justify-center gap-3 border-t border-secondary/40 bg-primary/95 px-4 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-4 sm:flex-row sm:gap-4 sm:px-8">
                        <button type="button" onClick={handleGenerateNew} className="w-full rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-light shadow-md transition-all hover:bg-accent hover:text-primary hover:shadow-lg sm:w-auto sm:px-6 sm:py-2.5 sm:text-base">Generate New Competition</button>
                        <button type="button" onClick={handleMarkAsDone} className="w-full rounded-lg bg-accent px-5 py-2 text-sm font-bold text-primary shadow-md transition-all hover:opacity-90 sm:w-auto sm:px-6 sm:py-2.5 sm:text-base">Mark as Done</button>
                    </footer>
                </div>
            </div>

            <div className={ratingClasses}>
                <div className="flex flex-col items-center justify-center min-h-dvh p-8">
                    <div className="bg-secondary p-8 rounded-lg shadow-2xl w-full max-w-3xl mx-4 text-center">
                        <h2 className="text-3xl font-bold mb-4 text-accent">Competition Complete!</h2>
                        <p className="mb-8 text-light/80">
                            Optionally rate how difficult each problem felt. Problems you leave unrated won&apos;t affect
                            difficulty calibration.
                        </p>
                        <div className="space-y-8">
                            {competitionProblems.map((p, i) => (
                                <div key={p.id} className="text-center sm:text-left">
                                    <p className="mb-2 font-semibold text-light">
                                        Problem {i + 1}
                                        <span className="text-light-secondary font-normal"> · {p.topic}</span>
                                    </p>
                                    <DifficultyStarRating
                                        mode="persistent"
                                        active={animationStage === 'RATING'}
                                        value={ratings[p.id]}
                                        onChange={n => handleRatingChange(p.id, n)}
                                        className="mb-0"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mx-auto mt-8 flex w-full max-w-md flex-col items-center gap-3 sm:mt-10">
                            <button
                                type="button"
                                onClick={handleSubmitRatings}
                                className="w-full rounded-md bg-accent py-2.5 text-sm font-bold text-primary transition-opacity hover:opacity-90 sm:py-3 sm:text-base"
                            >
                                Submit and Finish
                            </button>
                            <button
                                type="button"
                                onClick={handleSkipAllRatings}
                                className="w-full rounded-xl border border-secondary/90 bg-primary/50 px-4 py-2.5 text-center text-sm font-medium text-light-secondary transition-colors hover:border-accent/45 hover:text-accent sm:py-3 sm:text-base"
                            >
                                Skip ratings
                            </button>
                        </div>
                        <p className="mx-auto mt-4 max-w-md px-2 text-center text-xs leading-relaxed text-light-secondary sm:mt-5 sm:text-sm md:text-[0.9375rem]">
                            Use <span className="font-medium text-light/90">Skip ratings</span> to finish without saving
                            any stars. Submit saves only problems you rated.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompetitionPage;