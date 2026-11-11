import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext.jsx';
import useLiveEvents from '../hooks/useLiveEvents';
import StatusChip from '../components/StatusChip.jsx';
import { CAT, catColor, fmtRange } from '../utils';

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// month view: every event as a coloured chip; click a day to see its events
export default function CalendarPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(() => key(new Date()));

  // the 6-week grid that contains this month
  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - month.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);

  useEffect(() => {
    api.get('/events/calendar', { params: { from: days[0].toISOString(), to: new Date(+days[41] + 864e5).toISOString() } })
      .then((r) => setEvents(r.data))
      .catch((e) => toast(errorMessage(e)));
  }, [days, toast]);

  useLiveEvents(setEvents);

  const byDay = useMemo(() => {
    const m = {};
    events.forEach((e) => { (m[key(new Date(e.startAt))] ||= []).push(e); });
    return m;
  }, [events]);

  const todayKey = key(new Date());
  const shift = (n) => { const d = new Date(month); d.setMonth(d.getMonth() + n); setMonth(d); };
  const goToday = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMonth(d); setSelected(todayKey); };
  const dayEvents = byDay[selected] || [];
  const selectedDate = new Date(`${selected}T00:00:00`);

  return (
    <main className="container">
      <div className="row between page-head wrap">
        <div>
          <h1>Calendar</h1>
          <p className="muted">Events with a ring are ones you're going to.</p>
        </div>
        <div className="row">
          <button className="btn ghost small" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <strong className="month-label">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
          <button className="btn ghost small" onClick={() => shift(1)} aria-label="Next month">›</button>
          <button className="btn small" onClick={goToday}>Today</button>
        </div>
      </div>

      <div className="cal-layout">
        <div className="card cal">
          <div className="cal-head">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="cal-grid">
            {days.map((d) => {
              const k = key(d);
              const list = byDay[k] || [];
              return (
                <button key={k} className={`cal-cell ${d.getMonth() !== month.getMonth() ? 'other' : ''} ${k === todayKey ? 'today' : ''} ${k === selected ? 'sel' : ''}`} onClick={() => setSelected(k)} aria-label={`${d.toDateString()}, ${list.length} events`}>
                  <span className="cal-num">{d.getDate()}</span>
                  <span className="cal-chips">
                    {list.slice(0, 2).map((e) => (
                      <span key={e._id} className={`cal-chip ${e.myStatus ? 'mine' : ''}`} style={{ '--c': catColor(e.category) }}>{e.title}</span>
                    ))}
                    {list.length > 2 && <span className="cal-more">+{list.length - 2} more</span>}
                  </span>
                  {list.length > 0 && <span className="cal-dots">{list.slice(0, 4).map((e) => <i key={e._id} style={{ background: catColor(e.category) }} />)}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="card cal-side">
          <h2>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          {dayEvents.length === 0 ? (
            <p className="muted small">No events on this day. <Link to="/events/new">Create one</Link>.</p>
          ) : (
            <ul className="mini-list">
              {dayEvents.map((e) => (
                <li key={e._id} className="cal-event" onClick={() => nav(`/events/${e._id}`)}>
                  <span className="cat-dot" style={{ background: catColor(e.category) }} />
                  <div className="grow">
                    <Link to={`/events/${e._id}`} className="strong" onClick={(ev) => ev.stopPropagation()}>{e.title}</Link>
                    <div className="muted tiny">{fmtRange(e.startAt, e.endAt)}</div>
                    <div className="muted tiny">{e.mode === 'online' ? '🌐' : '📍'} {e.location}</div>
                  </div>
                  <StatusChip event={e} />
                </li>
              ))}
            </ul>
          )}
          <div className="cal-legend small">
            {Object.entries(CAT).map(([c, v]) => <span key={c}><i style={{ background: v.colors[0] }} />{c}</span>)}
          </div>
        </aside>
      </div>
    </main>
  );
}
