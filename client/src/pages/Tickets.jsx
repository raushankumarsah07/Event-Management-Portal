import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import QRCodeImg from '../components/QRCodeImg.jsx';
import StatusChip from '../components/StatusChip.jsx';
import TicketModal from '../components/TicketModal.jsx';
import { catColor, dayBadge, downloadIcs, eventTiming, fmtRange } from '../utils';

export default function Tickets() {
  const socket = useSocket();
  const toast = useToast();
  const [tickets, setTickets] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => api.get('/tickets/mine').then((r) => setTickets(r.data)).catch((e) => toast(errorMessage(e))), [toast]);
  useEffect(() => { load(); }, [load]);

  // a seat opened up and I moved from the waitlist to confirmed: refresh right away
  useEffect(() => {
    if (!socket) return;
    const onNote = (n) => { if (n.type === 'promoted' || n.type === 'cancelled' || n.type === 'updated') load(); };
    socket.on('notification', onNote);
    return () => socket.off('notification', onNote);
  }, [socket, load]);

  const cancel = async (t) => {
    if (!window.confirm(`Cancel your ${t.status === 'waitlisted' ? 'waitlist spot' : 'ticket'} for “${t.event.title}”?`)) return;
    try {
      await api.delete(`/events/${t.event._id}/register`);
      toast('Registration cancelled.');
      load();
    } catch (err) { toast(errorMessage(err)); }
  };

  const isPast = (t) => eventTiming(t.event) === 'ended' || t.event.status === 'cancelled';
  const shown = (tickets || []).filter((t) => (tab === 'upcoming' ? !isPast(t) : isPast(t)));
  const past = (tickets || []).filter(isPast).sort((a, b) => new Date(b.event.startAt) - new Date(a.event.startAt));
  const list = tab === 'upcoming' ? shown : past;

  return (
    <main className="container">
      <div className="page-head">
        <h1>My tickets</h1>
        <p className="muted">Show the QR code at the door. Waitlisted tickets turn into real tickets automatically.</p>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'upcoming'} className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button role="tab" aria-selected={tab === 'past'} className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>Past &amp; cancelled</button>
      </div>

      {tickets === null && <p className="muted">Loading…</p>}
      {tickets && list.length === 0 && (
        <div className="card center muted">{tab === 'upcoming' ? <>No upcoming tickets. <Link to="/events">Discover events</Link>.</> : 'Nothing here yet.'}</div>
      )}

      <div className="ticket-list">
        {list.map((t) => {
          const b = dayBadge(t.event.startAt);
          const live = !isPast(t);
          return (
            <article className="card ticket-card" key={t._id} style={{ '--tc': catColor(t.event.category) }}>
              <div className="ticket-date"><small>{b.month}</small><strong>{b.day}</strong></div>
              <div className="ticket-info">
                <Link to={`/events/${t.event._id}`} className="ticket-title">{t.event.title}</Link>
                <p className="muted small">{fmtRange(t.event.startAt, t.event.endAt)}</p>
                <p className="muted small">{t.event.mode === 'online' ? '🌐' : '📍'} {t.event.location}</p>
                <div className="row wrap">
                  <StatusChip event={{ ...t.event, myStatus: t.status }} />
                  {t.checkedIn && <span className="chip good-chip">Checked in</span>}
                  {t.status === 'waitlisted' && live && <span className="chip warn-chip">Queue position #{t.position}</span>}
                </div>
                {live && (
                  <div className="row wrap ticket-actions">
                    <button className="btn small" onClick={() => setOpen(t)}>{t.status === 'confirmed' ? 'Show ticket' : 'Waitlist details'}</button>
                    <button className="btn ghost small" onClick={() => downloadIcs(t.event)}>Add to calendar</button>
                    <button className="link-btn danger-link" onClick={() => cancel(t)}>Cancel</button>
                  </div>
                )}
              </div>
              {live && t.status === 'confirmed' && (
                <button className="ticket-qr" onClick={() => setOpen(t)} aria-label="Open ticket"><QRCodeImg value={t.ticketCode} size={96} /><span className="tiny">{t.ticketCode}</span></button>
              )}
            </article>
          );
        })}
      </div>

      {open && <TicketModal event={open.event} ticketCode={open.ticketCode} status={open.status} position={open.position} onClose={() => setOpen(null)} />}
    </main>
  );
}
