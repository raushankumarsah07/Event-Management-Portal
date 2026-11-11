import useNow from '../hooks/useNow';

// ticking "starts in" clock
export default function Countdown({ to, endAt }) {
  const now = useNow(1000);
  const ms = +new Date(to) - now;
  if (ms <= 0) return <span className="count-live"><span className="live-dot" />{endAt && now > +new Date(endAt) ? 'Ended' : 'Happening now'}</span>;
  const s = Math.floor(ms / 1000);
  const parts = [
    ['d', Math.floor(s / 86400)],
    ['h', Math.floor((s % 86400) / 3600)],
    ['m', Math.floor((s % 3600) / 60)],
    ['s', s % 60],
  ];
  return (
    <span className="countdown" aria-label="Time until the event starts">
      {parts.map(([u, v]) => (<span key={u}><strong>{String(v).padStart(2, '0')}</strong><small>{u}</small></span>))}
    </span>
  );
}
