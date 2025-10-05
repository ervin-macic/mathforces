import React from 'react';

interface SessionSettingsPageProps {
  onModeSelect: (mode: 'endless' | 'competition') => void;
}

const SessionSettingsPage: React.FC<SessionSettingsPageProps> = ({ onModeSelect }) => {
  return (
    <div className="max-w-4xl mx-auto text-center px-8 pt-20 pb-8">
      <h1 className="text-4xl font-bold text-accent mb-4">Choose Your Training Mode</h1>
      <p className="text-lg text-light/80 mb-12">Select how you want to prepare for your next challenge.</p>
      <div className="grid md:grid-cols-2 gap-8">
        {/* Endless Mode Card */}
        <div 
          className="bg-secondary p-8 rounded-lg shadow-xl border-2 border-primary hover:border-accent transition-all cursor-pointer transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/40"
          onClick={() => onModeSelect('endless')}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && onModeSelect('endless')}
        >
          <h2 className="text-2xl font-bold text-accent mb-3">Endless Mode</h2>
          <p className="text-light/80 leading-relaxed">
            Solve a continuous stream of problems at your own pace. Perfect for targeted practice and building endurance.
          </p>
        </div>

        {/* Mock Competition Card */}
        <div 
          className="bg-secondary p-8 rounded-lg shadow-xl border-2 border-primary hover:border-accent transition-all cursor-pointer transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/40"
          onClick={() => onModeSelect('competition')}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && onModeSelect('competition')}
        >
          <h2 className="text-2xl font-bold text-accent mb-3">Competition Mode</h2>
          <p className="text-light/80 leading-relaxed">
            Simulate a real competition environment with a timed set of problems. Test your skills under pressure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SessionSettingsPage;