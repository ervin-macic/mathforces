import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SolvedProblem } from '../types';

interface ProgressChartProps {
  data: SolvedProblem[];
}

const ProgressChart: React.FC<ProgressChartProps> = ({ data }) => {
  const chartData = data.map((solved, index) => ({
    name: `Problem ${index + 1}`,
    difficulty: solved.difficultyRating,
    topic: solved.problem.topic,
  }));

  if (chartData.length === 0) {
    return (
        <div className="flex items-center justify-center h-64 bg-secondary rounded-lg">
            <p className="text-light-secondary">Solve some problems to see your progress here!</p>
        </div>
    )
  }

  return (
    <div className="w-full h-80 bg-secondary p-4 rounded-lg shadow-lg">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5, right: 30, left: 20, bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 183, 19, 0.2)" />
          <XAxis dataKey="name" stroke="#d1d0c5" />
          <YAxis domain={[1, 10]} allowDecimals={false} stroke="#d1d0c5" ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#2d2e32', border: '1px solid #e2b713' }} 
            labelStyle={{ color: '#d1d0c5' }}
            cursor={{ stroke: '#e2b713', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Legend wrapperStyle={{ color: '#d1d0c5' }}/>
          <Line type="monotone" dataKey="difficulty" stroke="#e2b713" activeDot={{ r: 8, fill: '#e2b713' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProgressChart;