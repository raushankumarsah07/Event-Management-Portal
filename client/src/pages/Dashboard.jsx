import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import useLiveEvents from '../hooks/useLiveEvents';
import ActivityFeed from '../components/ActivityFeed.jsx';
import CapacityMeter from '../components/CapacityMeter.jsx';
import Countdown from '../components/Countdown.jsx';
import CountUp from '../components/CountUp.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { catColor, dayBadge, fmtRange, CAT } from '../utils';

const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function SignupTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return <div className="chart-tip"><strong>{shortDate(p.date)}</strong><div>{p.count} new sign-up{p.count === 1 ? '' : 's'}</div></div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const socket = useSocket();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [pulse, setPulse] = useState(false);
  const timer = useRef();

  const load = useCallback(() => api.get('/stats/dashboard').then((r) => setD(r.data)).catch((e) => setError(errorMessage(e))), []);
  useEffect(() => { load(); }, [load]);

  // seat meters on this page change live
  const setLists = useCallback((fn) => setD((x) => (x ? { ...x, trending: fn(x.trending), hosting: fn(x.hosting) } : x)), []);
  useLiveEvents(setLists);

  // everything else reacts to other people's activity
  useEffect(() => {
    if (!socket) return;
    const onActivity = (a) => {
      setD((x) => (x ? { ...x, feed: [a, ...x.feed.filter((f) => f.id !== a.id)].slice(0, 12) } : x));
      setPulse(true);
      setTimeout(() => setPulse(false), 1500);
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 900); // refresh charts and totals shortly after
    };
    socket.on('activity', onActivity);
    return () => { socket.off('activity', onActivity); clearTimeout(timer.current); };
  }, [socket, load]);

  if (error) return <main className="container"><div className="card center"><p className="error">{error}</p></div></main>;
  if (!d) return <p className="center muted pad">Loading your dashboard…</p>;

  const t = d.totals;
  const first = user.name.split(' ')[0];
  const signups = d.signups.map((s) => ({ ...s, label: shortDate(s.date) }));
  const pie = d.categories.map((c) => ({ name: c.category, value: c.count }));
  const totalSignups = d.signups.reduce((s, x) => s + x.count, 0);

  return (
    <main className="container">
      <section className="hero">
        <div className="hero-main">
          <p className="eyebrow">Dashboard</p>
          <h1>Hi {first}, what's happening?</h1>
          <p className="hero-sub">
            {d.platform.events} upcoming events and {d.platform.users} people on Eventra right now.
          </p>
          <div className="row wrap">
            <Link to="/events" className="btn light">Discover events</Link>
            <Link to="/events/new" className="btn outline-light">+ Create an event</Link>
          </div>
        </div>

        <div className="next-card">
          {d.next ? (
            <>
              <p className="eyebrow">Your next event</p>
              <h3>{d.next.event.title}</h3>
              <p className="small next-meta">{fmtRange(d.next.event.startAt, d.next.event.endAt)}</p>
              <Countdown to={d.next.event.startAt} endAt={d.next.event.endAt} />
              <Link to={`/events/${d.next.event._id}`} className="btn light small">View event</Link>
            </>
          ) : (
            <>
              <p className="eyebrow">Your next event</p>
              <h3>Nothing booked yet</h3>
              <p className="small next-meta">Find something to go to this week.</p>
              <Link to="/events" className="btn light small">Browse events</Link>
            </>
          )}
        </div>
      </section>

      <section className="stats">
        <Link to="/tickets" className="card stat"><span className="stat-label">Upcoming tickets</span><strong className="stat-val"><CountUp value={t.upcomingTickets} /></strong><span className="muted tiny">events you're going to</span></Link>
        <div className="card stat"><span className="stat-label">Events attended</span><strong className="stat-val"><CountUp value={t.attended} /></strong><span className="muted tiny">checked in at the door</span></div>
        <div className="card stat"><span className="stat-label">Events hosted</span><strong className="stat-val"><CountUp value={t.hosting} /></strong><span className="muted tiny">that you organise</span></div>
        <div className="card stat"><span className="stat-label">Your audience</span><strong className="stat-val"><CountUp value={t.audience} /></strong><span className="muted tiny">confirmed across your events</span></div>
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Sign-ups for your events</h2><span className="muted small">{totalSignups} in the last 14 days</span></div>
          {totalSignups === 0 ? (
            <p className="muted empty-chart">Sign-ups for events you host will appear here.</p>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signups} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e11d74" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#e11d74" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eadff0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#77698a' }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#77698a' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<SignupTip />} />
                  <Area type="monotone" dataKey="count" stroke="#e11d74" strokeWidth={3} fill="url(#sg)" dot={{ r: 3.5, fill: '#e11d74', strokeWidth: 0 }} activeDot={{ r: 7 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Live activity</h2>
            <span className={`live-badge ${pulse ? 'flash' : ''}`}><span className="live-dot" />LIVE</span>
          </div>
          <ActivityFeed items={d.feed} />
        </div>
      </section>

      <section className="grid-2 even">
        <div className="card">
          <div className="card-head"><h2>What's on, by category</h2><span className="muted small">click to explore</span></div>
          {pie.length === 0 ? (
            <p className="muted empty-chart">No upcoming events yet.</p>
          ) : (
            <div className="pie-wrap">
              <div style={{ height: 210, flex: '1 1 200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={3} cornerRadius={5}
                      onClick={(e) => nav(`/events?category=${e.name}`)} style={{ cursor: 'pointer' }}>
                      {pie.map((p) => <Cell key={p.name} fill={catColor(p.name)} stroke="none" />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} event${v === 1 ? '' : 's'}`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend">
                {pie.map((p) => (
                  <li key={p.name}><Link to={`/events?category=${p.name}`}><span className="dot" style={{ background: catColor(p.name) }} />{CAT[p.name]?.emoji} {p.name}<strong>{p.value}</strong></Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>Trending now</h2><span className="live-badge"><span className="live-dot" />LIVE</span></div>
          <ol className="trend">
            {d.trending.map((e, i) => (
              <li key={e._id}>
                <span className={`rank r${i + 1}`}>{i + 1}</span>
                <div className="grow">
                  <Link to={`/events/${e._id}`} className="trend-title">{e.title}</Link>
                  <CapacityMeter event={e} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid-2 even">
        <div className="card">
          <div className="card-head"><h2>Your upcoming tickets</h2><Link to="/tickets" className="small">All tickets →</Link></div>
          {d.upcoming.length === 0 ? (
            <p className="muted small">No tickets yet. <Link to="/events">Find an event</Link>.</p>
          ) : (
            <ul className="mini-list">
              {d.upcoming.map(({ event }) => {
                const b = dayBadge(event.startAt);
                return (
                  <li key={event._id}>
                    <span className="date-chip"><small>{b.month}</small><strong>{b.day}</strong></span>
                    <div className="grow">
                      <Link to={`/events/${event._id}`} className="strong">{event.title}</Link>
                      <div className="muted tiny">{fmtRange(event.startAt, event.endAt)}</div>
                    </div>
                    <StatusChip event={event} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>Events you host</h2><Link to="/events/new" className="small">+ New</Link></div>
          {d.hosting.length === 0 ? (
            <p className="muted small">You haven't created an event yet. <Link to="/events/new">Create your first one</Link>.</p>
          ) : (
            <ul className="mini-list">
              {d.hosting.map((e) => (
                <li key={e._id} className="host-row">
                  <div className="grow">
                    <Link to={`/events/${e._id}/manage`} className="strong">{e.title}</Link>
                    {e.status === 'cancelled' ? <span className="chip bad-chip">Cancelled</span> : <CapacityMeter event={e} />}
                  </div>
                  <Link to={`/events/${e._id}/manage`} className="btn ghost small">Manage</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
