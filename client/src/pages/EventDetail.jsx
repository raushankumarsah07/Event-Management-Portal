import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import CapacityMeter from '../components/CapacityMeter.jsx';
import EventCover from '../components/EventCover.jsx';
import Ring from '../components/Ring.jsx';
import StatusChip from '../components/StatusChip.jsx';
import TicketModal from '../components/TicketModal.jsx';
import { downloadIcs, eventTiming, fmtRange, seatsLeft, timeAgo } from '../utils';

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const socket = useSocket();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [viewers, setViewers] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState(null); // { celebrate } when the ticket window is open

  const load = useCallback(() => api.get(`/events/${id}`).then((r) => setEvent(r.data)).catch((e) => setError(errorMessage(e))), [id]);
  useEffect(() => { setEvent(null); setError(''); load(); }, [load]);

  // live: seat counts, who is viewing, announcements and changes made by the organizer
  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('event:join', { eventId: id });
    const onCounts = (c) => {
      if (c.eventId === id) setEvent((e) => (e ? { ...e, confirmedCount: c.confirmedCount, waitlistCount: c.waitlistCount, checkedInCount: c.checkedInCount, capacity: c.capacity } : e));
    };
    const onViewers = (v) => { if (v.eventId === id) setViewers(v.count); };
    const onAnnouncement = ({ eventId, announcement }) => {
      if (eventId !== id) return;
      setEvent((e) => (e && !e.announcements.some((a) => a._id === announcement._id) ? { ...e, announcements: [announcement, ...e.announcements] } : e));
    };
    const onChanged = ({ eventId }) => { if (eventId === id) load(); };
    const onNote = (n) => { if (n.event === id) load(); }; // e.g. I was promoted from the waitlist

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('event:counts', onCounts);
    socket.on('event:viewers', onViewers);
    socket.on('event:announcement', onAnnouncement);
    socket.on('event:updated', onChanged);
    socket.on('event:removed', onChanged);
    socket.on('notification', onNote);
    return () => {
      socket.emit('event:leave');
      ['connect', 'event:counts', 'event:viewers', 'event:announcement', 'event:updated', 'event:removed', 'notification'].forEach((n) => socket.off(n));
    };
  }, [socket, id, load]);

  if (error) return <main className="container narrow"><div className="card center"><h2>Event not found</h2><p className="error">{error}</p><Link to="/events" className="btn">Browse events</Link></div></main>;
  if (!event) return <p className="center muted pad">Loading event…</p>;

  const timing = eventTiming(event);
  const mine = event.myRegistration;
  const full = seatsLeft(event) === 0;
  const closed = event.status === 'cancelled' || timing === 'ended';
  const fill = Math.round((event.confirmedCount / event.capacity) * 100);

  const register = async () => {
    setBusy(true);
    try {
      await api.post(`/events/${id}/register`);
      await load();
      setTicket({ celebrate: true });
    } catch (err) { toast(errorMessage(err)); } finally { setBusy(false); }
  };

  const cancelRegistration = async () => {
    if (!window.confirm('Cancel your registration? Your seat goes to the next person.')) return;
    setBusy(true);
    try {
      await api.delete(`/events/${id}/register`);
      toast('Your registration was cancelled.');
      await load();
    } catch (err) { toast(errorMessage(err)); } finally { setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast('Link copied'); } catch { toast(window.location.href); }
  };

  return (
    <main className="container wide">
      <div className="detail-cover">
        <EventCover event={event} className="tall" />
        <div className="detail-cover-over">
          <span className="chip cat-chip">{event.category}</span>
          <StatusChip event={event} />
        </div>
      </div>

      {event.status === 'cancelled' && <div className="banner bad">This event has been cancelled by the organizer.</div>}

      <div className="detail-grid">
        <div className="detail-main">
          <h1>{event.title}</h1>
          <p className="muted">Hosted by <strong>{event.organizer?.name}</strong></p>

          <div className="facts">
            <div><span aria-hidden="true">🗓️</span><div><strong>{fmtRange(event.startAt, event.endAt)}</strong><small>Add it to your calendar below</small></div></div>
            <div><span aria-hidden="true">{event.mode === 'online' ? '🌐' : '📍'}</span><div><strong>{event.location}</strong><small>{event.mode === 'online' ? 'Online event' : 'In-person event'}</small></div></div>
          </div>

          <h2 className="sub">About this event</h2>
          <p className="desc-text">{event.description || 'No description yet.'}</p>

          <h2 className="sub">Announcements {event.announcements.length > 0 && <span className="chip">{event.announcements.length}</span>}</h2>
          {event.announcements.length === 0 ? (
            <p className="muted small">No announcements yet. Updates from the organizer appear here instantly.</p>
          ) : (
            <ul className="announcements">
              {event.announcements.map((a) => (
                <li key={a._id}><span className="ann-icon" aria-hidden="true">📣</span><div><p>{a.text}</p><span className="muted tiny">{timeAgo(a.at)}</span></div></li>
              ))}
            </ul>
          )}
        </div>

        <aside className="card book-card">
          <div className="row between">
            <Ring value={fill} size={84} label="full" color={full ? 'var(--bad)' : 'var(--accent)'} />
            <div className="viewers" title="People looking at this page right now"><span className="live-dot" />{viewers > 1 ? `${viewers} people viewing` : 'Live'}</div>
          </div>
          <CapacityMeter event={event} big />

          {event.isOrganizer && (
            <div className="organizer-box">
              <span className="chip you">You're the organizer</span>
              <div className="row wrap">
                <Link to={`/events/${id}/manage`} className="btn small">Manage event</Link>
                {event.status === 'published' && <Link to={`/events/${id}/edit`} className="btn ghost small">Edit</Link>}
              </div>
            </div>
          )}

          {closed ? (
            <button className="btn wide" disabled>{event.status === 'cancelled' ? 'Event cancelled' : 'Event has ended'}</button>
          ) : mine ? (
            <>
              <button className="btn wide" onClick={() => setTicket({ celebrate: false })}>
                {mine.status === 'confirmed' ? 'View my ticket' : `On the waitlist · #${mine.position}`}
              </button>
              <button className="link-btn danger-link center-btn" onClick={cancelRegistration} disabled={busy}>Cancel my registration</button>
            </>
          ) : (
            <button className="btn wide" onClick={register} disabled={busy}>
              {busy ? 'Booking…' : full ? 'Join the waitlist' : 'Register · Free'}
            </button>
          )}
          {!mine && !closed && full && <p className="muted tiny center">This event is full. Join the waitlist and you'll get a seat automatically if someone cancels.</p>}

          <div className="row wrap center-row">
            <button className="btn ghost small" onClick={() => downloadIcs(event)}>Add to calendar</button>
            <button className="btn ghost small" onClick={copyLink}>Share link</button>
          </div>
        </aside>
      </div>

      {ticket && mine && (
        <TicketModal event={event} ticketCode={mine.ticketCode} status={mine.status} position={mine.position} celebrate={ticket.celebrate} onClose={() => setTicket(null)} />
      )}
    </main>
  );
}
