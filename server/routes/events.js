const router = require('express').Router();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { str, cleanEvent, genTicketCode, CATEGORIES, MODES } = require('../utils/helpers');
const { eventDto, notify, emitCounts, emitActivity, promoteWaitlist } = require('../utils/events');

router.use(auth);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ACTIVE = ['confirmed', 'waitlisted'];

async function loadEvent(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Event not found.' });
  const ev = await Event.findById(req.params.id).populate('organizer', 'name');
  if (!ev) return res.status(404).json({ message: 'Event not found.' });
  req.event = ev;
  next();
}

function requireOrganizer(req, res, next) {
  if (String(req.event.organizer._id) !== req.user.id) return res.status(403).json({ message: 'Only the organizer can do this.' });
  next();
}

// ---- Browse & search ----
router.get('/', async (req, res) => {
  const now = new Date();
  const filter = {};
  const scope = req.query.scope;

  if (scope === 'hosting') filter.organizer = req.user.id; // includes cancelled events
  else filter.status = 'published';

  if (scope === 'attending') {
    const ids = await Registration.find({ user: req.user.id, status: { $in: ACTIVE } }).distinct('event');
    filter._id = { $in: ids };
  }

  const when = req.query.when || 'upcoming';
  if (when === 'upcoming') filter.endAt = { $gte: now };
  else if (when === 'past') filter.endAt = { $lt: now };
  else if (when === 'today') { filter.startAt = { $lte: new Date(+now + 864e5) }; filter.endAt = { $gte: now }; }
  else if (when === 'week') { filter.startAt = { $lte: new Date(+now + 7 * 864e5) }; filter.endAt = { $gte: now }; }

  if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (MODES.includes(req.query.mode)) filter.mode = req.query.mode;
  const q = str(req.query.q, 60);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { location: rx }];
  }

  const sortKey = req.query.sort;
  const sort = sortKey === 'popular' ? { confirmedCount: -1, startAt: 1 } : sortKey === 'newest' ? { createdAt: -1 } : { startAt: when === 'past' ? -1 : 1 };

  const events = await Event.find(filter).sort(sort).limit(60).populate('organizer', 'name').lean();
  const regs = await Registration.find({ user: req.user.id, event: { $in: events.map((e) => e._id) }, status: { $in: ACTIVE } }).lean();
  const byEvent = Object.fromEntries(regs.map((r) => [String(r.event), r]));
  res.json(events.map((e) => eventDto(e, { userId: req.user.id, myReg: byEvent[String(e._id)] })));
});

// ---- Calendar: events in a date range ----
router.get('/calendar', async (req, res) => {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (isNaN(from) || isNaN(to) || to - from > 45 * 864e5) return res.status(400).json({ message: 'Choose a valid date range.' });

  const events = await Event.find({ status: 'published', startAt: { $gte: from, $lt: to } }).sort({ startAt: 1 }).limit(300).populate('organizer', 'name').lean();
  const regs = await Registration.find({ user: req.user.id, event: { $in: events.map((e) => e._id) }, status: { $in: ACTIVE } }).lean();
  const byEvent = Object.fromEntries(regs.map((r) => [String(r.event), r]));
  res.json(events.map((e) => eventDto(e, { userId: req.user.id, myReg: byEvent[String(e._id)] })));
});

// ---- Create ----
router.post('/', async (req, res) => {
  const { error, data } = cleanEvent(req.body, { creating: true });
  if (error) return res.status(400).json({ message: error });
  const ev = await Event.create({ ...data, organizer: req.user.id });
  emitActivity(req.app.get('io'), { type: 'event', user: { name: req.user.name }, event: { _id: ev._id, title: ev.title } });
  res.status(201).json({ _id: ev._id });
});

// ---- Event details ----
router.get('/:id', loadEvent, async (req, res) => {
  const ev = req.event.toObject();
  const myReg = await Registration.findOne({ event: ev._id, user: req.user.id, status: { $in: ACTIVE } }).lean();

  let position = null;
  if (myReg && myReg.status === 'waitlisted')
    position = await Registration.countDocuments({ event: ev._id, status: 'waitlisted', queuedAt: { $lte: myReg.queuedAt } });

  res.json({
    ...eventDto(ev, { userId: req.user.id, myReg }),
    announcements: [...ev.announcements].sort((a, b) => b.at - a.at),
    myRegistration: myReg ? { _id: myReg._id, status: myReg.status, ticketCode: myReg.ticketCode, checkedIn: myReg.checkedIn, position } : null,
  });
});

