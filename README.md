---
title: Intellibuzz
emoji: 🎯
colorFrom: gray
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Quiz Buzzer

> A real-time competitive quiz buzzer system built for live events — supporting up to 200 simultaneous participants with instant buzz ordering, live queue management, manual scoring, and a broadcast-quality public display.


---

## Overview

Quiz Buzzer is a full-stack web application that runs entirely on your local network. Three separate browser screens serve three distinct roles: participants buzz in from their phones, the host controls the event from a dashboard, and the audience watches a live leaderboard on a projected display.

All real-time communication runs over Socket.IO. Every buzz is timestamped server-side to guarantee fair ordering. No client time is ever trusted.

---

## Screens

### Participant — `/participant`
Where contestants join and compete.

- Register with first and last name
- Large BUZZ button activates when a round starts
- Shows live queue position after buzzing
- Connection status indicator
- Mobile-first, works on any device

### Host Dashboard — `/host`
The event control center. Password-protected.

- **Round Panel** — Start, end, or reset rounds
- **Queue Panel** — See who's current, next, and remaining. Mark correct, wrong, or pass
- **Score Panel** — Award +5, +10, +20, +50, or a custom amount. Deduct points. Undo the last score action
- **Players Panel** — View all registered participants and their status
- **Standings Panel** — Live leaderboard with show/hide score toggle

### Display — `/display`
A broadcast-quality screen designed for projectors and LED walls.

- Esports tournament overlay aesthetic
- Large "NOW ANSWERING" spotlight with the current player's name
- Live standings board with gold, silver, bronze rank accents
- Animated live ticker at the bottom
- Scores can be hidden by the host in real time

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Server | Express.js |
| Real-time | Socket.IO |
| Database | MongoDB (Atlas or Local) |
| Frontend | HTML · CSS · Vanilla JavaScript |
| Fonts | Space Grotesk · Barlow Condensed · Inter |

---

## Design System

The interface uses a unified premium dark theme across all three screens.

| Token | Value |
|---|---|
| Background | `#0A0A0A` |
| Surface | `#111111` |
| Card | `#171717` |
| Border | `rgba(255,255,255,0.06)` |
| Primary Text | `#FFFFFF` |
| Secondary Text | `#888888` |
| Success | `#22C55E` |
| Warning | `#F59E0B` |
| Danger | `#EF4444` |
| Gold Accent | `#D4AF37` |

Typography uses **Space Grotesk** for headings and UI labels, **Barlow Condensed** for large numbers and broadcast-style display, and **Inter** for body text.

---

## Folder Structure

```
├── backend/
│   ├── server.js                  ← Express + Socket.IO entry point
│   ├── .env                       ← Environment config (not committed)
│   ├── .env.example               ← Config template
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
│       └── socketHandler.js       ← All real-time event logic
└── frontend/
    ├── participant/               ← Contestant screen
    ├── host/                      ← Host control panel
    └── display/                   ← Public broadcast display
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [MongoDB Atlas](https://cloud.mongodb.com) account (free M0 tier works) **or** a local MongoDB installation

### 1 — Install dependencies

```bash
cd backend
npm install
```

### 2 — Configure environment

Copy the example config and fill in your values:

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=3000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/quizbuzzer?retryWrites=true&w=majority&appName=Cluster0
HOST_SECRET=quiz_host_2024
```

**MongoDB Atlas setup:**
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free M0 cluster
2. Add a database user under **Database Access**
3. Allow your IP under **Network Access** (use `0.0.0.0/0` for local development)
4. Click **Connect → Drivers** and copy your connection string

### 3 — Start the server

```bash
cd backend
node server.js
```

Expected output:

```
✅ MongoDB connected
🚀 Server running at http://localhost:3000
   Participant: http://localhost:3000/participant
   Host:        http://localhost:3000/host
   Display:     http://localhost:3000/display
```

---

## Running an Event

**Step 1 — Set up screens**
- Open `/host` on your control device and log in with the host password
- Project `/display` onto a screen for the audience
- Ask participants to open `/participant` on their phones or laptops

**Step 2 — Participants register**
Each person enters their first and last name and joins the event. Their BUZZ button stays disabled until a round begins.

**Step 3 — Start a round**
Host clicks **Start Round**. All BUZZ buttons activate instantly across every connected device.

**Step 4 — Participants buzz**
The server records exact timestamps and assigns queue positions. First to buzz is first in queue.

**Step 5 — Host works through the queue**

| Action | Effect |
|---|---|
| **Correct** | Ends the round. Host awards points manually. |
| **Wrong** | Removes current from queue, promotes next person. |
| **Pass** | Moves current to the end of the queue. |
| **Eliminate** | Bans participant from future rounds. |
| **Restore** | Re-activates an eliminated participant. |

**Step 6 — Award points**
Go to the Scores panel. Select a participant, click a quick award button or enter a custom amount. Undo is available for the last score action.

**Step 7 — Repeat**
Start the next round. The queue clears automatically. Buzz locks reset for all participants.

---

