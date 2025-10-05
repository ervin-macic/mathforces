import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#1f2023] py-8 px-4 text-base text-light-secondary">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4">
        <p>&copy; {new Date().getFullYear()} MathForces. All Rights Reserved.</p>
        <div className="flex space-x-6">
          <a href="#" className="hover:text-accent transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-accent transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;