import React, { useState, useEffect } from 'react';
import { MathJax } from 'better-react-mathjax';

interface TypewriterHintProps {
  text: string;
  onTypingComplete: () => void;
}

const TypewriterHint: React.FC<TypewriterHintProps> = ({ text, onTypingComplete }) => {
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
        // A bit of randomness to feel more natural
        if (Math.random() < 0.06) { return 75 + Math.random() * 50; }
        return 8;
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
      <p className="leading-relaxed font-mono">
        {displayedText}
        {isTyping && <span className="inline-block w-2 h-5 bg-accent animate-pulse ml-1 align-bottom"></span>}
      </p>
    );
  }

  return <MathJax inline dynamic className="leading-relaxed font-mono">{text}</MathJax>;
};

export default TypewriterHint;