import React, { useState } from 'react';
import { Page } from '../types';

interface NavbarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

const isPlayActive = (activePage: Page) =>
  [Page.Play, Page.Competition, Page.SessionSettings].includes(activePage);

const Navbar: React.FC<NavbarProps> = ({
  activePage,
  onNavigate,
  isLoggedIn,
  onLoginClick,
  onLogoutClick,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const textNavItems: { page: Page; label: string }[] = [
    { page: Page.About, label: 'About' },
    ...(isLoggedIn ? [{ page: Page.Progress, label: 'Progress' }] : []),
  ];

  const handleMobileNavClick = (page: Page) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  const handleMobileAuthClick = (action: () => void) => {
    action();
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="bg-[#1f2023]/95 py-4 px-4 sticky top-0 z-10 border-b border-secondary/40">
      <div className="container mx-auto flex justify-between items-center">
        <div
          className="text-xl font-bold text-accent cursor-pointer font-mono"
          onClick={() => onNavigate(Page.About)}
        >
          MathForces
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {textNavItems.map(item => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                activePage === item.page
                  ? 'text-accent'
                  : 'text-light/60 hover:text-light'
              }`}
            >
              {item.label}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-secondary mx-2" />

          {/* Play — primary pill */}
          <button
            onClick={() => onNavigate(Page.SessionSettings)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-150 ${
              isPlayActive(activePage)
                ? 'bg-accent text-primary shadow-md shadow-accent/30'
                : 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent hover:text-primary hover:shadow-md hover:shadow-accent/30'
            }`}
          >
            Play
          </button>

          {/* Auth */}
          {isLoggedIn ? (
            <button
              onClick={onLogoutClick}
              className="ml-2 px-4 py-2 rounded-lg text-sm font-medium text-light/60 hover:text-light transition-colors"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={onLoginClick}
              className="ml-2 bg-secondary border border-secondary/80 text-light px-4 py-2 rounded-lg text-sm font-medium hover:border-accent/40 hover:text-accent transition-all"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          aria-label="Toggle mobile menu"
        >
          <span className={`block w-6 h-0.5 bg-light transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-light transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-light transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-4 pb-4 border-t border-secondary/50">
          <div className="flex flex-col gap-1 pt-4 px-2">
            {/* Play — primary in mobile too */}
            <button
              onClick={() => handleMobileNavClick(Page.SessionSettings)}
              className={`px-4 py-3 rounded-xl text-base font-bold text-left transition-all ${
                isPlayActive(activePage)
                  ? 'bg-accent text-primary'
                  : 'bg-accent/10 text-accent border border-accent/30'
              }`}
            >
              Play
            </button>

            {textNavItems.map(item => (
              <button
                key={item.page}
                onClick={() => handleMobileNavClick(item.page)}
                className={`px-4 py-2.5 rounded-lg text-base font-medium text-left transition-colors ${
                  activePage === item.page
                    ? 'text-accent'
                    : 'text-light/70 hover:text-light'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="h-px bg-secondary/60 my-1" />

            {isLoggedIn ? (
              <button
                onClick={() => handleMobileAuthClick(onLogoutClick)}
                className="px-4 py-2.5 text-left text-base font-medium text-light/60 hover:text-light transition-colors"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => handleMobileAuthClick(onLoginClick)}
                className="px-4 py-2.5 text-left text-base font-medium text-light/60 hover:text-light transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
