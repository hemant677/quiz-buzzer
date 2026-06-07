const Participant = require('../models/Participant');
const Round = require('../models/Round');
const Buzz = require('../models/Buzz');
const ScoreLog = require('../models/ScoreLog');
const QueueLog = require('../models/QueueLog');

// ─────────────────────────────────────────────
// In-memory state (for speed & low latency)
// ─────────────────────────────────────────────
let state = {
  currentRound: null,        // Round document
  queue: [],                 // Array of participantId strings (ordered)
  buzzedInRound: new Set(),  // participantIds that have buzzed this round
  buzzCounter: 0,            // monotonic counter for buzz order
  actionHistory: [],         // [{type, data}] for undo support
  scoresHidden: false        // Show/hide scores for display
};

function resetRoundState() {
  state.queue = [];
  state.buzzedInRound = new Set();
  state.buzzCounter = 0;
  state.actionHistory = [];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function getLeaderboard() {
  const participants = await Participant.find()
    .sort({ totalPoints: -1, registrationTime: 1 })
    .select('firstName lastName totalPoints status');
  return participants;
}

async function getQueueDetails() {
  if (state.queue.length === 0) return { current: null, next: null, remaining: [] };
  const ids = state.queue;
  const participants = await Participant.find({ _id: { $in: ids } }).select('firstName lastName totalPoints status');
  const map = {};
  participants.forEach(p => { map[p._id.toString()] = p; });
  const ordered = ids.map(id => map[id]).filter(Boolean);
  return {
    current: ordered[0] || null,
    next: ordered[1] || null,
    remaining: ordered.slice(2)
  };
}

async function broadcastLeaderboard(io, scoresHidden) {
  const lb = await getLeaderboard();
  io.emit('leaderboardUpdated', { leaderboard: lb, scoresHidden: scoresHidden !== undefined ? scoresHidden : state.scoresHidden });
}

async function broadcastQueue(io) {
  const queueDetails = await getQueueDetails();
  io.emit('queueUpdated', { queue: state.queue, queueDetails });
}

// Initialize state from database on startup to prevent desyncs on server restart
async function initializeServerState() {
  try {
    const round = await Round.findOne().sort({ createdAt: -1 });
    if (round) {
      state.currentRound = round;
      if (round.status === 'RUNNING') {
        const buzzes = await Buzz.find({ roundId: round._id }).sort({ buzzOrder: 1 });
        state.queue = buzzes.map(b => b.participantId.toString());
        state.buzzedInRound = new Set(state.queue);
        state.buzzCounter = buzzes.length;
        console.log(`[STATE] Recovered running Round ${round.roundNumber} with ${state.queue.length} in queue.`);
      }
    }
  } catch (err) {
    console.error('[STATE] Error recovering state from DB:', err.message);
  }
}

// ─────────────────────────────────────────────
// Socket Handler
// ─────────────────────────────────────────────
function socketHandler(io) {
  const HOST_SECRET = process.env.HOST_SECRET || 'quiz_host_2024';

  // Automatically initialize state from database
  initializeServerState();

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Connected: ${socket.id}`);

    // Send current state to newly connected client
    (async () => {
      try {
        const lb = await getLeaderboard();
        socket.emit('leaderboardUpdated', { leaderboard: lb, scoresHidden: state.scoresHidden });
        if (state.currentRound) {
          socket.emit('roundStarted', { round: state.currentRound });
          const queueDetails = await getQueueDetails();
          socket.emit('queueUpdated', { queue: state.queue, queueDetails });
        }
      } catch (e) {
        console.error('[SOCKET] Init broadcast error:', e);
      }
    })();

    // ── Host Authentication ──────────────────
    socket.on('hostAuth', ({ secret }) => {
      if (secret === HOST_SECRET) {
        socket.join('host-room');
        socket.emit('hostAuthSuccess', { message: 'Authenticated as host.' });
        console.log(`[HOST] Authenticated: ${socket.id}`);
      } else {
        socket.emit('hostAuthFail', { message: 'Invalid host password.' });
      }
    });

    // ── Join as Display ──────────────────────
    socket.on('joinDisplay', () => {
      socket.join('display-room');
    });

    // ── Register Participant (REST handles DB, socket for real-time) ──
    socket.on('participantRegistered', async ({ participant }) => {
      // Broadcast to host that a new participant joined
      io.to('host-room').emit('participantJoined', { participant });
    });

    // ── START ROUND ──────────────────────────
    socket.on('startRound', async () => {
      if (!isHost(socket)) return;
      try {
        // End any running round first
        if (state.currentRound && state.currentRound.status === 'RUNNING') {
          await Round.findByIdAndUpdate(state.currentRound._id, {
            status: 'ENDED',
            endedAt: new Date()
          });
        }

        const lastRound = await Round.findOne().sort({ roundNumber: -1 });
        const roundNumber = lastRound ? lastRound.roundNumber + 1 : 1;

        const round = new Round({
          roundNumber,
          status: 'RUNNING',
          startedAt: new Date()
        });
        await round.save();

        resetRoundState();
        state.currentRound = round;

        io.emit('roundStarted', { round });
        await broadcastQueue(io);
        console.log(`[ROUND] Started: Round ${roundNumber}`);
      } catch (err) {
        console.error('[ROUND] Start error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // ── END ROUND ───────────────────────────
    socket.on('endRound', async () => {
      if (!isHost(socket)) return;
      try {
        let round = state.currentRound;
        if (!round || round.status !== 'RUNNING') {
          // Self-healing database fallback
          round = await Round.findOne({ status: 'RUNNING' }).sort({ createdAt: -1 });
          if (!round) return socket.emit('error', { message: 'No active round.' });
        }
        await Round.findByIdAndUpdate(round._id, {
          status: 'ENDED',
          endedAt: new Date()
        });
        if (state.currentRound && state.currentRound._id.toString() === round._id.toString()) {
          state.currentRound.status = 'ENDED';
        } else {
          state.currentRound = round;
          state.currentRound.status = 'ENDED';
        }
        io.emit('roundEnded', { round: state.currentRound });
        console.log(`[ROUND] Ended: Round ${state.currentRound.roundNumber}`);
      } catch (err) {
        console.error('[ROUND] End error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // ── RESET ROUND ─────────────────────────
    socket.on('resetRound', async () => {
      if (!isHost(socket)) return;
      try {
        let round = state.currentRound;
        if (!round || round.status !== 'RUNNING') {
          // Self-healing database fallback
          round = await Round.findOne({ status: 'RUNNING' }).sort({ createdAt: -1 });
          if (!round) return socket.emit('error', { message: 'No active round.' });
          state.currentRound = round;
        }
        resetRoundState();
        io.emit('roundReset', { round: state.currentRound });
        await broadcastQueue(io);
        console.log(`[ROUND] Reset: Round ${state.currentRound.roundNumber}`);
      } catch (err) {
        console.error('[ROUND] Reset error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // ── BUZZ ────────────────────────────────
    socket.on('buzz', async ({ participantId }) => {
      try {
        if (!state.currentRound || state.currentRound.status !== 'RUNNING') {
          return socket.emit('buzzRejected', { message: 'Round is not active.' });
        }


        if (state.buzzedInRound.has(participantId)) {
          return socket.emit('buzzRejected', { message: 'You have already buzzed this round.' });
        }

        const participant = await Participant.findById(participantId);
        if (!participant) return socket.emit('buzzRejected', { message: 'Participant not found.' });
        if (participant.status === 'ELIMINATED') {
          return socket.emit('buzzRejected', { message: 'Eliminated participants cannot buzz.' });
        }

        state.buzzCounter++;
        state.buzzedInRound.add(participantId);
        state.queue.push(participantId);

        const buzzTime = new Date();
        const buzz = new Buzz({
          roundId: state.currentRound._id,
          participantId,
          buzzTime,
          buzzOrder: state.buzzCounter
        });
        await buzz.save();

        await QueueLog.create({
          roundId: state.currentRound._id,
          participantId,
          action: 'BUZZED'
        });

        const position = state.queue.length;
        socket.emit('buzzAccepted', { position });

        io.emit('participantBuzzed', {
          participant: { _id: participant._id, firstName: participant.firstName, lastName: participant.lastName },
          position,
          buzzOrder: state.buzzCounter
        });

        await broadcastQueue(io);
        console.log(`[BUZZ] ${participant.firstName} ${participant.lastName} buzzed at position ${position}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── CORRECT ANSWER ──────────────────────
    socket.on('correctAnswer', async () => {
      if (!isHost(socket)) return;
      try {
        if (state.queue.length === 0) return socket.emit('error', { message: 'Queue is empty.' });
        const participantId = state.queue[0];

        await QueueLog.create({
          roundId: state.currentRound._id,
          participantId,
          action: 'CORRECT'
        });

        // End the round
        state.queue = [];
        if (state.currentRound) {
          await Round.findByIdAndUpdate(state.currentRound._id, {
            status: 'ENDED',
            endedAt: new Date()
          });
          state.currentRound.status = 'ENDED';
        }

        io.emit('roundEnded', { round: state.currentRound, reason: 'CORRECT' });
        await broadcastQueue(io);
        await broadcastLeaderboard(io);
        console.log(`[ACTION] Correct answer by participant ${participantId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── WRONG ANSWER ────────────────────────
    socket.on('wrongAnswer', async () => {
      if (!isHost(socket)) return;
      try {
        if (state.queue.length === 0) return socket.emit('error', { message: 'Queue is empty.' });
        const participantId = state.queue.shift();

        await QueueLog.create({
          roundId: state.currentRound._id,
          participantId,
          action: 'WRONG'
        });

        await broadcastQueue(io);
        io.emit('wrongAnswerGiven', { participantId });
        console.log(`[ACTION] Wrong answer by ${participantId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── PASS PARTICIPANT ─────────────────────
    socket.on('passParticipant', async () => {
      if (!isHost(socket)) return;
      try {
        if (state.queue.length === 0) return socket.emit('error', { message: 'Queue is empty.' });
        const participantId = state.queue.shift();
        // Re-add to end of queue
        state.queue.push(participantId);

        await QueueLog.create({
          roundId: state.currentRound._id,
          participantId,
          action: 'PASSED'
        });
        await QueueLog.create({
          roundId: state.currentRound._id,
          participantId,
          action: 'REINSERTED'
        });

        await broadcastQueue(io);
        console.log(`[ACTION] Passed participant ${participantId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── AWARD POINTS ─────────────────────────
    socket.on('awardPoints', async ({ participantId, points, reason }) => {
      if (!isHost(socket)) return;
      try {
        if (!participantId || !points) return socket.emit('error', { message: 'participantId and points required.' });

        const participant = await Participant.findByIdAndUpdate(
          participantId,
          { $inc: { totalPoints: points } },
          { new: true }
        );
        if (!participant) return socket.emit('error', { message: 'Participant not found.' });

        const log = await ScoreLog.create({
          participantId,
          points,
          reason: reason || `+${points} points`,
          roundId: state.currentRound ? state.currentRound._id : null
        });

        state.actionHistory.push({ type: 'SCORE', logId: log._id.toString(), participantId, delta: points });

        await broadcastLeaderboard(io);
        io.to('host-room').emit('actionHistoryUpdated', { history: state.actionHistory });
        console.log(`[SCORE] +${points} to ${participant.firstName} ${participant.lastName}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── DEDUCT POINTS ────────────────────────
    socket.on('deductPoints', async ({ participantId, points, reason }) => {
      if (!isHost(socket)) return;
      try {
        if (!participantId || !points) return socket.emit('error', { message: 'participantId and points required.' });

        const deduction = Math.abs(points);
        const participant = await Participant.findByIdAndUpdate(
          participantId,
          { $inc: { totalPoints: -deduction } },
          { new: true }
        );
        if (!participant) return socket.emit('error', { message: 'Participant not found.' });

        const log = await ScoreLog.create({
          participantId,
          points: -deduction,
          reason: reason || `-${deduction} points`,
          roundId: state.currentRound ? state.currentRound._id : null
        });

        state.actionHistory.push({ type: 'SCORE', logId: log._id.toString(), participantId, delta: -deduction });

        await broadcastLeaderboard(io);
        io.to('host-room').emit('actionHistoryUpdated', { history: state.actionHistory });
        console.log(`[SCORE] -${deduction} to ${participant.firstName} ${participant.lastName}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── UNDO LAST ACTION ─────────────────────
    socket.on('undoLastAction', async () => {
      if (!isHost(socket)) return;
      try {
        if (state.actionHistory.length === 0) {
          return socket.emit('error', { message: 'Nothing to undo.' });
        }

        const last = state.actionHistory.pop();
        if (last.type === 'SCORE') {
          // Reverse the delta
          await Participant.findByIdAndUpdate(last.participantId, { $inc: { totalPoints: -last.delta } });
          await ScoreLog.findByIdAndDelete(last.logId);
        }

        await broadcastLeaderboard(io);
        io.to('host-room').emit('actionHistoryUpdated', { history: state.actionHistory });
        console.log(`[UNDO] Reversed action: ${JSON.stringify(last)}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── ELIMINATE PARTICIPANT ────────────────
    socket.on('eliminateParticipant', async ({ participantId }) => {
      if (!isHost(socket)) return;
      try {
        const participant = await Participant.findByIdAndUpdate(
          participantId,
          { status: 'ELIMINATED' },
          { new: true }
        );
        if (!participant) return socket.emit('error', { message: 'Participant not found.' });

        // Remove from queue if present
        state.queue = state.queue.filter(id => id !== participantId);

        io.emit('participantEliminated', { participant });
        await broadcastQueue(io);
        await broadcastLeaderboard(io);
        console.log(`[ACTION] Eliminated: ${participant.firstName} ${participant.lastName}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── RESTORE PARTICIPANT ──────────────────
    socket.on('restoreParticipant', async ({ participantId }) => {
      if (!isHost(socket)) return;
      try {
        const participant = await Participant.findByIdAndUpdate(
          participantId,
          { status: 'ACTIVE' },
          { new: true }
        );
        if (!participant) return socket.emit('error', { message: 'Participant not found.' });

        io.emit('participantRestored', { participant });
        await broadcastLeaderboard(io);
        console.log(`[ACTION] Restored: ${participant.firstName} ${participant.lastName}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── DELETE PARTICIPANT ───────────────────
    socket.on('deleteParticipant', async ({ participantId }) => {
      if (!isHost(socket)) return;
      try {
        const participant = await Participant.findByIdAndDelete(participantId);
        if (!participant) return socket.emit('error', { message: 'Participant not found.' });

        // Clean up from queue and buzzed list
        state.queue = state.queue.filter(id => id !== participantId);
        state.buzzedInRound.delete(participantId);

        // Delete their related records
        await Promise.all([
          Buzz.deleteMany({ participantId }),
          ScoreLog.deleteMany({ participantId }),
          QueueLog.deleteMany({ participantId })
        ]);

        io.emit('participantDeleted', { participantId });
        await broadcastQueue(io);
        await broadcastLeaderboard(io);
        console.log(`[ACTION] Deleted participant: ${participant.firstName} ${participant.lastName}`);
      } catch (err) {
        console.error('[ACTION] Delete participant error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // ── CLEAR EVENT SESSION ──────────────────
    socket.on('clearEventSession', async () => {
      if (!isHost(socket)) return;
      try {
        // Clear all collections
        await Promise.all([
          Participant.deleteMany({}),
          Round.deleteMany({}),
          Buzz.deleteMany({}),
          ScoreLog.deleteMany({}),
          QueueLog.deleteMany({})
        ]);

        // Reset memory state
        state.currentRound = null;
        resetRoundState();

        io.emit('eventCleared');
        io.emit('roundReset', { round: null });
        await broadcastQueue(io);
        await broadcastLeaderboard(io);
        console.log('[ACTION] Event session cleared by host');
      } catch (err) {
        console.error('[ACTION] Clear event session error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // ── TOGGLE HIDE SCORES ───────────────────
    socket.on('toggleHideScores', ({ hidden }) => {
      if (!isHost(socket)) return;
      state.scoresHidden = hidden;
      io.emit('scoresVisibilityChanged', { hidden });
      console.log(`[HOST] Scores ${hidden ? 'HIDDEN' : 'VISIBLE'}`);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected: ${socket.id}`);
    });
  });

  function isHost(socket) {
    return socket.rooms.has('host-room');
  }
}

module.exports = socketHandler;
