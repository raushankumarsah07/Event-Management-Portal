import { useEffect, useRef, useState } from 'react';

// numbers that roll up to their value
export default function CountUp({ value = 0, duration = 900, suffix = '' }) {
  const [n, setN] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    let raf;
    let start;
    const startVal = from.current;
    const tick = (t) => {
      start ??= t;
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(startVal + (value - startVal) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{n.toLocaleString()}{suffix}</>;
}
