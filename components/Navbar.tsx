import React, { useState } from 'react';
import { Page } from '../types';

interface NavbarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ activePage, onNavigate, isLoggedIn, onLoginClick, onLogoutClick }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navItemsConfig = [
    { page: Page.About, label: "About" },
    { page: Page.SessionSettings, label: "Play" },
  ];
  
  if (isLoggedIn) {
    navItemsConfig.push({ page: Page.Progress, label: "Progress" });
  }
  
  navItemsConfig.push({ page: Page.Leaderboard, label: "Leaderboard" });

  const handleMobileNavClick = (page: Page) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  const handleMobileAuthClick = (action: () => void) => {
    action();
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="bg-[#1f2023]/90 backdrop-blur-sm py-4 px-4 sticky top-0 z-10 shadow-lg shadow-primary/40">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold text-accent">MathForces</div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {navItemsConfig.map(item => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`px-3 py-1 rounded-md text-base font-medium transition-colors duration-200 ${
                activePage === item.page || ([Page.Play, Page.Competition].includes(activePage) && item.page === Page.SessionSettings)
                  ? 'bg-accent text-primary'
                  : 'text-light hover:bg-secondary/70 hover:text-accent'
              }`}
            >
              {item.label}
            </button>
          ))}
          {isLoggedIn ? (
             <button onClick={onLogoutClick} className="bg-secondary text-light px-4 py-1 rounded-md text-base font-medium hover:bg-accent hover:text-primary transition-colors">
                Logout
            </button>
          ) : (
            <button onClick={onLoginClick} className="bg-secondary text-light px-4 py-1 rounded-md text-base font-medium hover:bg-accent hover:text-primary transition-colors">
                Login
            </button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 space-y-1"
          aria-label="Toggle mobile menu"
        >
          <span className={`block w-6 h-0.5 bg-light transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
          <span className={`block w-6 h-0.5 bg-light transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block w-6 h-0.5 bg-light transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-4 pb-4 border-t border-secondary/50">
          <div className="flex flex-col space-y-2 pt-4">
            {navItemsConfig.map(item => (
              <button
                key={item.page}
                onClick={() => handleMobileNavClick(item.page)}
                className={`px-4 py-2 text-left rounded-md text-base font-medium transition-colors duration-200 ${
                  activePage === item.page || ([Page.Play, Page.Competition].includes(activePage) && item.page === Page.SessionSettings)
                    ? 'bg-accent text-primary'
                    : 'text-light hover:bg-secondary/70 hover:text-accent'
                }`}
              >
                {item.label}
              </button>
            ))}
            {isLoggedIn ? (
               <button 
                 onClick={() => handleMobileAuthClick(onLogoutClick)} 
                 className="bg-secondary text-light px-4 py-2 rounded-md text-base font-medium hover:bg-accent hover:text-primary transition-colors text-left"
               >
                  Logout
              </button>
            ) : (
              <button 
                onClick={() => handleMobileAuthClick(onLoginClick)} 
                className="bg-secondary text-light px-4 py-2 rounded-md text-base font-medium hover:bg-accent hover:text-primary transition-colors text-left"
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