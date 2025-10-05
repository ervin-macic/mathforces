import React, { useState, useEffect, useCallback } from 'react';
import { SolvedProblem } from '../types';
import { PROBLEMS } from '../constants';
import Timer from '../components/Timer';
import TypewriterHint from '../components/TypewriterHint';
import { MathJax } from 'better-react-mathjax';

type AnimationStage = 'PROBLEM_VIEW' | 'RATING_VIEW' | 'RATING_EXITING' | 'PROBLEM_EXITING' | 'PROBLEM_RESETTING';
type PlayView = 'START_SCREEN' | 'PLAYING' | 'SUMMARY';

interface PlayPageProps {
    onProblemSolved: (problem: SolvedProblem) => void;
    onSessionEnd: () => void;
    onSessionStart: () => void;
}

const PlayPage: React.FC<PlayPageProps> = ({ onProblemSolved, onSessionEnd, onSessionStart }) => {
  const [playView, setPlayView] = useState<PlayView>('START_SCREEN');
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [sessionSolvedProblems, setSessionSolvedProblems] = useState<SolvedProblem[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [animationStage, setAnimationStage] = useState<AnimationStage>('PROBLEM_VIEW');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [isHintTyping, setIsHintTyping] = useState(false);

  const currentProblem = PROBLEMS[currentProblemIndex];

  const goToNextProblem = useCallback(() => {
    // Pick a new random problem that is not the current one
    setCurrentProblemIndex(currentProblemIndex => {
        let nextIndex;
        do {
          nextIndex = Math.floor(Math.random() * PROBLEMS.length);
        } while (PROBLEMS.length > 1 && nextIndex === currentProblemIndex);
        return nextIndex;
    });
  }, []);
  
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (animationStage === 'RATING_EXITING' || animationStage === 'PROBLEM_EXITING') {
      timer = setTimeout(() => {
        setAnimationStage('PROBLEM_RESETTING');
      }, 150);
    } else if (animationStage === 'PROBLEM_RESETTING') {
      goToNextProblem();
      setHintLevel(0);
      setIsHintTyping(false);
      
      timer = setTimeout(() => {
        setAnimationStage('PROBLEM_VIEW');
        setSelectedRating(null);
        setHoverRating(null);
      }, 20);
    }
    
    return () => clearTimeout(timer);
  }, [animationStage, goToNextProblem]);


  const handleStartSession = () => {
    const randomIndex = Math.floor(Math.random() * PROBLEMS.length);
    setCurrentProblemIndex(randomIndex);
    setSessionSolvedProblems([]);
    setHintLevel(0);
    setIsHintTyping(false);
    setAnimationStage('PROBLEM_VIEW');
    setPlayView('PLAYING');
    onSessionStart();
  };

  const handleEndSession = () => setPlayView('SUMMARY');

  const handleExitSummary = () => {
    setPlayView('START_SCREEN');
    onSessionEnd();
  };

  const handleSolveProblem = () => {
    setAnimationStage('RATING_VIEW');
  };
  
  const handleRequestHint = () => {
    if (hintLevel < 3 && !isHintTyping) {
        setIsHintTyping(true);
        setHintLevel(prev => prev + 1);
    }
  };

  const handleConfirmSolve = (rating: number) => {
    const problem = PROBLEMS[currentProblemIndex];
    const newSolvedProblem: SolvedProblem = {
      problem,
      timeSpent: currentTime,
      difficultyRating: rating,
      solvedAt: new Date(),
    };
    onProblemSolved(newSolvedProblem);
    setSessionSolvedProblems(prev => [...prev, newSolvedProblem]);
    setAnimationStage('RATING_EXITING');
  };

  const handleSkipProblem = () => {
    setAnimationStage('PROBLEM_EXITING');
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
        return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center p-8">
                  <h1 className="text-5xl font-bold mb-4">Ready to train?</h1>
                  <p className="text-xl text-light/80 mb-8">Start your personalized math olympiad session.</p>
                  <button 
                    onClick={handleStartSession}
                    className="bg-accent text-primary font-bold text-2xl px-12 py-4 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
                  >
                    Start Session
                  </button>
                </div>
            </div>
        );
    }

    if (playView === 'SUMMARY') {
        const totalTime = sessionSolvedProblems.reduce((acc, p) => acc + p.timeSpent, 0);
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
                            <span className="font-bold">{sessionSolvedProblems.length}</span>
                        </div>
                        <div className="flex justify-between text-lg">
                            <span className="text-light/80">Total Time:</span>
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

    return (
        <div className="relative h-screen overflow-hidden">
            <button onClick={handleEndSession} 
                    className="absolute top-8 left-8 text-light-secondary hover:text-accent transition-colors z-20">
                &larr; End Session
            </button>
            {/* Problem View */}
            <div className={problemClasses}>
                <div className="flex flex-col items-center justify-center min-h-full p-8 pt-24 md:pt-8">
                    <div className="w-full max-w-5xl text-center">
                        <div className="flex justify-end items-center mb-10 px-4">
                            <Timer key={currentProblemIndex} onTimeUpdate={setCurrentTime} />
                        </div>
                        <div className="text-left text-2xl text-light leading-relaxed mb-12 px-4">
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
                         <div className="mt-8 w-full max-w-4xl mx-auto text-left px-4">
                            {Array.from({ length: hintLevel }).map((_, index) => (
                                <div key={index} className="bg-secondary/50 p-4 rounded-lg mb-3 text-light/90">
                                    <p className="font-bold text-accent/80 mb-1">Hint {index + 1}:</p>
                                    <TypewriterHint
                                        text={currentProblem.hints[index]}
                                        onTypingComplete={() => {
                                            // Only the last hint to appear sets the state back to false
                                            if (index === hintLevel - 1) {
                                                setIsHintTyping(false);
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {/* Rating View */}
            <div className={ratingClasses}>
                <div className="flex flex-col items-center justify-center min-h-full p-8">
                    <div className="bg-secondary p-8 rounded-lg shadow-2xl w-full max-w-lg mx-4 text-center">
                        <h2 className="text-2xl font-bold mb-4 text-accent">Problem Solved!</h2>
                        <p className="mb-6 text-light/80">Rate the difficulty of this problem.</p>
                        <div 
                            className="flex justify-center space-x-1 sm:space-x-2 mb-8 flex-wrap"
                            onMouseLeave={() => setHoverRating(null)}
                        >
                            {[...Array(10)].map((_, i) => {
                                const ratingValue = i + 1;
                                return (
                                    <button
                                        key={ratingValue}
                                        onClick={() => {
                                            setSelectedRating(ratingValue);
                                            setTimeout(() => handleConfirmSolve(ratingValue), 150);
                                        }}
                                        onMouseEnter={() => setHoverRating(ratingValue)}
                                        className="group focus:outline-none"
                                        aria-label={`Rate ${ratingValue} out of 10`}
                                    >
                                        <svg className={`w-8 h-8 transition-colors ${
                                            ratingValue <= (hoverRating || selectedRating || 0)
                                                ? 'text-accent'
                                                : 'text-light-secondary'
                                        }`} fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.959a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.448a1 1 0 00-.364 1.118l1.287 3.959c.3.921-.755 1.688-1.54 1.118l-3.368-2.448a1 1 0 00-1.176 0l-3.368 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.959a1 1 0 00-.364-1.118L2.05 9.386c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
                                        </svg>
                                    </button>
                                );
                            })}
                        </div>
                            <p className="text-sm text-light-secondary">Select a star to continue to the next problem.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayPage;