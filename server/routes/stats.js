const router = require('express').Router();
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const auth = require('../middleware/auth');
const { eventDto } = require('../utils/events');
const { CATEGORIES } = require('../utils/helpers');

router.use(auth);

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// Everything the dashboard needs in a single request
router.get('/dashboard', async (req, res) => {
  const me = req.user.id;
  const now = new Date();

  const [myRegs, hosted, upcomingAll, feedRows, users, totalRegs, trending] = await Promise.all([
    Registration.find({ user: me, status: { $in: ['confirmed', 'waitlisted'] } }).populate({ path: 'event', populate: { path: 'organizer', select: 'name' } }).lean(),
    Event.find({ organizer: me }).sort({ startAt: -1 }).populate('organizer', 'name').lean(),
    Event.find({ status: 'published', endAt: { $gte: now } }).select('category').lean(),
    Registration.find({ status: { $in: ['confirmed', 'waitlisted'] } }).sort({ queuedAt: -1 }).limit(12).populate('user', 'name').populate('event', 'title').lean(),
    User.countDocuments(),
    Registration.countDocuments({ status: 'confirmed' }),
    Event.find({ status: 'published', endAt: { $gte: now } }).sort({ confirmedCount: -1, startAt: 1 }).limit(5).populate('organizer', 'name').lean(),
  ]);

  const regs = myRegs.filter((r) => r.event);
  const byEvent = Object.fromEntries(regs.map((r) => [String(r.event._id), r]));

  // my upcoming tickets, soonest first
  const upcoming = regs
    .filter((r) => r.event.status === 'published' && new Date(r.event.endAt) >= now)
    .sort((a, b) => new Date(a.event.startAt) - new Date(b.event.startAt))
    .map((r) => ({ registration: { status: r.status, ticketCode: r.ticketCode }, event: eventDto(r.event, { userId: me, myReg: r }) }));

  // sign-ups per day for events I host (last 14 days)
  const hostedIds = hosted.map((e) => e._id);
  const since = new Date(Date.now() - 13 * 864e5);
  since.setUTCHours(0, 0, 0, 0);
  const hostedRegs = hostedIds.length
    ? await Registration.find({ event: { $in: hostedIds }, status: { $in: ['confirmed', 'waitlisted'] }, queuedAt: { $gte: since } }).select('queuedAt').lean()
    : [];
  const perDay = {};
  hostedRegs.forEach((r) => { perDay[dayKey(r.queuedAt)] = (perDay[dayKey(r.queuedAt)] || 0) + 1; });
  const signups = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(+since + i * 864e5);
    return { date: dayKey(d), count: perDay[dayKey(d)] || 0 };
  });

  const catCount = {};
  upcomingAll.forEach((e) => { catCount[e.category] = (catCount[e.category] || 0) + 1; });

  res.json({
    totals: {
      upcomingTickets: upcoming.length,
      attended: regs.filter((r) => r.checkedIn).length,
      hosting: hosted.filter((e) => e.status === 'published').length,
      audience: hosted.reduce((s, e) => s + e.confirmedCount, 0),
    },
    next: upcoming[0] || null,
    upcoming: upcoming.slice(0, 6),
    hosting: hosted.slice(0, 8).map((e) => eventDto(e, { userId: me })),
    signups,
    categories: CATEGORIES.map((c) => ({ category: c, count: catCount[c] || 0 })).filter((c) => c.count > 0),
    trending: trending.map((e) => eventDto(e, { userId: me, myReg: byEvent[String(e._id)] })),
    feed: feedRows.filter((r) => r.user && r.event).map((r) => ({
      id: String(r._id),
      type: r.status === 'waitlisted' ? 'waitlist' : 'register',
      user: { name: r.user.name },
      event: { _id: r.event._id, title: r.event.title },
      at: r.queuedAt,
    })),
    platform: { users, events: upcomingAll.length, registrations: totalRegs },
  });
});

module.exports = router;
