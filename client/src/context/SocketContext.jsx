import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null, online: 0 });
export const useSocket = () => useContext(SocketContext).socket;
export const useOnline = () => useContext(SocketContext).online;

// One WebSocket connection for the whole app while logged in
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    if (!user) return;
    const s = io(API_URL || undefined, { auth: { token: localStorage.getItem('token') } });
    s.on('presence', (p) => setOnline(p.online));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setOnline(0);
    };
  }, [user?._id]);

  return <SocketContext.Provider value={{ socket, online }}>{children}</SocketContext.Provider>;
}
