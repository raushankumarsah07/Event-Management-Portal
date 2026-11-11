import { Link } from 'react-router-dom';
import CapacityMeter from './CapacityMeter.jsx';
import EventCover from './EventCover.jsx';
import StatusChip from './StatusChip.jsx';
import { dayBadge, fmtRange } from '../utils';

export default function EventCard({ event }) {
  const b = dayBadge(event.startAt);
  return (
    <Link to={`/events/${event._id}`} className={`card event-card ${event.status === 'cancelled' ? 'is-cancelled' : ''}`}>
      <EventCover event={event}>
        <span className="date-badge"><small>{b.month}</small><strong>{b.day}</strong></span>
        <span className="cover-cat">{event.category}</span>
      </EventCover>
      <div className="event-body">
        <div className="row between top">
          <h3>{event.title}</h3>
        </div>
        <p className="muted small meta-line">{fmtRange(event.startAt, event.endAt)}</p>
        <p className="muted small meta-line">{event.mode === 'online' ? '🌐' : '📍'} {event.location}</p>
        <CapacityMeter event={event} />
        <div className="row between wrap card-foot">
          <StatusChip event={event} />
          <span className="muted tiny">by {event.organizer?.name}</span>
        </div>
      </div>
    </Link>
  );
}
