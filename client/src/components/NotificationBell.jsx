import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { timeAgo } from '../utils';

const ICON = { promoted: '🎉', announcement: '📣', updated: '✏️', cancelled: '⚠️' };

export default function NotificationBell() {
  const socket = useSocket();
  const toast = useToast();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    api.get('/notifications').then(({ data }) => { setItems(data.items); setUnread(data.unread); });
  }, []);

  // notifications arrive instantly over the WebSocket
  useEffect(() => {
    if (!socket) return;
    const onNew = (n) => {
      setItems((l) => [n, ...l].slice(0, 30));
      setUnread((u) => u + 1);
      toast(`${ICON[n.type] || '🔔'} ${n.message}`);
    };
    socket.on('notification', onNew);
    return () => socket.off('notification', onNew);
  }, [socket, toast]);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const openItem = (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((l) => l.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.put(`/notifications/${n._id}/read`);
    }
    if (n.event) nav(`/events/${n.event}`);
  };

  const markAll = async () => {
    await api.put('/notifications/read-all');
    setItems((l) => l.map((x) => ({ ...x, read: true })));
    setUnread(0);
  };

  return (
    <div className="bell" ref={box}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <strong>Notifications</strong>
            {unread > 0 && <button className="link-btn" onClick={markAll}>Mark all read</button>}
          </div>
          {items.length === 0 && <p className="muted small pad-s">You're all caught up.</p>}
          {items.map((n) => (
            <button key={n._id} className={`note ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
              <span>{ICON[n.type]} {n.message}</span>
              <span className="muted tiny">{timeAgo(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