## Socket Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `hostAuth` | `{ secret }` | Authenticate as host |
| `buzz` | `{ participantId }` | Participant buzzes in |
| `startRound` | — | Start a new round |
| `endRound` | — | End current round |
| `resetRound` | — | Clear queue, keep round active |
| `correctAnswer` | — | Mark current participant correct |
| `wrongAnswer` | — | Remove current from queue |
| `passParticipant` | — | Move current to end of queue |
| `awardPoints` | `{ participantId, points, reason }` | Add points |
| `deductPoints` | `{ participantId, points, reason }` | Deduct points |
| `eliminateParticipant` | `{ participantId }` | Eliminate a participant |
| `restoreParticipant` | `{ participantId }` | Restore a participant |
| `undoLastAction` | — | Undo last score change |
| `toggleHideScores` | `{ hidden }` | Toggle score visibility on display |

### Server → Clients

| Event | Description |
|---|---|
| `roundStarted` | A new round has begun |
| `roundEnded` | Round has finished |
| `roundReset` | Queue has been cleared |
| `queueUpdated` | Queue order has changed |
| `leaderboardUpdated` | Scores have changed |
| `participantBuzzed` | Someone buzzed in |
| `participantEliminated` | Participant has been eliminated |
| `participantRestored` | Participant has been restored |
| `buzzAccepted` | Buzz confirmed (sent to participant) |
| `buzzRejected` | Buzz denied (sent to participant) |
| `scoresVisibilityChanged` | Host toggled show/hide scores |

---

## REST API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/participants` | Register a new participant |
| `GET` | `/api/participants` | Get all participants |
| `GET` | `/api/participants/:id` | Get a single participant |
| `GET` | `/api/rounds/current` | Get the current round |
| `GET` | `/api/scores/leaderboard` | Get the full leaderboard |
| `GET` | `/api/scores/logs` | Get recent score logs |

---

## Database Collections

| Collection | Purpose |
|---|---|
| `participants` | Registered users — name, points, status |
| `rounds` | Round history with timestamps and status |
| `buzzes` | Every buzz with server timestamp and order |
| `scorelogs` | Every score change with reason |
| `queuelogs` | Every queue action (BUZZED / PASSED / WRONG / CORRECT / REINSERTED) |

---

## System Rules

These are enforced server-side and cannot be bypassed by clients:

1. All timestamps are set on the server — client time is never used
2. One buzz per participant per round
3. Eliminated participants cannot buzz
4. Queue actions (pass, wrong) never modify total scores
5. Leaderboard only updates when the host explicitly changes points
6. Every action is persisted to MongoDB

---

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `MONGO_URI` | MongoDB connection string | — |
| `HOST_SECRET` | Host dashboard password | `quiz_host_2024` |

---

## Development

Run with auto-restart using nodemon. You can run from the root directory or from the backend folder:

```bash
# Option A: Run from root directory
npm install
npm run dev

# Option B: Run from backend folder
cd backend
npm install
npm run dev
```

---

## Deployment

This project is configured with a root `package.json` for zero-config deployment. Since MongoDB Atlas is cloud-based, you only need to host the Node.js server.

### Option 1 — Railway (Recommended)
1. Sign up at [Railway](https://railway.app) using GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Choose the `intellibuzz` (or `quiz-buzzer`) repository.
4. Click **Variables** and add:
   - `MONGO_URI`: Your MongoDB Atlas URI.
   - `HOST_SECRET`: Your custom password for the host dashboard.
5. Click **Deploy**. Under **Settings**, click **Generate Domain** to get your public URL.

### Option 2 — Render
1. Sign up at [Render](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Keep the default Build & Start Commands (they will run `npm install` and `npm start` at the root automatically).
5. Add the following Environment Variables in the **Environment** tab:
   - `MONGO_URI`: Your MongoDB Atlas connection string.
   - `HOST_SECRET`: Your custom password for the host dashboard.
6. Click **Deploy Web Service**.

### Option 3 — Hugging Face Spaces (Free Docker Hosting)
Since Hugging Face Spaces supports custom Docker environments, you can host Intellibuzz there using our pre-configured `Dockerfile`:

1. Sign up/Log in at [Hugging Face](https://huggingface.co/).
2. Click your profile picture (top right) → **New Space**.
3. Configure the Space:
   - **Space name**: `intellibuzz` (or your choice)
   - **License**: `mit`
   - **SDK**: Select **Docker** 🐳
   - **Docker template**: Select **Blank** (it will read our custom `Dockerfile` automatically)
   - **Space hardware**: **CPU basic** (Free tier)
   - **Visibility**: **Public** (required for participants to connect)
   - Click **Create Space**.
4. Set Environment Secrets:
   - In your new Space, click the **Settings** tab.
   - Scroll to **Variables and secrets**.
   - Under **Secrets**, click **New secret** to add:
     - Name: `MONGO_URI` (your MongoDB Atlas connection string)
     - Name: `HOST_SECRET` (your host dashboard password)
5. Push to Hugging Face Git:
   - In your local command line, run:
     ```bash
     git remote add hf https://huggingface.co/spaces/YOUR_HF_USERNAME/YOUR_SPACE_NAME
     git push -f hf main
     ```
   - Hugging Face will automatically build the Docker image and start the server!

---

## License

MIT — free to use and modify for your events.