// ---- Edit (organizer) ----
router.put('/:id', loadEvent, requireOrganizer, async (req, res) => {
  const ev = req.event;
  if (ev.status === 'cancelled') return res.status(400).json({ message: 'A cancelled event cannot be edited.' });
  const { error, data } = cleanEvent(req.body, { creating: false });
  if (error) return res.status(400).json({ message: error });
  if (data.capacity < ev.confirmedCount)
    return res.status(400).json({ message: `Capacity can't be lower than the ${ev.confirmedCount} people already confirmed.` });

  const io = req.app.get('io');
  const changedWhenWhere = +data.startAt !== +ev.startAt || +data.endAt !== +ev.endAt || data.location !== ev.location || data.mode !== ev.mode;
  const grew = data.capacity > ev.capacity;
  Object.assign(ev, data);
  await ev.save();

  if (grew) await promoteWaitlist(io, ev);
  if (changedWhenWhere) {
    const regs = await Registration.find({ event: ev._id, status: { $in: ACTIVE } }).select('user').lean();
    await notify(io, regs.map((r) => r.user), { type: 'updated', message: `“${ev.title}” was updated. Check the new date and location.`, event: ev._id });
  }
  io.to(`event:${ev._id}`).emit('event:updated', { eventId: String(ev._id) });
  await emitCounts(io, ev._id);
  res.json({ _id: ev._id });
});

// ---- Cancel the whole event (organizer) ----
router.post('/:id/cancel', loadEvent, requireOrganizer, async (req, res) => {
  const ev = req.event;
  if (ev.status === 'cancelled') return res.status(400).json({ message: 'This event is already cancelled.' });
  ev.status = 'cancelled';
  await ev.save();

  const io = req.app.get('io');
  const regs = await Registration.find({ event: ev._id, status: { $in: ACTIVE } }).select('user').lean();
  await notify(io, regs.map((r) => r.user), { type: 'cancelled', message: `Sorry, “${ev.title}” has been cancelled by the organizer.`, event: ev._id });
  io.to(`event:${ev._id}`).emit('event:updated', { eventId: String(ev._id) });
  io.emit('event:removed', { eventId: String(ev._id) });
  res.json({ message: 'Event cancelled.' });
});

// ---- Delete permanently (organizer) ----
router.delete('/:id', loadEvent, requireOrganizer, async (req, res) => {
  const id = req.event._id;
  await Promise.all([Registration.deleteMany({ event: id }), Notification.deleteMany({ event: id }), Event.deleteOne({ _id: id })]);
  req.app.get('io').emit('event:removed', { eventId: String(id) });
  res.json({ message: 'Event deleted.' });
});

// ---- Register for an event (or join the waitlist when it is full) ----
router.post('/:id/register', loadEvent, async (req, res) => {
  const ev = req.event;
  if (ev.status === 'cancelled') return res.status(400).json({ message: 'This event has been cancelled.' });
  if (ev.endAt < new Date()) return res.status(400).json({ message: 'This event has already ended.' });

  // 1. Claim a registration record. The unique (event, user) index stops double sign-ups, even from two tabs at once.
  let reg = await Registration.findOneAndUpdate(
    { event: ev._id, user: req.user.id, status: 'cancelled' },
    { $set: { status: 'waitlisted', queuedAt: new Date(), checkedIn: false, checkedInAt: null, cancelledAt: null } },
    { new: true }
  );
  if (!reg) {
    try {
      reg = await Registration.create({ event: ev._id, user: req.user.id, status: 'waitlisted', ticketCode: genTicketCode() });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: "You're already registered for this event." });
      throw err;
    }
  }

  // 2. Try to take a seat. This single atomic update is what makes overselling impossible.
  const seat = await Event.findOneAndUpdate(
    { _id: ev._id, $expr: { $lt: ['$confirmedCount', '$capacity'] } },
    { $inc: { confirmedCount: 1 } },
    { new: true }
  );
  if (seat) {
    reg.status = 'confirmed';
    await reg.save();
  } else {
    await Event.updateOne({ _id: ev._id }, { $inc: { waitlistCount: 1 } });
  }

  const io = req.app.get('io');
  await emitCounts(io, ev._id);
  emitActivity(io, { type: seat ? 'register' : 'waitlist', user: { name: req.user.name }, event: { _id: ev._id, title: ev.title } });

  const position = seat ? null : await Registration.countDocuments({ event: ev._id, status: 'waitlisted', queuedAt: { $lte: reg.queuedAt } });
  res.status(201).json({ status: reg.status, ticketCode: reg.ticketCode, position });
});

