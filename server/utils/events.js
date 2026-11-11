const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Notification = require('../models/Notification');

// How an event is sent to the browser
function eventDto(e, { userId, myReg } = {}) {
  const org = e.organizer;
  const orgId = org && org._id ? String(org._id) : String(org);
  return {
    _id: e._id,
    title: e.title,
    description: e.description,
    category: e.category,
    mode: e.mode,
    location: e.location,
    startAt: e.startAt,
    endAt: e.endAt,
    capacity: e.capacity,
    coverImage: e.coverImage,
    status: e.status,
    confirmedCount: e.confirmedCount,
    waitlistCount: e.waitlistCount,
    checkedInCount: e.checkedInCount,
    organizer: org && org._id ? { _id: org._id, name: org.name } : null,
    isOrganizer: userId ? orgId === String(userId) : false,
    myStatus: myReg ? myReg.status : null,
    createdAt: e.createdAt,
  };
}

// Saves a notification for each user and pushes it live to their open browser tabs
async function notify(io, userIds, { type, message, event }) {
  const ids = [...new Set(userIds.map(String))];
  for (const user of ids) {
    const n = await Notification.create({ user, type, message, event });
    io.to(`user:${user}`).emit('notification', n.toObject());
  }
}

// Tells every open page the new seat numbers for an event, so cards and meters update live
async function emitCounts(io, eventId) {
  const e = await Event.findById(eventId).select('confirmedCount waitlistCount checkedInCount capacity').lean();
  if (e) io.emit('event:counts', { eventId: String(eventId), confirmedCount: e.confirmedCount, waitlistCount: e.waitlistCount, checkedInCount: e.checkedInCount, capacity: e.capacity });
}

// Everyone sees what's happening on the platform (first come, first served)
const emitActivity = (io, a) => io.emit('activity', { id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: new Date(), ...a });

// When a seat frees up (cancellation or bigger capacity), move people up from the waitlist, oldest first.
// Every step is atomic, so two requests at once can never fill the same seat twice.
async function promoteWaitlist(io, event) {
  const promoted = [];
  for (;;) {
    const seat = await Event.findOneAndUpdate(
      { _id: event._id, status: 'published', $expr: { $lt: ['$confirmedCount', '$capacity'] }, waitlistCount: { $gt: 0 } },
      { $inc: { confirmedCount: 1, waitlistCount: -1 } },
      { new: true }
    );
    if (!seat) break;
    const reg = await Registration.findOneAndUpdate(
      { event: event._id, status: 'waitlisted' },
      { $set: { status: 'confirmed' } },
      { sort: { queuedAt: 1 }, new: true }
    );
    if (!reg) {
      // counters said someone was waiting but nobody was: undo
      await Event.updateOne({ _id: event._id }, { $inc: { confirmedCount: -1, waitlistCount: 1 } });
      break;
    }
    promoted.push(reg);
  }
  if (promoted.length) {
    await notify(io, promoted.map((r) => r.user), {
      type: 'promoted',
      message: `Good news! A seat opened up and you're now confirmed for “${event.title}”.`,
      event: event._id,
    });
  }
  return promoted;
}

// Rebuild the counters from the registrations (used by the seed script and tests)
async function recountEvent(eventId) {
  const [confirmed, waitlisted, checkedIn] = await Promise.all([
    Registration.countDocuments({ event: eventId, status: 'confirmed' }),
    Registration.countDocuments({ event: eventId, status: 'waitlisted' }),
    Registration.countDocuments({ event: eventId, status: 'confirmed', checkedIn: true }),
  ]);
  await Event.updateOne({ _id: eventId }, { confirmedCount: confirmed, waitlistCount: waitlisted, checkedInCount: checkedIn });
  return { confirmed, waitlisted, checkedIn };
}

module.exports = { eventDto, notify, emitCounts, emitActivity, promoteWaitlist, recountEvent };
