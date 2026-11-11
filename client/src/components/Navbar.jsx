import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useOnline } from '../context/SocketContext.jsx';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const online = useOnline();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="logo"><span className="logo-mark">E</span><span className="logo-text">eventra</span></Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/events" end>Discover</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/tickets">My tickets</NavLink>
        </nav>
        <div className="row">
          <Link to="/events/new" className="btn small hide-sm">+ Create event</Link>
          <span className="online-pill" title="People online right now"><span className="live-dot green" />{online} online</span>
          <NotificationBell />
          <Avatar name={user.name} size={34} />
          <button className="btn ghost small" onClick={logout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
