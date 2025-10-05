import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <>
        <div className="container mx-auto">
            <div className="py-16 px-8 text-center">
                <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-accent to-light bg-clip-text text-transparent max-w-5xl mx-auto">
                    Real-world math olympiad coaches are rare, expensive, and don’t even exist in some countries.
                </h1>
            </div>
        </div>
        <div className="grid md:grid-cols-3 w-full px-4 sm:px-8">
            <div className="p-8 relative text-center">
                <h2 className="text-2xl font-bold text-accent mb-3">Accessible to Everyone</h2>
                <p className="text-light/80 leading-relaxed mx-auto">Our mission is to make elite math olympiad preparation accessible to everyone, everywhere, breaking down financial and geographical barriers.</p>
                <div className="absolute top-1/2 right-0 h-2/3 -translate-y-1/2 w-px bg-gradient-to-b from-transparent via-accent to-transparent hidden md:block"></div>
            </div>
            <div className="p-8 relative text-center">
                <h2 className="text-2xl font-bold text-accent mb-3">Engaging & Addictive</h2>
                <p className="text-light/80 leading-relaxed mx-auto">A smart training platform designed to make practice effective and fun. We focus on top-tier competitions like the IMO, RMM, EGMO, and BMO.</p>
                <div className="absolute top-1/2 right-0 h-2/3 -translate-y-1/2 w-px bg-gradient-to-b from-transparent via-accent to-transparent hidden md:block"></div>
            </div>
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-accent mb-3">AI-Powered</h2>
                <p className="text-light/80 leading-relaxed mx-auto">We leverage AI to eliminate tedious work, providing personalized problems, hints, and progress tracking, so you can focus on solving.</p>
            </div>
        </div>
    </>
  );
};

export default AboutPage;
