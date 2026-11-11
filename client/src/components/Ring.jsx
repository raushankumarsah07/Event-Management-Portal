// progress ring (check-in rate, seats filled)
export default function Ring({ value = 0, size = 96, label, color = 'var(--accent)' }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 90 90" width={size} height={size}>
        <circle cx="45" cy="45" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 45 45)" className="ring-fill" />
      </svg>
      <div className="ring-label"><strong>{Math.round(v)}%</strong>{label && <span>{label}</span>}</div>
    </div>
  );
}
