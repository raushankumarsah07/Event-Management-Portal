export const CATEGORIES = ['Tech', 'Music', 'Business', 'Sports', 'Arts', 'Food', 'Education', 'Social'];

export const CAT = {
  Tech: { emoji: '💻', colors: ['#4f46e5', '#06b6d4'] },
  Music: { emoji: '🎵', colors: ['#e11d74', '#ff7a3d'] },
  Business: { emoji: '💼', colors: ['#0f766e', '#22c55e'] },
  Sports: { emoji: '🏃', colors: ['#f97316', '#facc15'] },
  Arts: { emoji: '🎨', colors: ['#a21caf', '#f472b6'] },
  Food: { emoji: '🍜', colors: ['#dc2626', '#fb923c'] },
  Education: { emoji: '📚', colors: ['#2563eb', '#60a5fa'] },
  Social: { emoji: '🎉', colors: ['#7c3aed', '#f0abfc'] },
};

export const catColor = (c) => CAT[c]?.colors[0] || '#e11d74';
export const coverGradient = (c) => `linear-gradient(135deg, ${CAT[c]?.colors[0] || '#e11d74'}, ${CAT[c]?.colors[1] || '#ff7a3d'})`;

const time = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// "Sat, 14 Nov · 6:00 PM – 9:00 PM"
export function fmtRange(startAt, endAt) {
  const s = new Date(startAt);
  const e = new Date(endAt);
  const day = s.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  if (s.toDateString() === e.toDateString()) return `${day} · ${time(s)} – ${time(e)}`;
  return `${day}, ${time(s)} → ${e.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time(e)}`;
}

export const dayBadge = (iso) => {
  const d = new Date(iso);
  return { month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(), day: d.getDate() };
};

export function timeAgo(date) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(date)) / 1000));
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const seatsLeft = (e) => Math.max(0, e.capacity - e.confirmedCount);

// upcoming | live (happening now) | ended
export function eventTiming(e, now = Date.now()) {
  if (now < +new Date(e.startAt)) return 'upcoming';
  if (now <= +new Date(e.endAt)) return 'live';
  return 'ended';
}

// <input type="datetime-local"> works in the user's own timezone
const pad = (n) => String(n).padStart(2, '0');
export const toLocalInput = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v) => new Date(v).toISOString();

// "Add to calendar": downloads an .ics file that Google/Apple/Outlook calendars can open
export function downloadIcs(e) {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eventra//EN', 'BEGIN:VEVENT',
    `UID:${e._id}@eventra`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(e.startAt)}`, `DTEND:${fmt(e.endAt)}`,
    `SUMMARY:${esc(e.title)}`, `LOCATION:${esc(e.location)}`, `DESCRIPTION:${esc(e.description)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${e.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// merges live seat numbers into a list of events
export const applyCounts = (list, c) =>
  list.map((e) => (e._id === c.eventId ? { ...e, confirmedCount: c.confirmedCount, waitlistCount: c.waitlistCount, checkedInCount: c.checkedInCount, capacity: c.capacity } : e));
