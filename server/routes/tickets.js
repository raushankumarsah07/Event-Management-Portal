const router = require('express').Router();
const Registration = require('../models/Registration');
const auth = require('../middleware/auth');
const { eventDto } = require('../utils/events');

router.use(auth);

// All my tickets (confirmed and waitlisted), soonest event first
router.get('/mine', async (req, res) => {
  const regs = await Registration.find({ user: req.user.id, status: { $in: ['confirmed', 'waitlisted'] } })
    .populate({ path: 'event', populate: { path: 'organizer', select: 'name' } })
    .lean();

  const rows = await Promise.all(
    regs.filter((r) => r.event).map(async (r) => ({
      _id: r._id,
      status: r.status,
      ticketCode: r.ticketCode,
      checkedIn: r.checkedIn,
      position: r.status === 'waitlisted'
        ? await Registration.countDocuments({ event: r.event._id, status: 'waitlisted', queuedAt: { $lte: r.queuedAt } })
        : null,
      event: eventDto(r.event, { userId: req.user.id, myReg: r }),
    }))
  );
  rows.sort((a, b) => new Date(a.event.startAt) - new Date(b.event.startAt));
  res.json(rows);
});

module.exports = router;
