import React from 'react';
import { Page } from '../types';

interface NavbarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ activePage, onNavigate, isLoggedIn, onLoginClick, onLogoutClick }) => {
  const navItemsConfig = [
    { page: Page.About, label: "About" },
    { page: Page.SessionSettings, label: "Play" },
  ];
  
  if (isLoggedIn) {
    navItemsConfig.push({ page: Page.Progress, label: "Progress" });
  }
  
  navItemsConfig.push({ page: Page.Leaderboard, label: "Leaderboard" });


  return (
    <nav className="bg-secondary/50 backdrop-blur-sm py-2 px-4 sticky top-0 z-10 shadow-lg shadow-primary/40">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold text-accent">MathForces</div>
        <div className="hidden md:flex items-center space-x-6">
          {navItemsConfig.map(item => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                activePage === item.page || (activePage === Page.Play && item.page === Page.SessionSettings)
                  ? 'bg-accent text-primary'
                  : 'text-light hover:bg-secondary/70 hover:text-accent'
              }`}
            >
              {item.label}
            </button>
          ))}
          {isLoggedIn ? (
             <button onClick={onLogoutClick} className="bg-secondary text-light px-4 py-1 rounded-md text-sm font-medium hover:bg-accent hover:text-primary transition-colors">
                Logout
            </button>
          ) : (
            <button onClick={onLoginClick} className="bg-secondary text-light px-4 py-1 rounded-md text-sm font-medium hover:bg-accent hover:text-primary transition-colors">
                Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;