const router = require('express').Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: req.user.id, read: false }),
  ]);
  res.json({ items, unread });
});

router.put('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ ok: true });
});

router.put('/:id/read', async (req, res) => {
  if (mongoose.isValidObjectId(req.params.id)) await Notification.updateOne({ _id: req.params.id, user: req.user.id }, { read: true });
  res.json({ ok: true });
});

module.exports = router;
