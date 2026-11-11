import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errorMessage } from '../api';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import CapacityMeter from '../components/CapacityMeter.jsx';
import CountUp from '../components/CountUp.jsx';
import Ring from '../components/Ring.jsx';
import { fmtRange, timeAgo } from '../utils';

const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const hourLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric' });

// Organizer console: live numbers, check-in desk, attendees, announcements and analytics
export default function Manage() {
  const { id } = useParams();
  const nav = useNavigate();
  const socket = useSocket();
  const toast = useToast();

  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [attendees, setAttendees] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState('overview');
  const [viewers, setViewers] = useState(0);
  const [feed, setFeed] = useState([]); // live check-ins
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [ann, setAnn] = useState('');
  const refresh = useRef();
  const codeInput = useRef();

  const loadEvent = useCallback(() => api.get(`/events/${id}`).then((r) => setEvent(r.data)).catch((e) => setError(errorMessage(e))), [id]);
  const loadAttendees = useCallback(() => api.get(`/events/${id}/attendees`).then((r) => setAttendees(r.data)).catch(() => {}), [id]);
  const loadAnalytics = useCallback(() => api.get(`/events/${id}/analytics`).then((r) => setAnalytics(r.data)).catch(() => {}), [id]);

  useEffect(() => { loadEvent(); }, [loadEvent]);
  useEffect(() => { if (event?.isOrganizer) { loadAttendees(); loadAnalytics(); } }, [event?.isOrganizer, loadAttendees, loadAnalytics]);

  // live: seat numbers, who is watching, and check-ins as they happen at the door
  useEffect(() => {
    if (!socket) return;
    const join = () => { socket.emit('event:join', { eventId: id }); socket.emit('manage:join', { eventId: id }); };
    const onCounts = (c) => {
      if (c.eventId !== id) return;
      setEvent((e) => (e ? { ...e, confirmedCount: c.confirmedCount, waitlistCount: c.waitlistCount, checkedInCount: c.checkedInCount, capacity: c.capacity } : e));
      clearTimeout(refresh.current);
      refresh.current = setTimeout(() => { loadAttendees(); loadAnalytics(); }, 400);
    };
    const onViewers = (v) => { if (v.eventId === id) setViewers(v.count); };
    const onCheckin = (c) => { setFeed((f) => [{ ...c, key: Math.random() }, ...f].slice(0, 12)); };
    const onAnnouncement = ({ eventId, announcement }) => {
      if (eventId === id) setEvent((e) => (e && !e.announcements.some((a) => a._id === announcement._id) ? { ...e, announcements: [announcement, ...e.announcements] } : e));
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('event:counts', onCounts);
    socket.on('event:viewers', onViewers);
    socket.on('checkin:live', onCheckin);
    socket.on('event:announcement', onAnnouncement);
    return () => {
      socket.emit('event:leave');
      socket.emit('manage:leave', { eventId: id });
      ['connect', 'event:counts', 'event:viewers', 'checkin:live', 'event:announcement'].forEach((n) => socket.off(n));
      clearTimeout(refresh.current);
    };
  }, [socket, id, loadAttendees, loadAnalytics]);

  if (error) return <main className="container narrow"><div className="card center"><p className="error">{error}</p><Link to="/" className="btn">Back to dashboard</Link></div></main>;
  if (!event) return <p className="center muted pad">Loading…</p>;
  if (!event.isOrganizer) return <main className="container narrow"><div className="card center"><h2>Organizer access only</h2><p className="muted">Only the person who created this event can manage it.</p><Link to={`/events/${id}`} className="btn">View event</Link></div></main>;

  const checkinRate = event.confirmedCount ? Math.round((event.checkedInCount / event.confirmedCount) * 100) : 0;

  const checkInByCode = async (e) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    try {
      const { data } = await api.post(`/events/${id}/checkin`, { ticketCode: c });
      setResult({ ok: true, text: `${data.attendee.name} checked in ✓` });
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    }
    setCode('');
    codeInput.current?.focus();
  };

  const toggleCheckIn = async (a) => {
    try {
      await api.put(`/events/${id}/attendees/${a._id}/checkin`, { checkedIn: !a.checkedIn });
      loadAttendees();
    } catch (err) { toast(errorMessage(err)); }
  };

  const postAnnouncement = async (e) => {
    e.preventDefault();
    if (!ann.trim()) return;
    try {
      await api.post(`/events/${id}/announcements`, { text: ann });
      setAnn('');
      toast('Announcement sent to everyone registered.');
      loadEvent();
    } catch (err) { toast(errorMessage(err)); }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get(`/events/${id}/export.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.title.replace(/[^\w]+/g, '-').toLowerCase()}-attendees.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast(errorMessage(err)); }
  };

  const cancelEvent = async () => {
    if (!window.confirm('Cancel this event? Everyone registered will be notified.')) return;
    try { await api.post(`/events/${id}/cancel`); toast('Event cancelled.'); loadEvent(); } catch (err) { toast(errorMessage(err)); }
  };
  const deleteEvent = async () => {
    if (!window.confirm('Delete this event and all its registrations permanently?')) return;
    try { await api.delete(`/events/${id}`); toast('Event deleted.'); nav('/'); } catch (err) { toast(errorMessage(err)); }
  };

  const rows = (attendees || []).filter((a) => {
    if (status !== 'all' && a.status !== status) return false;
    const s = q.trim().toLowerCase();
    return !s || a.user.name.toLowerCase().includes(s) || a.user.email.toLowerCase().includes(s) || a.ticketCode.toLowerCase().includes(s);
  });

  const timeline = (analytics?.timeline || []).map((t) => ({ ...t, label: shortDate(t.date) }));
  const hours = (analytics?.checkins || []).map((c) => ({ ...c, label: hourLabel(c.hour) }));
  const pie = analytics ? [
    { name: 'Confirmed', value: analytics.breakdown.confirmed, color: '#12a36b' },
    { name: 'Waitlisted', value: analytics.breakdown.waitlisted, color: '#f5b301' },
    { name: 'Cancelled', value: analytics.breakdown.cancelled, color: '#e5484d' },
  ].filter((p) => p.value > 0) : [];

  return (
    <main className="container">
      <div className="row between page-head wrap">
        <div>
          <Link to={`/events/${id}`} className="small">← Back to event page</Link>
          <h1>{event.title}</h1>
          <p className="muted">{fmtRange(event.startAt, event.endAt)} · {event.mode === 'online' ? '🌐' : '📍'} {event.location}</p>
        </div>
        <div className="row wrap">
          {event.status === 'published' && <Link to={`/events/${id}/edit`} className="btn ghost small">Edit</Link>}
          <button className="btn ghost small" onClick={exportCsv}>Export CSV</button>
          {event.status === 'published' && <button className="btn ghost small danger-link" onClick={cancelEvent}>Cancel event</button>}
          <button className="btn ghost small danger-link" onClick={deleteEvent}>Delete</button>
        </div>
      </div>

      {event.status === 'cancelled' && <div className="banner bad">This event is cancelled. Attendees have been notified.</div>}

      <section className="stats">
        <div className="card stat"><span className="stat-label">Confirmed</span><strong className="stat-val"><CountUp value={event.confirmedCount} /><small> / {event.capacity}</small></strong><CapacityMeter event={event} /></div>
        <div className="card stat ring-stat"><div><span className="stat-label">Checked in</span><strong className="stat-val"><CountUp value={event.checkedInCount} /></strong><span className="muted tiny">of {event.confirmedCount} confirmed</span></div><Ring value={checkinRate} size={76} color="var(--good)" /></div>
        <div className="card stat"><span className="stat-label">On waitlist</span><strong className="stat-val"><CountUp value={event.waitlistCount} /></strong><span className="muted tiny">{event.waitlistCount ? 'will be promoted if seats open' : 'nobody waiting'}</span></div>
        <div className="card stat"><span className="stat-label">Viewing now</span><strong className="stat-val"><span className="live-dot big" />{Math.max(0, viewers - 1)}</strong><span className="muted tiny">other people on the event page</span></div>
      </section>

      <div className="tabs" role="tablist">
        {[['overview', 'Overview'], ['attendees', `Attendees (${attendees?.length ?? '…'})`], ['announce', 'Announcements']].map(([v, label]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <section className="grid-2">
            <div className="card">
              <div className="card-head"><h2>Registrations over time</h2><span className="muted small">running total</span></div>
              {timeline.length === 0 ? <p className="muted empty-chart">No registrations yet.</p> : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                      <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e11d74" stopOpacity={0.4} /><stop offset="100%" stopColor="#e11d74" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eadff0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#77698a' }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#77698a' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v, n) => [v, n === 'total' ? 'Total sign-ups' : 'New that day']} />
                      <Area type="monotone" dataKey="total" stroke="#e11d74" strokeWidth={3} fill="url(#tg)" dot={{ r: 3, fill: '#e11d74', strokeWidth: 0 }} activeDot={{ r: 7 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head"><h2>Live check-ins</h2><span className="live-badge"><span className="live-dot" />LIVE</span></div>
              {feed.length === 0 ? <p className="muted small">People who check in will appear here instantly. Use the Attendees tab to check people in.</p> : (
                <ul className="feed">
                  {feed.map((f) => (<li key={f.key} className="feed-item"><Avatar name={f.name} size={30} /><div className="grow small"><strong>{f.name}</strong> checked in<div className="muted tiny">{timeAgo(f.at)}</div></div></li>))}
                </ul>
              )}
            </div>
          </section>

          <section className="grid-2 even">
            <div className="card">
              <div className="card-head"><h2>Who's registered</h2></div>
              {pie.length === 0 ? <p className="muted empty-chart">Nothing to show yet.</p> : (
                <div className="pie-wrap">
                  <div style={{ height: 190, flex: '1 1 180px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3} cornerRadius={5}>{pie.map((p) => <Cell key={p.name} fill={p.color} stroke="none" />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="legend">{pie.map((p) => <li key={p.name}><span><span className="dot" style={{ background: p.color }} />{p.name}<strong>{p.value}</strong></span></li>)}</ul>
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-head"><h2>Check-ins by hour</h2></div>
              {hours.length === 0 ? <p className="muted empty-chart">No check-ins yet.</p> : (
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hours} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eadff0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#77698a' }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#77698a' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#fde7f1' }} formatter={(v) => [v, 'Check-ins']} />
                      <Bar dataKey="count" fill="#e11d74" radius={[8, 8, 0, 0]} barSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {tab === 'attendees' && (
        <>
          <form className="card scan-card" onSubmit={checkInByCode}>
            <div className="grow">
              <strong>Check-in desk</strong>
              <p className="muted small">Scan a QR code with a scanner or type the ticket code, then press Enter.</p>
            </div>
            <input ref={codeInput} className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="EVT-XXXXXX" maxLength={14} autoComplete="off" aria-label="Ticket code" />
            <button className="btn" disabled={!code.trim()}>Check in</button>
          </form>
          {result && <div className={`banner ${result.ok ? 'good' : 'bad'}`} role="status">{result.text}</div>}

          <div className="card">
            <div className="filters">
              <input className="search" type="search" placeholder="Search name, email or ticket…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search attendees" />
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                <option value="all">Everyone</option><option value="confirmed">Confirmed</option><option value="waitlisted">Waitlisted</option>
              </select>
            </div>
            {attendees === null ? <p className="muted">Loading…</p> : rows.length === 0 ? <p className="muted small">No attendees match.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Attendee</th><th>Status</th><th className="hide-sm">Ticket</th><th className="num">Check-in</th></tr></thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a._id}>
                        <td><span className="player"><Avatar name={a.user.name} size={30} /><span><strong>{a.user.name}</strong><span className="block muted tiny">{a.user.email}</span></span></span></td>
                        <td>{a.status === 'confirmed' ? <span className="chip good-chip">Confirmed</span> : <span className="chip warn-chip">Waitlist #{a.position}</span>}</td>
                        <td className="hide-sm"><code>{a.ticketCode}</code></td>
                        <td className="num">
                          {a.status === 'confirmed' ? (
                            <button className={`btn small ${a.checkedIn ? '' : 'ghost'}`} onClick={() => toggleCheckIn(a)}>{a.checkedIn ? '✓ Checked in' : 'Check in'}</button>
                          ) : <span className="muted tiny">n/a</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'announce' && (
        <div className="grid-2 even">
          <form className="card" onSubmit={postAnnouncement}>
            <h2>Send an announcement</h2>
            <p className="muted small">Everyone registered gets a notification straight away, and it appears live on the event page.</p>
            <label>Message
              <textarea rows={4} value={ann} onChange={(e) => setAnn(e.target.value)} maxLength={500} placeholder="e.g. Doors open at 6 PM. Please bring a photo ID." />
            </label>
            <div className="row between"><span className="muted tiny">{ann.length}/500</span><button className="btn" disabled={!ann.trim()}>Send to {event.confirmedCount + event.waitlistCount} people</button></div>
          </form>
          <div className="card">
            <h2>Sent so far</h2>
            {event.announcements.length === 0 ? <p className="muted small">Nothing sent yet.</p> : (
              <ul className="announcements">{event.announcements.map((a) => <li key={a._id}><span className="ann-icon" aria-hidden="true">📣</span><div><p>{a.text}</p><span className="muted tiny">{timeAgo(a.at)}</span></div></li>)}</ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
