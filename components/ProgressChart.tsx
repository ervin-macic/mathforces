import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { SolvedProblem } from '../types';

interface ProgressChartProps {
  data: SolvedProblem[];
}

const ProgressChart: React.FC<ProgressChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-secondary rounded-lg">
        <p className="text-light-secondary">Solve some problems to see your progress here!</p>
      </div>
    );
  }

  const chartData = data.map((solved, index) => ({
    name: `#${index + 1}`,
    'Your Rating': solved.difficultyRating || null,
    'Problem MOHS': solved.problem.difficulty,
    topic: solved.problem.topic,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 183, 19, 0.15)" />
          <XAxis dataKey="name" stroke="#d1d0c5" tick={{ fontSize: 11 }} />
          <YAxis
            stroke="#d1d0c5"
            tick={{ fontSize: 11 }}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#2d2e32', border: '1px solid #e2b713' }}
            labelStyle={{ color: '#d1d0c5', fontWeight: 'bold' }}
            itemStyle={{ color: '#d1d0c5' }}
            cursor={{ stroke: '#e2b713', strokeWidth: 1, strokeDasharray: '3 3' }}
            formatter={(value: number, name: string) => {
              if (name === 'Problem MOHS') return [`${value} MOHS`, name];
              return [`${value}/10`, name];
            }}
          />
          <Legend wrapperStyle={{ color: '#d1d0c5', fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="Problem MOHS"
            stroke="#e2b713"
            strokeWidth={2}
            dot={{ fill: '#e2b713', r: 3 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="Your Rating"
            stroke="#646669"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={{ fill: '#646669', r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProgressChart;
