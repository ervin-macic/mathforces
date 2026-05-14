import React from 'react';
import { Page } from '../types';

interface FooterProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const Footer: React.FC<FooterProps> = ({ activePage, onNavigate }) => {
  const isTermsActive = activePage === Page.Terms;

  return (
    <footer className="bg-[#1f2023] border-t border-secondary/60 py-8 px-4 text-base text-light-secondary">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4">
        <p>&copy; {new Date().getFullYear()} Mathforces. All Rights Reserved.</p>
        <div className="flex space-x-6">
          <button
            type="button"
            onClick={() => onNavigate(Page.Terms)}
            className={`transition-colors ${
              isTermsActive ? 'text-accent' : 'hover:text-accent'
            }`}
          >
            Terms of Service
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
