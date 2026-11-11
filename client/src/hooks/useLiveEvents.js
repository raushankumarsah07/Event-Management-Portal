import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { applyCounts } from '../utils';

// keeps a list of events in sync: seat counts change live, deleted/cancelled events disappear
export default function useLiveEvents(setEvents) {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const onCounts = (c) => setEvents((list) => applyCounts(list, c));
    const onRemoved = ({ eventId }) => setEvents((list) => list.filter((e) => e._id !== eventId));
    socket.on('event:counts', onCounts);
    socket.on('event:removed', onRemoved);
    return () => { socket.off('event:counts', onCounts); socket.off('event:removed', onRemoved); };
  }, [socket, setEvents]);
}
