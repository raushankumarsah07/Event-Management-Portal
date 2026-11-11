import Modal from './Modal.jsx';
import QRCodeImg from './QRCodeImg.jsx';
import Confetti from './Confetti.jsx';
import { downloadIcs, fmtRange } from '../utils';

// the digital ticket shown after booking (and from "My tickets")
export default function TicketModal({ event, ticketCode, status, position, celebrate, onClose }) {
  const confirmed = status === 'confirmed';
  return (
    <Modal title={confirmed ? 'Your ticket' : 'You are on the waitlist'} onClose={onClose}>
      {celebrate && confirmed && <Confetti />}
      <div className="ticket">
        <p className="eyebrow">{event.category}</p>
        <h3>{event.title}</h3>
        <p className="muted small">{fmtRange(event.startAt, event.endAt)}</p>
        <p className="muted small">{event.mode === 'online' ? '🌐' : '📍'} {event.location}</p>
        <div className="ticket-tear" />
        {confirmed ? (
          <>
            <QRCodeImg value={ticketCode} />
            <div className="ticket-code">{ticketCode}</div>
            <p className="muted tiny">Show this QR code or the code above at check-in.</p>
          </>
        ) : (
          <div className="waitlist-box">
            <strong>#{position}</strong>
            <span>in the waitlist queue</span>
            <p className="muted small">If someone cancels, you move up automatically and get a notification. Your ticket will appear here.</p>
          </div>
        )}
        <div className="row wrap center-row">
          <button className="btn ghost small" onClick={() => downloadIcs(event)}>Add to calendar</button>
          <button className="btn small" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}
