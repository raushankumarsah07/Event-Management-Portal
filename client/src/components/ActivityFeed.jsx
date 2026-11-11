import { Link } from 'react-router-dom';
import useNow from '../hooks/useNow';
import Avatar from './Avatar.jsx';
import { timeAgo } from '../utils';

const VERB = { register: 'registered for', waitlist: 'joined the waitlist for', event: 'created the event' };

// live stream of what is happening on the platform
export default function ActivityFeed({ items }) {
  useNow(30000); // refreshes the "x min ago" labels
  if (!items.length) return <p className="muted small">No activity yet.</p>;
  return (
    <ul className="feed">
      {items.map((a) => (
        <li key={a.id} className="feed-item">
          <Avatar name={a.user.name} size={32} />
          <div className="grow">
            <div className="small">
              <strong>{a.user.name}</strong> {VERB[a.type] || 'joined'} <Link to={`/events/${a.event._id}`}>{a.event.title}</Link>
            </div>
            <div className="muted tiny">{timeAgo(a.at)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
