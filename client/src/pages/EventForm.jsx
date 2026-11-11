import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext.jsx';
import EventCover from '../components/EventCover.jsx';
import { CAT, CATEGORIES, fmtRange, fromLocalInput, toLocalInput } from '../utils';

// default: tomorrow at 6 PM for two hours
const defaultStart = () => { const d = new Date(Date.now() + 864e5); d.setHours(18, 0, 0, 0); return d; };

// create an event, or edit one you organise (/events/:id/edit)
export default function EventForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(() => {
    const s = defaultStart();
    return { title: '', description: '', category: 'Tech', mode: 'in-person', location: '', startAt: toLocalInput(s), endAt: toLocalInput(new Date(+s + 2 * 36e5)), capacity: 50, coverImage: '' };
  });
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/events/${id}`)
      .then(({ data: e }) => {
        if (!e.isOrganizer) throw { response: { data: { message: 'Only the organizer can edit this event.' } } };
        setForm({ title: e.title, description: e.description, category: e.category, mode: e.mode, location: e.location, startAt: toLocalInput(e.startAt), endAt: toLocalInput(e.endAt), capacity: e.capacity, coverImage: e.coverImage || '' });
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // moving the start time moves the end time with it, so the length stays the same
  const setStart = (e) => {
    const v = e.target.value;
    const len = new Date(form.endAt) - new Date(form.startAt);
    const next = { ...form, startAt: v };
    if (v && len > 0) next.endAt = toLocalInput(new Date(+new Date(v) + len));
    setForm(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { ...form, startAt: fromLocalInput(form.startAt), endAt: fromLocalInput(form.endAt), capacity: parseInt(form.capacity, 10) };
      const { data } = id ? await api.put(`/events/${id}`, body) : await api.post('/events', body);
      toast(id ? 'Event updated.' : 'Event created! Share it with people.');
      nav(`/events/${data._id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="center muted pad">Loading…</p>;
  if (id && error && !form.title) return <main className="container narrow"><div className="card center"><p className="error">{error}</p><Link to="/events" className="btn">Back</Link></div></main>;

  const preview = { ...form, category: form.category };
  const validDates = form.startAt && form.endAt && new Date(form.endAt) > new Date(form.startAt);

  return (
    <main className="container wide">
      <h1>{id ? 'Edit event' : 'Create an event'}</h1>
      <div className="form-grid">
        <form onSubmit={submit} className="card">
          <label>Event title
            <input value={form.title} onChange={set('title')} maxLength={100} required placeholder="e.g. Summer Rooftop Meetup" />
          </label>
          <label>Description
            <textarea rows={4} value={form.description} onChange={set('description')} maxLength={2000} placeholder="What will people do, see or learn?" />
          </label>
          <div className="form-row">
            <label>Category
              <select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{CAT[c].emoji} {c}</option>)}</select>
            </label>
            <label>Format
              <select value={form.mode} onChange={set('mode')}><option value="in-person">In-person</option><option value="online">Online</option></select>
            </label>
          </div>
          <label>{form.mode === 'online' ? 'Meeting link or platform' : 'Venue or address'}
            <input value={form.location} onChange={set('location')} maxLength={150} required placeholder={form.mode === 'online' ? 'e.g. Zoom, link sent after registration' : 'e.g. City Hall, Main Street'} />
          </label>
          <div className="form-row">
            <label>Starts
              <input type="datetime-local" value={form.startAt} onChange={setStart} required />
            </label>
            <label>Ends
              <input type="datetime-local" value={form.endAt} onChange={set('endAt')} required />
            </label>
          </div>
          {!validDates && <p className="error">The end time must be after the start time.</p>}
          <div className="form-row">
            <label>Capacity (seats)
              <input type="number" min="1" max="10000" value={form.capacity} onChange={set('capacity')} required />
            </label>
            <label>Cover image link (optional)
              <input type="url" value={form.coverImage} onChange={set('coverImage')} placeholder="https://…" />
            </label>
          </div>
          <p className="muted small">When the event is full, new sign-ups join a waitlist. If you increase the capacity later, people on the waitlist are confirmed automatically.</p>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="btn" disabled={busy || !validDates}>{busy ? 'Saving…' : id ? 'Save changes' : 'Publish event'}</button>
            <Link to={id ? `/events/${id}` : '/events'} className="btn ghost">Cancel</Link>
          </div>
        </form>

        <aside className="preview">
          <p className="eyebrow">Live preview</p>
          <div className="card event-card">
            <EventCover event={preview}><span className="cover-cat">{form.category}</span></EventCover>
            <div className="event-body">
              <h3>{form.title || 'Your event title'}</h3>
              {validDates && <p className="muted small meta-line">{fmtRange(form.startAt, form.endAt)}</p>}
              <p className="muted small meta-line">{form.mode === 'online' ? '🌐' : '📍'} {form.location || 'Where is it happening?'}</p>
              <div className="meter ok"><div className="meter-top"><span><strong>0</strong> / {form.capacity || 0} seats</span><span className="meter-note">{form.capacity || 0} left</span></div><div className="meter-track"><span style={{ width: '0%' }} /></div></div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
