import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Discover from './pages/Discover.jsx';
import EventDetail from './pages/EventDetail.jsx';
import EventForm from './pages/EventForm.jsx';
import Manage from './pages/Manage.jsx';
import Tickets from './pages/Tickets.jsx';
import CalendarPage from './pages/CalendarPage.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="center muted pad">Loading…</p>;
  // remember the page they wanted (e.g. a shared event link) so login can send them back
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const back = location.state?.from || '/';

  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to={back} replace /> : <AuthPage mode="login" />} />
        <Route path="/register" element={user ? <Navigate to={back} replace /> : <AuthPage mode="register" />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/events" element={<Protected><Discover /></Protected>} />
        <Route path="/events/new" element={<Protected><EventForm /></Protected>} />
        <Route path="/events/:id" element={<Protected><EventDetail /></Protected>} />
        <Route path="/events/:id/edit" element={<Protected><EventForm /></Protected>} />
        <Route path="/events/:id/manage" element={<Protected><Manage /></Protected>} />
        <Route path="/tickets" element={<Protected><Tickets /></Protected>} />
        <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
