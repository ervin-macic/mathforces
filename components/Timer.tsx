import React, { useState, useEffect } from 'react';

interface TimerProps {
    onTimeUpdate: (seconds: number) => void;
}

const Timer: React.FC<TimerProps> = ({ onTimeUpdate }) => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(prev => {
                const newTime = prev + 1;
                onTimeUpdate(newTime);
                return newTime;
            });
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${secs}`;
    };

    return <div className="text-xl text-accent">{formatTime(seconds)}</div>;
};

export default Timer;
