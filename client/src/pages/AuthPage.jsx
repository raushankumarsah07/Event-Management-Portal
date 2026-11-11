import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { authenticate } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = async (path, body) => {
    setError('');
    setBusy(true);
    try {
      await authenticate(path, body);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <span className="logo big"><span className="logo-mark">E</span>eventra</span>
        <h1>Find it. Book it.<br />Run it live.</h1>
        <ul className="auth-points">
          <li><strong>Instant tickets</strong> with a QR code for the door</li>
          <li><strong>Smart waitlist</strong> that fills seats automatically</li>
          <li><strong>Live dashboard</strong> for organizers: sign-ups, check-ins, analytics</li>
          <li><strong>Real-time updates</strong> so seat counts are always accurate</li>
        </ul>
      </div>

      <form className="card auth-card" onSubmit={(e) => { e.preventDefault(); run(isLogin ? 'login' : 'register', form); }}>
        <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
        {!isLogin && (
          <label>Your name
            <input value={form.name} onChange={set('name')} maxLength={40} required autoFocus />
          </label>
        )}
        <label>Email
          <input type="email" value={form.email} onChange={set('email')} required autoFocus={isLogin} />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={set('password')} required minLength={isLogin ? 1 : 8}
            placeholder={isLogin ? '' : 'At least 8 characters'} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn wide" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}</button>
        {isLogin && (
          <button type="button" className="btn ghost wide" disabled={busy}
            onClick={() => run('login', { email: 'demo@eventra.com', password: 'password123' })}>
            Try the demo account
          </button>
        )}
        <p className="muted center small">
          {isLogin ? <>New here? <Link to="/register">Create an account</Link></> : <>Have an account? <Link to="/login">Log in</Link></>}
        </p>
      </form>
    </div>
  );
}
