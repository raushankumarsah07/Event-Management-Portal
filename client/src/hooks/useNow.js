import { useEffect, useState } from 'react';

// re-renders on a timer: used for countdowns and "x minutes ago" labels
export default function useNow(interval = 1000, active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval, active]);
  return now;
}
