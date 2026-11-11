const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 500 },
  at: { type: Date, default: Date.now },
});

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    category: { type: String, required: true },
    mode: { type: String, enum: ['in-person', 'online'], default: 'in-person' },
    location: { type: String, required: true, trim: true, maxlength: 150 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1, max: 10000 },
    coverImage: { type: String, trim: true, default: '' },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['published', 'cancelled'], default: 'published' },
    announcements: [announcementSchema],

    // Counters are updated with atomic $inc operations so seats can never be oversold
    confirmedCount: { type: Number, default: 0 },
    waitlistCount: { type: Number, default: 0 },
    checkedInCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

eventSchema.index({ startAt: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });

module.exports = mongoose.model('Event', eventSchema);
