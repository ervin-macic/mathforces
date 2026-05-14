import React, { useState, useEffect } from 'react';
import { MathJaxFitBlock } from './MathJaxFitBlock';

interface TypewriterHintProps {
  text: string;
  onTypingComplete: () => void;
  /** Same as solution block — skip fit layout while rating overlay is active. */
  layoutPaused?: boolean;
}

/** Match `PLAY_HINT_SOLUTION_MATH_BODY` in PlayPage.tsx */
const HINT_MATH_BODY =
  'text-sm leading-relaxed sm:leading-relaxed md:text-sm md:leading-loose lg:text-base lg:leading-loose xl:text-lg xl:leading-loose';

const TypewriterHint: React.FC<TypewriterHintProps> = ({
  text,
  onTypingComplete,
  layoutPaused = false,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const isTyping = displayedText.length < text.length;

  // Effect to start typing when the component mounts or text changes
  useEffect(() => {
    setDisplayedText(text.substring(0, 1));
  }, [text]);

  // Effect for the typing animation
  useEffect(() => {
    if (isTyping) {
      const getTypingDelay = () => {
        // A bit of randomness to feel more natural (faster base tick than before)
        if (Math.random() < 0.03) {
          return 50 + Math.random() * 40;
        }
        return 5;
      };

      const timer = setTimeout(() => {
        setDisplayedText(prev => text.substring(0, prev.length + 1));
      }, getTypingDelay());

      return () => clearTimeout(timer);
    } else {
      // Once typing is done, call the callback
      onTypingComplete();
    }
  }, [displayedText, text, isTyping, onTypingComplete]);
  
  if (isTyping) {
    return (
      <p className="text-inherit leading-inherit font-inherit">
        {displayedText}
        {isTyping && <span className="inline-block w-2 h-5 bg-accent animate-pulse ml-1 align-bottom"></span>}
      </p>
    );
  }

  return (
    <MathJaxFitBlock
      layoutPaused={layoutPaused}
      className="min-w-0 w-full max-w-full overflow-x-hidden text-left"
      contentClassName={`block w-full max-w-full min-w-0 align-top text-inherit font-mono ${HINT_MATH_BODY}`}
    >
      {text}
    </MathJaxFitBlock>
  );
};

export default TypewriterHint;