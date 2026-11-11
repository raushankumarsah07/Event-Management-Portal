const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['confirmed', 'waitlisted', 'cancelled'], required: true },
    ticketCode: { type: String, required: true, unique: true }, // shown as a QR code on the ticket
    queuedAt: { type: Date, default: Date.now }, // waitlist order: first come, first served
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

registrationSchema.index({ event: 1, user: 1 }, { unique: true }); // one registration per person per event
registrationSchema.index({ event: 1, status: 1, queuedAt: 1 });
registrationSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Registration', registrationSchema);
