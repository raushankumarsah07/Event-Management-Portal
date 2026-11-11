import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext.jsx';
import useLiveEvents from '../hooks/useLiveEvents';
import EventCard from '../components/EventCard.jsx';
import { CAT, CATEGORIES } from '../utils';

const WHEN = [['upcoming', 'Upcoming'], ['today', 'Next 24 hours'], ['week', 'This week'], ['past', 'Past']];

export default function Discover() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const [events, setEvents] = useState(null);
  const [q, setQ] = useState('');
  const [when, setWhen] = useState('upcoming');
  const [mode, setMode] = useState('');
  const [sort, setSort] = useState('date');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/events', { params: { q, category, when, mode, sort } })
        .then((r) => setEvents(r.data))
        .catch((e) => toast(errorMessage(e)));
    }, 250); // wait for the user to stop typing
    return () => clearTimeout(t);
  }, [q, category, when, mode, sort, toast]);

  useLiveEvents(setEvents); // seat counts update live

  const setCategory = (c) => (c ? setParams({ category: c }) : setParams({}));

  return (
    <main className="container">
      <div className="row between page-head wrap">
        <div>
          <h1>Discover events</h1>
          <p className="muted">Seat counts update live as people book.</p>
        </div>
        <Link to="/events/new" className="btn">+ Create event</Link>
      </div>

      <div className="filters">
        <input className="search" type="search" placeholder="Search events, places…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Format">
          <option value="">In-person &amp; online</option>
          <option value="in-person">In-person</option>
          <option value="online">Online</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="date">Soonest first</option>
          <option value="popular">Most popular</option>
          <option value="newest">Newly added</option>
        </select>
      </div>

      <div className="tabs" role="tablist">
        {WHEN.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={when === v} className={when === v ? 'on' : ''} onClick={() => setWhen(v)}>{label}</button>
        ))}
      </div>

      <div className="chips">
        <button className={`pill ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`pill ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
            <span aria-hidden="true">{CAT[c].emoji}</span> {c}
          </button>
        ))}
      </div>

      {events === null && <p className="muted">Loading…</p>}
      {events?.length === 0 && <div className="card center muted">No events match. Try another filter, or <Link to="/events/new">create one</Link>.</div>}
      <div className="event-grid">
        {events?.map((e) => <EventCard key={e._id} event={e} />)}
      </div>
    </main>
  );
}
