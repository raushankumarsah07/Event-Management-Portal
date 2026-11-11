import { eventTiming, seatsLeft } from '../utils';

// one small badge that says what is going on with this event for me
export default function StatusChip({ event }) {
  const timing = eventTiming(event);
  if (event.status === 'cancelled') return <span className="chip bad-chip">Cancelled</span>;
  if (event.myStatus === 'confirmed') return <span className="chip good-chip">✓ Registered</span>;
  if (event.myStatus === 'waitlisted') return <span className="chip warn-chip">On waitlist</span>;
  if (timing === 'ended') return <span className="chip">Ended</span>;
  if (timing === 'live') return <span className="chip live-chip"><span className="live-dot" />Happening now</span>;
  if (seatsLeft(event) === 0) return <span className="chip warn-chip">Full · waitlist open</span>;
  return null;
}
