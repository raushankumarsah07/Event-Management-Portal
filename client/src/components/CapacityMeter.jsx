import { seatsLeft } from '../utils';

// seats filled, updates live as people register
export default function CapacityMeter({ event, big }) {
  const pct = Math.min(100, Math.round((event.confirmedCount / event.capacity) * 100));
  const left = seatsLeft(event);
  const tone = left === 0 ? 'full' : pct >= 70 ? 'warm' : 'ok';
  return (
    <div className={`meter ${tone} ${big ? 'big' : ''}`}>
      <div className="meter-top">
        <span><strong>{event.confirmedCount}</strong> / {event.capacity} seats</span>
        <span className="meter-note">{left === 0 ? (event.waitlistCount ? `Full · ${event.waitlistCount} waiting` : 'Full') : `${left} left`}</span>
      </div>
      <div className="meter-track" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
