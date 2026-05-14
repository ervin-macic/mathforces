import React, { useState } from 'react';
import { Page } from '../types';
import { AuthUser } from '../lib/auth';

interface NavbarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user: AuthUser | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

const isPlayActive = (activePage: Page) =>
  [Page.Play, Page.Competition, Page.SessionSettings].includes(activePage);

const Navbar: React.FC<NavbarProps> = ({
  activePage,
  onNavigate,
  user,
  onLoginClick,
  onLogoutClick,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isLoggedIn = !!user;

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

  const userBadge = user ? (
    <div className="ml-2 flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-secondary/60 border border-secondary/80">
      {user.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.picture}
          alt=""
          className="w-7 h-7 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-accent/30 text-accent flex items-center justify-center text-sm font-bold">
          {(user.displayName || user.username).slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="text-sm text-light max-w-[140px] truncate">
        {user.displayName || user.username}
      </span>
      <button
        onClick={onLogoutClick}
        className="ml-1 px-2 py-1 rounded-md text-xs font-medium text-light/60 hover:text-light hover:bg-secondary transition-colors"
        title="Sign out"
      >
        Sign out
      </button>
    </div>
  ) : (
    <button
      onClick={onLoginClick}
      className="ml-2 bg-secondary border border-secondary/80 text-light px-4 py-2 rounded-lg text-sm font-medium hover:border-accent/40 hover:text-accent transition-all"
    >
      Sign in
    </button>
  );

  return (
    <nav className="bg-[#1f2023]/95 py-4 px-4 sticky top-0 z-10 border-b border-secondary/40">
      <div className="container mx-auto flex justify-between items-center">
        <div
          className="text-xl font-bold text-accent cursor-pointer font-mono"
          onClick={() => onNavigate(Page.About)}
        >
          Mathforces
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
          {userBadge}
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
              <div className="flex items-center gap-3 px-4 py-2">
                {user!.picture ? (
                  <img
                    src={user!.picture}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent/30 text-accent flex items-center justify-center text-sm font-bold">
                    {(user!.displayName || user!.username).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-light flex-1 truncate">
                  {user!.displayName || user!.username}
                </span>
                <button
                  onClick={() => handleMobileAuthClick(onLogoutClick)}
                  className="text-sm font-medium text-light/60 hover:text-light transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleMobileAuthClick(onLoginClick)}
                className="px-4 py-2.5 text-left text-base font-medium text-light/60 hover:text-light transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
