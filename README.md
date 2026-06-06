# 🎯 Real-Time Quiz Buzzer System

A fast, reliable, real-time quiz buzzer web application built for live events with up to **200 participants**. Features instant buzz ordering, live queue management, manual scoring, and a public leaderboard display — all powered by Socket.IO.

---

## 🖥️ Screenshots & Screens

| Screen | Purpose |
|---|---|
| `/participant` | Each contestant registers and buzzes in |
| `/host` | Quiz master control panel (protected by password) |
| `/display` | Public leaderboard projected for the audience |

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express.js |
| **Real-time** | Socket.IO |
| **Database** | MongoDB (Atlas or Local) |
| **Frontend** | HTML, CSS, Vanilla JavaScript |
| **Fonts** | Google Fonts – Outfit + Inter |

---

## 📁 Folder Structure

```
project/
├── backend/
│   ├── server.js                  ← Main entry point
│   ├── .env                       ← Environment config
│   ├── package.json
│   ├── models/
│   │   ├── Participant.js
│   │   ├── Round.js
│   │   ├── Buzz.js
│   │   ├── ScoreLog.js
│   │   └── QueueLog.js
│   ├── controllers/
│   │   ├── participantController.js
│   │   ├── roundController.js
│   │   └── scoreController.js
│   ├── routes/
│   │   ├── participants.js
│   │   ├── rounds.js
│   │   └── scores.js
│   └── socket/
│       └── socketHandler.js       ← All real-time logic
└── frontend/
    ├── participant/
    │   ├── index.html
    │   ├── participant.css
    │   └── participant.js
    ├── host/
    │   ├── index.html
    │   ├── host.css
    │   └── host.js
    └── display/
        ├── index.html
        ├── display.css
        └── display.js
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [MongoDB Atlas](https://cloud.mongodb.com) account (free tier works) **or** a local MongoDB installation

---

### 1. Install Dependencies

```bash
cd backend
npm install
```

---

### 2. Configure Environment

Edit `backend/.env`:

```env
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/quizbuzzer?retryWrites=true&w=majority&appName=Cluster0
HOST_SECRET=quiz_host_2024
```

| Variable | Description |
|---|---|
| `PORT` | Port the server runs on (default: 3000) |
| `MONGO_URI` | Your MongoDB Atlas or local connection string |
| `HOST_SECRET` | Password to access the host dashboard |

> **MongoDB Atlas Setup:**
> 1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Create a free M0 cluster
> 2. Add a database user under **Database Access**
> 3. Allow your IP under **Network Access** (use `0.0.0.0/0` for development)
> 4. Click **Connect → Drivers** and copy your connection string

---

### 3. Start the Server

```bash
cd backend
node server.js
```

You should see:
```
✅ MongoDB connected
🚀 Server running at http://localhost:3000
   Participant: http://localhost:3000/participant
   Host:        http://localhost:3000/host
   Display:     http://localhost:3000/display
```

---

## 🎮 How to Run a Quiz Event

### Step 1 — Open All Screens
- **Host**: Open `http://localhost:3000/host` → Enter host password
- **Display**: Open `http://localhost:3000/display` on your projector
- **Participants**: Each contestant opens `http://localhost:3000/participant` on their device

### Step 2 — Participants Register
Each participant enters their **First Name** and **Last Name** and clicks **Join Event**. They'll see a disabled BUZZ button waiting for the round to start.

### Step 3 — Start a Round
Host clicks **Start Round**. All BUZZ buttons activate instantly across all devices.

### Step 4 — Participants Buzz
Participants click BUZZ as fast as they can. The server records the exact server-side timestamp and assigns queue positions:
- 1st to buzz → Position #1 (Current)
- 2nd to buzz → Position #2 (Next)
- And so on…

### Step 5 — Host Actions

| Button | Effect |
|---|---|
| ✅ **Correct** | Ends the round. Host then awards points manually. |
| ❌ **Wrong** | Removes current participant, promotes next in queue |
| ⏭️ **Pass** | Moves current participant to end of queue |
| ⛔ **Eliminate** | Bans participant from buzzing in future rounds |
| ♻️ **Restore** | Re-activates an eliminated participant |

