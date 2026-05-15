import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Reset window scroll position on SPA navigation so each page starts at the top. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
