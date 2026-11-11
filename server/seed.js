// Fills the database with demo data:  npm run seed
// Demo login: demo@eventra.com / password123  (the other people use the same password)
// Dates are relative to "now", so the demo always has upcoming, ongoing-soon and past events.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
const Event = require('./models/Event');
const Registration = require('./models/Registration');
const Notification = require('./models/Notification');
const { genTicketCode } = require('./utils/helpers');
const { recountEvent } = require('./utils/events');

const NAMES = ['Demo Organizer', 'Aarav Sharma', 'Priya Nair', 'Rohan Mehta', 'Sneha Patel', 'Kabir Singh', 'Meera Joshi', 'Arjun Rao', 'Nisha Verma', 'Dev Malhotra'];
const EMAILS = ['demo@eventra.com', 'aarav@eventra.com', 'priya@eventra.com', 'rohan@eventra.com', 'sneha@eventra.com', 'kabir@eventra.com', 'meera@eventra.com', 'arjun@eventra.com', 'nisha@eventra.com', 'dev@eventra.com'];

const H = 36e5;
const D = 864e5;

// startIn: hours from now (negative = already happened). attendees/checkedIn are indexes into NAMES.
const EVENTS = [
  { org: 0, title: 'Hack the Future: 24-Hour Hackathon', category: 'Tech', mode: 'in-person', location: 'Innovation Hub, Kathmandu', startIn: 4 * 24, hours: 24, capacity: 6,
    description: 'Build something amazing in 24 hours. Teams of up to 4, mentors on site, food and snacks included. Bring your laptop and a big idea.', attendees: [1, 2, 3, 4, 5, 6, 7, 8, 9], ann: ['Doors open at 9:00. Please bring a valid ID.', 'Mentors from three local startups have joined.'] },
  { org: 0, title: 'AI & Machine Learning Meetup', category: 'Tech', mode: 'in-person', location: 'TechSpace Co-working, Lalitpur', startIn: 8 * 24 + 3, hours: 3, capacity: 40,
    description: 'Lightning talks on practical AI: from classroom projects to production systems. Networking and pizza afterwards.', attendees: [1, 3, 5, 7, 9] },
  { org: 0, title: 'Career Fair 2026', category: 'Business', mode: 'in-person', location: 'City Convention Centre', startIn: 12 * 24, hours: 8, capacity: 200,
    description: 'Meet 40+ employers, get CV reviews and attend short career talks. Free for students and graduates.', attendees: [2, 4, 6, 8, 1, 3] },
  { org: 0, title: 'React Workshop for Beginners', category: 'Education', mode: 'in-person', location: 'Learning Lab, Room 4', startIn: -6 * 24, hours: 4, capacity: 30,
    description: 'A hands-on introduction to React: components, state and hooks, building a small app together.', attendees: [1, 2, 3, 4, 5, 6, 7], checkedIn: [1, 2, 3, 4, 5] },
  { org: 2, title: 'Jazz Under the Stars', category: 'Music', mode: 'in-person', location: 'Riverside Open-Air Stage', startIn: 15 * 24 + 5, hours: 3, capacity: 120,
    description: 'An evening of live jazz with three local bands. Bring a blanket and enjoy the music under the open sky.', attendees: [0, 1, 3, 4, 6, 8], ann: ['Gates open one hour before the show.'] },
  { org: 2, title: 'Open Mic Night', category: 'Music', mode: 'in-person', location: 'The Daily Grind Café', startIn: 3, hours: 3, capacity: 30,
    description: 'Sing, read poetry or tell a joke. Sign up at the door or just come to cheer on the performers.', attendees: [0, 5, 7, 9] },
  { org: 3, title: 'Street Food Festival', category: 'Food', mode: 'in-person', location: 'Central Park Grounds', startIn: 6 * 24 + 2, hours: 6, capacity: 5,
    description: 'Twenty food trucks, live cooking demos and tasting tickets. Very limited early-access slots.', attendees: [1, 2, 4, 5, 6, 0, 8] },
  { org: 3, title: 'Sunrise Photography Walk', category: 'Arts', mode: 'in-person', location: 'Old Town Heritage Trail', startIn: 9 * 24 - 1, hours: 3, capacity: 15,
    description: 'Learn composition and golden-hour tricks while exploring the old town. Any camera or phone is welcome.', attendees: [2, 5, 7] },
  { org: 4, title: 'Morning Yoga in the Park', category: 'Sports', mode: 'in-person', location: 'Lakeside Park, East Lawn', startIn: 20, hours: 2, capacity: 25,
    description: 'A gentle 90-minute flow for all levels. Bring your own mat and a bottle of water.', attendees: [0, 2, 3, 6, 9] },
  { org: 5, title: 'Marathon Training Kickoff', category: 'Sports', mode: 'online', location: 'Zoom (link sent after registration)', startIn: 18 * 24, hours: 2, capacity: 100,
    description: 'A free online session on building a 12-week marathon plan, nutrition and injury prevention.', attendees: [1, 4, 8] },
  { org: 6, title: 'Design Systems Webinar', category: 'Education', mode: 'online', location: 'Google Meet', startIn: 5 * 24 + 6, hours: 2, capacity: 300,
    description: 'How teams build and maintain design systems that scale, with live Q&A.', attendees: [0, 1, 2, 3, 4, 5, 7, 8], ann: ['Slides and the recording will be shared with everyone who registered.'] },
  { org: 7, title: 'Startup Pitch Night', category: 'Business', mode: 'in-person', location: 'Founders Garage', startIn: -3 * 24, hours: 3, capacity: 50,
    description: 'Eight early-stage founders pitch to a panel of investors. Networking over snacks after the show.', attendees: [0, 1, 2, 3, 5, 6, 8, 9], checkedIn: [0, 1, 2, 3, 5, 6] },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User, Event, Registration, Notification].map((m) => m.deleteMany({})));

  const password = await bcrypt.hash('password123', 12);
  const users = await User.create(NAMES.map((name, i) => ({ name, email: EMAILS[i], password })));

  const now = Date.now();
  let regCount = 0;
  const events = [];

  for (const e of EVENTS) {
    const startAt = new Date(now + e.startIn * H);
    const ev = await Event.create({
      title: e.title, description: e.description, category: e.category, mode: e.mode, location: e.location,
      startAt, endAt: new Date(+startAt + e.hours * H), capacity: e.capacity, organizer: users[e.org]._id,
      announcements: (e.ann || []).map((text, i) => ({ text, at: new Date(now - (i + 1) * 5 * H) })),
    });
    events.push(ev);

    // sign-ups spread over the last two weeks (never after the event started)
    const regs = e.attendees.map((idx, i) => {
      const latest = Math.max(0.1, (now - startAt) / D + 0.1); // days ago: must be at least this for past events
      const daysAgo = Math.max(latest, 13 - i * 1.4 + Math.random() * 0.6);
      return {
        event: ev._id, user: users[idx]._id, ticketCode: genTicketCode(),
        queuedAt: new Date(now - daysAgo * D),
        // the first `capacity` people are confirmed; later ones wait
        status: i < e.capacity ? 'confirmed' : 'waitlisted',
        checkedIn: !!(e.checkedIn && e.checkedIn.includes(idx) && i < e.capacity),
      };
    });
    regs.forEach((r) => { if (r.checkedIn) r.checkedInAt = new Date(+startAt + (5 + Math.random() * 50) * 60 * 1000); });
    await Registration.insertMany(regs);
    regCount += regs.length;
    await recountEvent(ev._id);
  }

  const find = (title) => events.find((x) => x.title === title);
  await Notification.create([
    { user: users[0]._id, type: 'announcement', message: 'New update for “Jazz Under the Stars”: Gates open one hour before the show.', event: find('Jazz Under the Stars')._id, createdAt: new Date(now - 5 * H) },
    { user: users[0]._id, type: 'updated', message: '“Morning Yoga in the Park” was updated. Check the new date and location.', event: find('Morning Yoga in the Park')._id, createdAt: new Date(now - 26 * H) },
    { user: users[0]._id, type: 'announcement', message: 'New update for “Design Systems Webinar”: Slides and the recording will be shared with everyone who registered.', event: find('Design Systems Webinar')._id, createdAt: new Date(now - 2 * H) },
  ]);

  console.log(`Seeded ${users.length} users, ${events.length} events, ${regCount} registrations.`);
  console.log('Log in with demo@eventra.com / password123');
  await mongoose.disconnect();
})();
