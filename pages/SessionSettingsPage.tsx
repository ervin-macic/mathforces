import React from 'react';

interface SessionSettingsPageProps {
  onModeSelect: (mode: 'endless' | 'competition') => void;
}

const SessionSettingsPage: React.FC<SessionSettingsPageProps> = ({ onModeSelect }) => {
  return (
    <div className="container mx-auto max-w-3xl px-4 sm:px-8 pt-20 pb-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-light mb-3 tracking-tight">Choose your mode</h1>
        <p className="text-light/60">Select how you want to train today.</p>
      </div>

      {/* Primary: Practice */}
      <div
        className="bg-accent/8 border-2 border-accent/40 hover:border-accent rounded-2xl p-8 mb-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-accent/20 group"
        onClick={() => onModeSelect('endless')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onModeSelect('endless')}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">∞</span>
              <h2 className="text-2xl font-bold text-accent">Practice</h2>
              <span className="text-xs bg-accent/20 text-accent font-semibold px-2.5 py-0.5 rounded-full border border-accent/30">
                Recommended
              </span>
            </div>
            <p className="text-light/70 leading-relaxed max-w-lg">
              The main training loop. One problem at a time, adapted to your recent solves,
              topic strengths, and timing. Practice at your own pace with no pressure.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-light/55">
              <li className="flex items-center gap-2"><span className="text-accent/70">✓</span> Personalized problem queue</li>
              <li className="flex items-center gap-2"><span className="text-accent/70">✓</span> Three progressive hints per problem</li>
              <li className="flex items-center gap-2"><span className="text-accent/70">✓</span> Difficulty feedback that adapts over time</li>
            </ul>
          </div>
          <div className="shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onModeSelect('endless'); }}
              className="bg-accent text-primary font-bold px-8 py-3 rounded-xl hover:opacity-90 transition-all shadow-md shadow-black/20 group-hover:shadow-md group-hover:shadow-black/25 whitespace-nowrap"
            >
              Start practicing
            </button>
          </div>
        </div>
      </div>

      {/* Secondary: Competition Mode */}
      <div
        className="bg-secondary/40 border border-secondary hover:border-accent/40 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-lg hover:shadow-accent/10 group"
        onClick={() => onModeSelect('competition')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onModeSelect('competition')}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">⏱</span>
              <h2 className="text-xl font-bold text-light">Competition Mode</h2>
            </div>
            <p className="text-light/55 text-sm leading-relaxed max-w-lg">
              A stricter timed format for mock-contest days. Test your skills under
              pressure with a fixed problem set and a running clock.
            </p>
          </div>
          <div className="shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onModeSelect('competition'); }}
              className="bg-secondary border border-secondary text-light font-medium px-6 py-2.5 rounded-xl hover:border-accent/50 hover:text-accent transition-all whitespace-nowrap text-sm"
            >
              Enter competition
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionSettingsPage;
