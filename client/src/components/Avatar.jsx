const GRADIENTS = [
  ['#e11d74', '#ff7a3d'], ['#4f46e5', '#06b6d4'], ['#0f766e', '#22c55e'],
  ['#a21caf', '#f472b6'], ['#2563eb', '#60a5fa'], ['#dc2626', '#fb923c'],
];

export default function Avatar({ name = '?', size = 32 }) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [a, b] = GRADIENTS[hash % GRADIENTS.length];
  return (
    <span className="avatar" title={name} style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {name[0]?.toUpperCase()}
    </span>
  );
}
