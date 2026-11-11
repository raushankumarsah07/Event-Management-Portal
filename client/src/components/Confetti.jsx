import { useMemo } from 'react';

const COLORS = ['#e11d74', '#ff7a3d', '#f5b301', '#4f46e5', '#12a36b', '#06b6d4'];

// pure CSS confetti shower for celebrating a successful booking
export default function Confetti({ count = 60 }) {
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 1.1, dur: 2.6 + Math.random() * 2,
      size: 6 + Math.random() * 8, color: COLORS[i % COLORS.length], rot: Math.random() * 360,
    })),
    [count]
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}
