const crypto = require('crypto');

// trims and limits user text; non-strings become ''
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const CATEGORIES = ['Tech', 'Music', 'Business', 'Sports', 'Arts', 'Food', 'Education', 'Social'];
const MODES = ['in-person', 'online'];

// ticket codes like "EVT-7K2M9Q" (no confusing characters such as 0/O or 1/I)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genTicketCode = () => 'EVT-' + [...crypto.randomBytes(6)].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

// Validates event data coming from the create/edit form
function cleanEvent(b, { creating }) {
  const title = str(b.title, 100);
  if (title.length < 3) return { error: 'Title must be at least 3 characters.' };
  if (!CATEGORIES.includes(b.category)) return { error: 'Choose a category.' };
  if (!MODES.includes(b.mode)) return { error: 'Choose in-person or online.' };
  const location = str(b.location, 150);
  if (!location) return { error: b.mode === 'online' ? 'Add the meeting link or platform.' : 'Add the venue or address.' };

  const startAt = new Date(b.startAt);
  const endAt = new Date(b.endAt);
  if (isNaN(startAt) || isNaN(endAt)) return { error: 'Enter a valid start and end time.' };
  if (endAt <= startAt) return { error: 'The event must end after it starts.' };
  if (endAt - startAt > 14 * 864e5) return { error: 'An event can last at most 14 days.' };
  if (creating && startAt < new Date(Date.now() - 60 * 1000)) return { error: 'The start time must be in the future.' };

  const capacity = parseInt(b.capacity, 10);
  if (!(capacity >= 1 && capacity <= 10000)) return { error: 'Capacity must be between 1 and 10,000.' };

  const coverImage = str(b.coverImage, 500);
  if (coverImage && !/^https?:\/\//i.test(coverImage)) return { error: 'Cover image must be a link starting with http:// or https://' };

  return { data: { title, description: str(b.description, 2000), category: b.category, mode: b.mode, location, startAt, endAt, capacity, coverImage } };
}

module.exports = { str, cleanEvent, genTicketCode, CATEGORIES, MODES };