// ---- Cancel my registration ----
router.delete('/:id/register', loadEvent, async (req, res) => {
  const ev = req.event;
  // returns the registration as it was before cancelling
  const old = await Registration.findOneAndUpdate(
    { event: ev._id, user: req.user.id, status: { $in: ACTIVE } },
    { $set: { status: 'cancelled', cancelledAt: new Date(), checkedIn: false, checkedInAt: null } },
    { new: false }
  );
  if (!old) return res.status(404).json({ message: "You're not registered for this event." });

  const io = req.app.get('io');
  if (old.status === 'confirmed') {
    await Event.updateOne({ _id: ev._id }, { $inc: { confirmedCount: -1, checkedInCount: old.checkedIn ? -1 : 0 } });
    await promoteWaitlist(io, ev); // the next person in line gets the seat
  } else {
    await Event.updateOne({ _id: ev._id }, { $inc: { waitlistCount: -1 } });
  }
  await emitCounts(io, ev._id);
  res.json({ message: 'Registration cancelled.' });
});

// ---- Attendee list (organizer) ----
router.get('/:id/attendees', loadEvent, requireOrganizer, async (req, res) => {
  const regs = await Registration.find({ event: req.event._id, status: { $in: ACTIVE } }).sort({ queuedAt: 1 }).populate('user', 'name email').lean();
  let waitPos = 0;
  const rows = regs.map((r) => ({
    _id: r._id,
    user: r.user,
    status: r.status,
    ticketCode: r.ticketCode,
    checkedIn: r.checkedIn,
    checkedInAt: r.checkedInAt,
    queuedAt: r.queuedAt,
    position: r.status === 'waitlisted' ? ++waitPos : null,
  }));
  res.json(rows);
});

// shared by both check-in routes
async function setCheckedIn(req, reg, value) {
  const changed = await Registration.findOneAndUpdate(
    { _id: reg._id, status: 'confirmed', checkedIn: !value },
    { $set: { checkedIn: value, checkedInAt: value ? new Date() : null } },
    { new: true }
  );
  if (changed) {
    await Event.updateOne({ _id: req.event._id }, { $inc: { checkedInCount: value ? 1 : -1 } });
    const io = req.app.get('io');
    await emitCounts(io, req.event._id);
    if (value) io.to(`manage:${req.event._id}`).emit('checkin:live', { name: reg.user?.name || 'Guest', at: new Date() });
  }
  return !!changed;
}

// ---- Check in / undo check-in for one attendee (organizer) ----
router.put('/:id/attendees/:regId/checkin', loadEvent, requireOrganizer, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.regId)) return res.status(404).json({ message: 'Attendee not found.' });
  const reg = await Registration.findOne({ _id: req.params.regId, event: req.event._id }).populate('user', 'name');
  if (!reg) return res.status(404).json({ message: 'Attendee not found.' });
  if (reg.status !== 'confirmed') return res.status(400).json({ message: 'Only confirmed attendees can be checked in.' });
  const value = req.body.checkedIn !== false;
  await setCheckedIn(req, reg, value);
  res.json({ checkedIn: value });
});

