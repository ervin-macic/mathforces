import React from 'react';
import { SolvedProblem } from '../types';
import ProgressChart from '../components/ProgressChart';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface ProgressPageProps {
  solvedProblems: SolvedProblem[];
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent * 100 < 5) { // Don't render label for very small slices
    return null;
  }

  return (
    <text x={x} y={y} fill="#2d2e32" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


const ProgressPage: React.FC<ProgressPageProps> = ({ solvedProblems }) => {
  const recentProblems = solvedProblems.slice().reverse().slice(0, 3);

  const topicCounts = solvedProblems.reduce((acc, solved) => {
    const topic = solved.problem.topic;
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(topicCounts).map(([name, value]) => ({ name, value }));
  
  const topicDifficulty: Record<string, { totalDifficulty: number; count: number }> = {};
    solvedProblems.forEach(p => {
        const topic = p.problem.topic;
        if (!topicDifficulty[topic]) {
            topicDifficulty[topic] = { totalDifficulty: 0, count: 0 };
        }
        topicDifficulty[topic].totalDifficulty += p.difficultyRating;
        topicDifficulty[topic].count += 1;
    });

    const barChartData = Object.entries(topicDifficulty).map(([topic, data]) => ({
        topic,
        'Average Difficulty': parseFloat((data.totalDifficulty / data.count).toFixed(2)),
    }));
  
  // Using theme colors and some additions for variety
  const COLORS = ['#e2b713', '#d1d0c5', '#646669', '#a0522d', '#8a2be2', '#5f9ea0'];
  
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-accent mb-8">Progress Overview</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
        {/* Main content: charts */}
        <div className="lg:col-span-3 space-y-8">
            <div className="bg-secondary p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold text-accent mb-4">Topic Distribution</h2>
                <div className="w-full h-80">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomizedLabel}
                                outerRadius={'85%'}
                                fill="#8884d8"
                                dataKey="value"
                                stroke="none"
                            >
                                {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                             <Legend
                                verticalAlign="bottom"
                                align="center"
                                iconSize={12}
                                wrapperStyle={{ color: '#d1d0c5', bottom: 0 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-secondary p-6 rounded-lg shadow-xl">
                 <h2 className="text-2xl font-semibold text-accent mb-4">Average Difficulty by Topic</h2>
                 <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={barChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 183, 19, 0.1)" />
                            <XAxis dataKey="topic" stroke="#d1d0c5" />
                            <YAxis domain={[1, 10]} allowDecimals={false} stroke="#d1d0c5" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#2d2e32', border: 'none' }}
                                labelStyle={{ color: '#d1d0c5', fontWeight: 'bold' }}
                                itemStyle={{ color: '#d1d0c5' }}
                                cursor={{ fill: 'rgba(226, 183, 19, 0.1)' }}
                            />
                            <Bar dataKey="Average Difficulty" fill="#e2b713">
                                {barChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                 </div>
            </div>
        </div>

        {/* Sidebar: difficulty chart and history */}
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-secondary p-6 rounded-lg shadow-xl">
                 <h2 className="text-2xl font-semibold text-accent mb-4">Difficulty Over Time</h2>
                <ProgressChart data={solvedProblems} />
            </div>
             <div className="bg-secondary p-6 rounded-lg shadow-xl">
              <h2 className="text-2xl font-semibold text-accent mb-4">Recent History</h2>
              {recentProblems.length > 0 ? (
                <ul className="space-y-4">
                  {recentProblems.map((solved) => (
                    <li key={solved.solvedAt.toISOString()} className="border-b border-primary/50 pb-3 last:border-b-0 last:pb-0">
                      <p className="font-bold">{solved.problem.topic}: <span className="text-light/80 font-normal text-sm truncate">{solved.problem.statement.substring(0,40)}...</span></p>
                      <div className="flex justify-between text-sm text-light-secondary mt-1">
                        <span>Rated Difficulty: <span className="font-semibold text-accent">{solved.difficultyRating}/10</span></span>
                        <span>{solved.solvedAt.toLocaleDateString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-light-secondary">No problems solved yet.</p>
              )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default ProgressPage;