### Step 6 — Award Points
In the **Scores** panel:
- Select a participant from the dropdown
- Click **+5 / +10 / +20 / +50** or enter a custom amount
- Use **Undo Last** to reverse the most recent score change

### Step 7 — Repeat
Click **Start Round** again for the next round. Queue clears automatically; buzz locks reset for all participants.

---

## 🔌 Socket.IO Events Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `buzz` | `{ participantId }` | Participant buzzes in |
| `hostAuth` | `{ secret }` | Host authenticates |
| `startRound` | — | Start a new round |
| `endRound` | — | End current round |
| `resetRound` | — | Clear queue, keep round active |
| `correctAnswer` | — | Mark current participant correct, end round |
| `wrongAnswer` | — | Remove current from queue |
| `passParticipant` | — | Move current to end of queue |
| `awardPoints` | `{ participantId, points, reason }` | Add points |
| `deductPoints` | `{ participantId, points, reason }` | Deduct points |
| `eliminateParticipant` | `{ participantId }` | Eliminate a participant |
| `restoreParticipant` | `{ participantId }` | Restore a participant |
| `undoLastAction` | — | Undo last score change |
| `toggleHideScores` | `{ hidden }` | Show/hide scores on display |

### Server → Clients

| Event | Description |
|---|---|
| `roundStarted` | New round has begun |
| `roundEnded` | Round has finished |
| `roundReset` | Queue cleared |
| `queueUpdated` | Queue order changed |
| `leaderboardUpdated` | Scores changed |
| `participantBuzzed` | Someone buzzed in |
| `participantEliminated` | Participant eliminated |
| `participantRestored` | Participant restored |
| `buzzAccepted` | Your buzz was accepted (sent to participant) |
| `buzzRejected` | Your buzz was rejected (sent to participant) |
| `scoresVisibilityChanged` | Host toggled show/hide scores |

---

## 🗄️ Database Collections

| Collection | Description |
|---|---|
| `participants` | Registered users with name, points, status |
| `rounds` | Round history with status and timestamps |
| `buzzes` | Every buzz event with order and server timestamp |
| `scorelogs` | Every score change (award/deduct) with reason |
| `queuelogs` | Every queue action (BUZZED/PASSED/WRONG/CORRECT/REINSERTED) |

---

## 🔒 Important Rules (Enforced by Server)

1. **Server timestamps only** — client time is never trusted
2. **One buzz per round** — double-buzzing is blocked server-side
3. **Eliminated participants cannot buzz**
4. **Queue actions never affect scores** — only explicit award/deduct events change points
5. **Leaderboard only updates when host changes scores**
6. **Every action is persisted** to MongoDB

---

## 🌐 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/participants` | Register a new participant |
| `GET` | `/api/participants` | Get all participants |
| `GET` | `/api/participants/:id` | Get single participant |
| `GET` | `/api/rounds/current` | Get current/latest round |
| `GET` | `/api/scores/leaderboard` | Get full leaderboard |
| `GET` | `/api/scores/logs` | Get recent score logs |

---

## 🛠️ Development

### Run with auto-restart (nodemon)

```bash
cd backend
npm run dev
```

### Change Host Password

Update `HOST_SECRET` in `backend/.env`:
```env
HOST_SECRET=your_new_secure_password
```

### Change Port

Update `PORT` in `backend/.env`:
```env
PORT=8080
```

---

## 👥 User Types

### 🎤 Host
- Login with password
- Full control: rounds, queue, scores, eliminations

### 🏃 Participant
- Register with name
- Buzz during active rounds
- See their queue position in real-time

### 👀 Audience
- View live leaderboard on the display screen
- No controls, no score editing

---

## 📝 License

MIT License — free to use and modify for your events.

---

> Built with ❤️ for live quiz events. Supports up to **200 simultaneous participants**.
