import React, { useEffect, useState } from 'react';

export interface DifficultyStarRatingProps {
  /** Rating overlay is interactive only in this stage. */
  active: boolean;
  onChooseRating: (rating: number) => void;
}

/**
 * Self-contained difficulty stars so hover/selection state does not re-render
 * the parent (e.g. PlayPage with large MathJax trees).
 */
export function DifficultyStarRating({ active, onChooseRating }: DifficultyStarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setHoverRating(null);
      setSelectedRating(null);
    }
  }, [active]);

  return (
    <div className="mb-8" onMouseLeave={() => setHoverRating(null)}>
      <div className="flex justify-center gap-2 sm:hidden">
        {[...Array(5)].map((_, i) => {
          const ratingValue = (i + 1) * 2;
          return (
            <button
              key={ratingValue}
              type="button"
              onClick={() => {
                setSelectedRating(ratingValue);
                setTimeout(() => onChooseRating(ratingValue), 150);
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
                setTimeout(() => onChooseRating(ratingValue), 150);
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
  );
}