// ---- Check in by ticket code, like scanning a QR code at the door (organizer) ----
router.post('/:id/checkin', loadEvent, requireOrganizer, async (req, res) => {
  const code = str(req.body.ticketCode, 20).toUpperCase();
  const reg = code ? await Registration.findOne({ event: req.event._id, ticketCode: code }).populate('user', 'name email') : null;
  if (!reg) return res.status(404).json({ message: 'No ticket with that code for this event.' });
  if (reg.status === 'cancelled') return res.status(400).json({ message: 'This ticket was cancelled.' });
  if (reg.status === 'waitlisted') return res.status(400).json({ message: `${reg.user.name} is still on the waitlist, not confirmed.` });
  if (reg.checkedIn) return res.status(409).json({ message: `${reg.user.name} is already checked in.`, attendee: { name: reg.user.name } });

  await setCheckedIn(req, reg, true);
  const ev = await Event.findById(req.event._id).select('checkedInCount confirmedCount').lean();
  res.json({ attendee: { name: reg.user.name, email: reg.user.email }, checkedInCount: ev.checkedInCount, confirmedCount: ev.confirmedCount });
});

// ---- Announcements (organizer): pushed live to everyone registered ----
router.post('/:id/announcements', loadEvent, requireOrganizer, async (req, res) => {
  const text = str(req.body.text, 500);
  if (!text) return res.status(400).json({ message: 'Write your announcement first.' });
  const ev = req.event;
  ev.announcements.push({ text });
  await ev.save();
  const announcement = ev.announcements[ev.announcements.length - 1];

  const io = req.app.get('io');
  io.to(`event:${ev._id}`).emit('event:announcement', { eventId: String(ev._id), announcement });
  const regs = await Registration.find({ event: ev._id, status: { $in: ACTIVE } }).select('user').lean();
  await notify(io, regs.map((r) => r.user), { type: 'announcement', message: `New update for “${ev.title}”: ${text.length > 90 ? text.slice(0, 87) + '…' : text}`, event: ev._id });
  res.status(201).json(announcement);
});

// ---- Analytics (organizer) ----
router.get('/:id/analytics', loadEvent, requireOrganizer, async (req, res) => {
  const ev = req.event;
  const regs = await Registration.find({ event: ev._id, status: { $in: ACTIVE } }).select('queuedAt status checkedIn checkedInAt').lean();
  const cancelled = await Registration.countDocuments({ event: ev._id, status: 'cancelled' });

  // sign-ups per day, with a running total
  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const perDay = {};
  regs.forEach((r) => { perDay[dayKey(r.queuedAt)] = (perDay[dayKey(r.queuedAt)] || 0) + 1; });
  const timeline = [];
  if (regs.length) {
    const first = new Date(Math.max(Math.min(...regs.map((r) => +new Date(r.queuedAt))), Date.now() - 30 * 864e5));
    let total = 0;
    for (let d = new Date(dayKey(first)); d <= new Date(); d.setUTCDate(d.getUTCDate() + 1)) {
      const k = dayKey(d);
      total += perDay[k] || 0;
      timeline.push({ date: k, count: perDay[k] || 0, total });
    }
  }

  // check-ins per hour (ISO start of each hour; the browser formats it in the viewer's timezone)
  const perHour = {};
  regs.filter((r) => r.checkedIn && r.checkedInAt).forEach((r) => {
    const h = new Date(r.checkedInAt);
    h.setUTCMinutes(0, 0, 0);
    perHour[h.toISOString()] = (perHour[h.toISOString()] || 0) + 1;
  });

  res.json({
    breakdown: {
      confirmed: regs.filter((r) => r.status === 'confirmed').length,
      waitlisted: regs.filter((r) => r.status === 'waitlisted').length,
      cancelled,
      checkedIn: regs.filter((r) => r.checkedIn).length,
    },
    timeline,
    checkins: Object.entries(perHour).sort().map(([hour, count]) => ({ hour, count })),
  });
});

// ---- Export attendees as CSV (organizer) ----
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // stops spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};
router.get('/:id/export.csv', loadEvent, requireOrganizer, async (req, res) => {
  const regs = await Registration.find({ event: req.event._id, status: { $in: ACTIVE } }).sort({ queuedAt: 1 }).populate('user', 'name email').lean();
  const lines = [['Name', 'Email', 'Status', 'Ticket', 'Checked in', 'Registered at'].map(csvCell).join(',')];
  regs.forEach((r) => lines.push([r.user.name, r.user.email, r.status, r.ticketCode, r.checkedIn ? 'Yes' : 'No', new Date(r.queuedAt).toISOString()].map(csvCell).join(',')));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="attendees.csv"' });
  res.send(lines.join('\n'));
});

module.exports = router;
