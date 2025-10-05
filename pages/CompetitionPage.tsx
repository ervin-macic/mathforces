import React, { useState, useEffect, useCallback } from 'react';
import { SolvedProblem, Problem } from '../types';
import { MathJax } from 'better-react-mathjax';

declare const confetti: any;

type Ratings = Record<number, number>;
type AnimationStage = 'INTRO' | 'ACTIVE' | 'RATING' | 'RATING_EXITING' | 'ACTIVE_EXITING';

interface CompetitionPageProps {
    problems: Problem[];
    onProblemSolved: (problem: SolvedProblem) => void;
    onSessionEnd: () => void;
    onSessionStart: () => void;
}

const COMPETITION_DURATION = 4.5 * 60 * 60;

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
    return <div className="text-3xl font-bold text-accent font-mono tracking-wider">{formatTime(seconds)}</div>;
};

const CompetitionPage: React.FC<CompetitionPageProps> = ({ problems, onProblemSolved, onSessionEnd, onSessionStart }) => {
    const [animationStage, setAnimationStage] = useState<AnimationStage>('INTRO');
    const [competitionProblems, setCompetitionProblems] = useState<Problem[]>([]);
    const [timeLeft, setTimeLeft] = useState(COMPETITION_DURATION);
    const [solvedMask, setSolvedMask] = useState<boolean[]>([false, false, false]);
    const [ratings, setRatings] = useState<Ratings>({});
    const [isTimerRunning, setIsTimerRunning] = useState(false);

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
        setCompetitionProblems(pickRandomProblems(problems, 3));
        setTimeLeft(COMPETITION_DURATION);
        setSolvedMask([false, false, false]);
        setRatings({});
        setIsTimerRunning(true);
    }, [problems]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (animationStage === 'RATING_EXITING' || animationStage === 'ACTIVE_EXITING') {
            timer = setTimeout(() => {
                setAnimationStage('INTRO');
            }, 500);
        }
        return () => clearTimeout(timer);
    }, [animationStage]);

    const startNewCompetition = () => {
        setupCompetition();
        setAnimationStage('ACTIVE');
        onSessionStart();
    };

    const handleGenerateNew = () => {
        setIsTimerRunning(false); 
        setupCompetition();
    };

    const handleCheckboxChange = (index: number) => {
        const newMask = [...solvedMask];
        newMask[index] = !newMask[index];
        setSolvedMask(newMask);
    };

    const handleMarkAsDone = () => {
        setIsTimerRunning(false);
        const solvedCount = solvedMask.filter(Boolean).length;
        if (solvedCount > 0) {
            if (typeof confetti === 'function') {
                confetti({ particleCount: 150, spread: 120, origin: { y: 0.6 } });
            }
            setAnimationStage('RATING');
        } else {
            setAnimationStage('ACTIVE_EXITING');
        }
    };

    const handleRatingChange = (problemId: number, rating: number) => {
        setRatings(prev => ({ ...prev, [problemId]: rating }));
    };

    const handleSubmitRatings = () => {
        const timeSpent = COMPETITION_DURATION - timeLeft;
        competitionProblems.forEach((problem, index) => {
            if (solvedMask[index]) {
                const newSolvedProblem: SolvedProblem = {
                    problem,
                    timeSpent,
                    difficultyRating: ratings[problem.id] || 5,
                    solvedAt: new Date(),
                };
                onProblemSolved(newSolvedProblem);
            }
        });
        setAnimationStage('RATING_EXITING');
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
            case 'ACTIVE_EXITING':
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
        return (
             <div className="flex items-center justify-center min-h-screen">
              <div className="text-center p-8">
                  <h1 className="text-5xl font-bold mb-4">Competition Mode</h1>
                  <p className="text-xl text-light/80 mb-8">You'll have 4.5 hours to solve 3 problems.</p>
                  <button onClick={startNewCompetition} className="bg-accent text-primary font-bold text-2xl px-12 py-4 rounded-lg hover:opacity-90 transition-all shadow-lg shadow-accent/20 hover:shadow-2xl hover:shadow-accent/40">Start Competition</button>
                  <button onClick={onSessionEnd} className="block mx-auto mt-8 text-light-secondary hover:text-accent transition-colors">&larr; Back to Session Settings</button>
              </div>
            </div>
        );
    }
    
    return (
        <div className="relative h-screen overflow-hidden">
            <div className={activeClasses}>
                <div className="min-h-screen h-screen flex flex-col p-4 sm:p-8">
                    <header className="flex justify-between items-center mb-6 px-4">
                        <button onClick={onSessionEnd} className="text-light-secondary hover:text-accent transition-colors">&larr; End Session</button>
                        <CountdownTimer seconds={timeLeft} />
                    </header>
                    <main className="flex-grow grid grid-cols-1 gap-6 overflow-y-auto pb-4 max-w-5xl mx-auto w-full px-4">
                        {competitionProblems.map((problem, index) => (
                             <div key={problem.id} className="flex items-start gap-4 sm:gap-6">
                                <input
                                    type="checkbox"
                                    id={`problem-${problem.id}`}
                                    checked={solvedMask[index]}
                                    onChange={() => handleCheckboxChange(index)}
                                    className="h-6 w-6 mt-2 flex-shrink-0 rounded bg-primary border-light-secondary text-accent focus:ring-accent cursor-pointer"
                                    aria-label={`Mark problem ${index + 1} as solved`}
                                />
                                <div className="bg-secondary p-6 rounded-lg shadow-lg flex-grow text-lg">
                                    <MathJax dynamic>{problem.statement}</MathJax>
                                </div>
                            </div>
                        ))}
                    </main>
                    <footer className="mt-auto pt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
                        <button onClick={handleGenerateNew} className="w-full sm:w-auto bg-secondary text-light px-8 py-3 rounded-lg hover:bg-accent hover:text-primary transition-all font-semibold text-lg shadow-md hover:shadow-lg">Generate New Competition</button>
                        <button onClick={handleMarkAsDone} className="w-full sm:w-auto bg-accent text-primary font-bold px-8 py-3 rounded-lg hover:opacity-90 transition-all text-lg shadow-md hover:shadow-lg">Mark as Done</button>
                    </footer>
                </div>
            </div>

            <div className={ratingClasses}>
                <div className="flex flex-col items-center justify-center min-h-screen p-8">
                    <div className="bg-secondary p-8 rounded-lg shadow-2xl w-full max-w-3xl mx-4 text-center">
                        <h2 className="text-3xl font-bold mb-4 text-accent">Competition Complete!</h2>
                        <p className="mb-8 text-light/80">Rate the difficulty of the problems you solved.</p>
                        <div className="space-y-8">
                            {competitionProblems.filter((_, i) => solvedMask[i]).map(p => (
                                <div key={p.id} className="text-left">
                                    <p className="font-semibold text-light truncate mb-3"><MathJax inline dynamic>{p.statement.substring(0, 80)}...</MathJax></p>
                                    <div className="flex justify-center space-x-1 sm:space-x-2">
                                        {[...Array(10)].map((_, i) => {
                                            const ratingValue = i + 1;
                                            return (
                                                <button key={ratingValue} onClick={() => handleRatingChange(p.id, ratingValue)} className="group focus:outline-none">
                                                    <svg className={`w-7 h-7 transition-colors ${ratingValue <= (ratings[p.id] || 0) ? 'text-accent' : 'text-light-secondary'}`} fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.959a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.448a1 1 0 00-.364 1.118l1.287 3.959c.3.921-.755 1.688-1.54 1.118l-3.368-2.448a1 1 0 00-1.176 0l-3.368 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.959a1 1 0 00-.364-1.118L2.05 9.386c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
                                                    </svg>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleSubmitRatings} className="w-full bg-accent text-primary font-bold py-3 mt-10 rounded-md hover:opacity-90 transition-opacity">Submit and Finish</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompetitionPage;