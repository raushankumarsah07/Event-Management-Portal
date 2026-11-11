const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Event = require('./models/Event');

// how many different people are connected right now
async function broadcastPresence(io) {
  const sockets = await io.fetchSockets();
  io.emit('presence', { online: new Set(sockets.map((s) => s.data.user._id)).size });
}

// how many different people have this event page open right now
async function broadcastViewers(io, eventId) {
  const sockets = await io.in(`event:${eventId}`).fetchSockets();
  io.to(`event:${eventId}`).emit('event:viewers', { eventId: String(eventId), count: new Set(sockets.map((s) => s.data.user._id)).size });
}

module.exports = function setupSocket(io) {
  // only logged-in users may connect
  io.use(async (socket, next) => {
    try {
      const { id } = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      const user = await User.findById(id).select('name');
      if (!user) throw new Error('no user');
      socket.data.user = { _id: String(user._id), name: user.name };
      next();
    } catch {
      next(new Error('Authentication failed. Please log in again.'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user._id}`); // personal room: notifications arrive here
    broadcastPresence(io);

    const leaveEvent = () => {
      const id = socket.data.viewing;
      if (!id) return;
      socket.leave(`event:${id}`);
      socket.data.viewing = null;
      broadcastViewers(io, id);
    };

    // people looking at an event page (live "viewing now" counter + live updates)
    socket.on('event:join', ({ eventId } = {}) => {
      if (!mongoose.isValidObjectId(eventId)) return;
      if (socket.data.viewing && socket.data.viewing !== eventId) leaveEvent();
      socket.join(`event:${eventId}`);
      socket.data.viewing = eventId;
      broadcastViewers(io, eventId);
    });
    socket.on('event:leave', leaveEvent);

    // organizers watching their own event's check-ins
    socket.on('manage:join', async ({ eventId } = {}) => {
      if (!mongoose.isValidObjectId(eventId)) return;
      const ev = await Event.findById(eventId).select('organizer').lean();
      if (ev && String(ev.organizer) === socket.data.user._id) socket.join(`manage:${eventId}`);
    });
    socket.on('manage:leave', ({ eventId } = {}) => eventId && socket.leave(`manage:${eventId}`));

    socket.on('disconnect', () => {
      const id = socket.data.viewing;
      if (id) setTimeout(() => broadcastViewers(io, id), 100);
      setTimeout(() => broadcastPresence(io), 100);
    });
  });
};
