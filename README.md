# Eventra: Event Management Portal (MERN)

A real-time event platform built with **MongoDB, Express, React (Vite) and Node.js**, plus **Socket.io** for live features.
People can discover and book events, organizers can run them from a live control room, and everything updates instantly on every open screen.

## Highlights
| Feature | What it does |
|---|---|
| **Interactive dashboard** | Animated stats, a ticking countdown to your next event, sign-ups chart, category donut (click a slice to explore), trending events with live seat meters, and a live activity feed |
| **Discover** | Search, category chips, date tabs (upcoming / next 24h / this week / past), online or in-person, sort by date or popularity. Seat meters change live as others book |
| **Smart booking + waitlist** | Free registration with an instant ticket and QR code. When an event is full, people join a waitlist; if someone cancels (or the organizer adds seats), the oldest person in line is confirmed automatically and notified |
| **No overselling** | Seats are claimed with an atomic database update, so even 100 people clicking at the same moment can never exceed capacity. Double-clicking or using two tabs can't register you twice |
| **Organizer console** | Live confirmed / checked-in / waitlist / viewers numbers, check-in desk (type or scan the ticket code), attendee table with search and filters, announcements, analytics charts, CSV export |
| **Live check-in** | Organizers see each check-in appear instantly; the attendance ring and counters update for everyone |
| **Announcements & notifications** | Organizer posts are pushed live to the event page and to every registered person's notification bell. Changes to time/place and cancellations notify attendees too |
| **My tickets** | QR tickets, waitlist position, add to calendar (.ics), cancel |
| **Calendar** | Month view with colour-coded events, rings on the ones you are attending, click a day for details |
| **Live presence** | "N online" in the header and "people viewing" on each event page |
| **Auth & security** | JWT + bcrypt, protected REST and WebSocket connections, Helmet, CORS, rate-limited login, input validation, NoSQL-injection-safe, CSV formula-injection protection |

## Database collections
| Collection | Key fields |
|---|---|
| `users` | name, email, password (hashed) |
| `events` | title, description, category, mode, location, startAt, endAt, capacity, organizer, status, announcements[], confirmedCount, waitlistCount, checkedInCount |
| `registrations` | event, user, status (confirmed / waitlisted / cancelled), ticketCode, queuedAt, checkedIn, checkedInAt. Unique per (event, user) |
| `notifications` | user, type, message, event, read |

## Run locally
Requirements: Node 18+ and MongoDB (local or Atlas).

```bash
# 1) Backend
cd server
npm install
cp .env.example .env        # set MONGO_URI and JWT_SECRET
npm run seed                # demo people, 12 events and registrations
npm run dev                 # http://localhost:5000

# 2) Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Demo logins after seeding (password `password123`): `demo@eventra.com`, `aarav@eventra.com`, `priya@eventra.com`, and more.
The login page also has a **Try the demo account** button.

> `npm run seed` clears the database first. Only run it on a database you are happy to reset.

The demo account hosts 4 events, holds several tickets, is on the waitlist for a full event, and has 3 unread notifications.

## Demo script for judges (about 5 minutes)
1. **Dashboard:** log in as the demo user. Show the countdown, the animated stats, hover the charts, click a donut slice to jump to that category.
2. **Live booking:** open the demo user in one window on **Discover**, and a second account in a private window. Register in the second window and watch the first window's seat meter and activity feed move by themselves.
3. **Waitlist:** open "Hack the Future" (full, 6/6). Register another account: it joins the waitlist. Cancel a confirmed ticket from another account and watch the waitlisted person get a notification and a seat.
4. **Organizer console:** as the demo user open **Manage** on "Hack the Future". Use the Attendees tab to check someone in by typing their ticket code (copy it from their *My tickets* page) and watch the live counters.
5. **Announcement:** post an announcement and show it arriving live on the other window and in the bell.
6. **Create an event:** use the form, with its live preview, and show it appear on Discover and the Calendar.

## How the real-time part works
- One Socket.io connection per logged-in user (JWT verified on connect).
- Every booking, cancellation or check-in updates the event's counters with atomic `$inc` operations, then the server emits `event:counts` to everyone, so cards, meters and dashboards update without refreshing.
- Event pages join a room (`event:<id>`) for announcements, changes and the viewers count. Organizers also join `manage:<id>` for the live check-in feed.
- Personal notifications go to a private room (`user:<id>`).

## REST API
All routes except register/login need `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Auth |
| GET | `/api/auth/me` | Current user |
| GET / POST | `/api/events` | Browse (q, category, when, mode, sort, scope) / create |
| GET | `/api/events/calendar?from&to` | Events in a date range |
| GET / PUT / DELETE | `/api/events/:id` | Details / edit / delete (organizer) |
| POST | `/api/events/:id/cancel` | Cancel an event and notify attendees |
| POST / DELETE | `/api/events/:id/register` | Register or join waitlist / cancel my registration |
| GET | `/api/events/:id/attendees` | Attendee list (organizer) |
| POST | `/api/events/:id/checkin` | Check in by ticket code (organizer) |
| PUT | `/api/events/:id/attendees/:regId/checkin` | Check in / undo (organizer) |
| POST | `/api/events/:id/announcements` | Send an announcement (organizer) |
| GET | `/api/events/:id/analytics`, `/api/events/:id/export.csv` | Charts data / CSV (organizer) |
| GET | `/api/tickets/mine` | My tickets |
| GET | `/api/stats/dashboard` | All dashboard data in one request |
| GET / PUT | `/api/notifications`, `/api/notifications/read-all`, `/api/notifications/:id/read` | Notifications |

## Socket events
Server to client: `presence`, `activity`, `event:counts`, `event:viewers`, `event:announcement`, `event:updated`, `event:removed`, `checkin:live`, `notification`.
Client to server: `event:join`, `event:leave`, `manage:join`, `manage:leave`.

## Deploying (Render)
- **Backend** (Web Service): Root Directory `server`, Build `npm install`, Start `npm start`. Environment: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (your frontend address, exactly).
- **Frontend** (Static Site): Root Directory `client`, Build `npm install && npm run build`, Publish `dist`. Environment: `VITE_API_URL` (your backend address, no trailing slash). `public/_redirects` and `vercel.json` already handle page refreshes on Render/Netlify and Vercel.
- Free hosts may sleep, so open the site once before a demo.

## Folder structure
```
server/  config/ models/ middleware/ routes/ utils/ socket.js server.js seed.js
client/  src/{pages, components, hooks, context, utils.js, api.js}
```
