import React from 'react';
import { LEADERBOARD_DATA } from '../constants';

const LeaderboardPage: React.FC = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-accent mb-6">Leaderboard</h1>
      <div className="bg-secondary rounded-lg shadow-xl overflow-hidden">
          <table className="w-full text-left">
              <thead className="bg-primary/50">
                  <tr>
                      <th className="p-4">Rank</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Country</th>
                      <th className="p-4">Score</th>
                  </tr>
              </thead>
              <tbody>
                  {LEADERBOARD_DATA.map((entry, index) => (
                      <tr key={entry.rank} className={`border-t border-primary/50 ${index % 2 === 0 ? 'bg-secondary/50' : ''}`}>
                          <td className="p-4 font-bold text-accent">{entry.rank}</td>
                          <td className="p-4">{entry.name}</td>
                          <td className="p-4">{entry.country}</td>
                          <td className="p-4 text-lg">{entry.score}</td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
};

export default LeaderboardPage;
