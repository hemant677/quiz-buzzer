// ─── State ─────────────────────────────────────────────────────
const state = {
  socket: null,
  currentRound: null,
  queueDetails: { current: null, next: null, remaining: [] },
  leaderboard: [],
  scoresHidden: false
};

// ─── DOM ────────────────────────────────────────────────────────
const roundPill = document.getElementById('round-pill');
const roundStatusBadge = document.getElementById('round-status-badge');
const currentParticipant = document.getElementById('current-participant');
const currentSubtitle = document.getElementById('current-subtitle');
const leaderboardBody = document.getElementById('leaderboard-body');
const scoresHiddenNotice = document.getElementById('scores-hidden-notice');
const tickerContent = document.getElementById('ticker-content');

const catOverlay = document.getElementById('cat-overlay');
const catImg = document.getElementById('cat-img');

const catImages = [
  '/public/cat_1.png',
  '/public/cat_2.jpg',
  '/public/cat_3.jpg',
  '/public/cat_4.jpg',
  '/public/cat_5.png',
  '/public/cat_6.png',
  '/public/cat_7.png',
  '/public/cat_8.jpg'
];
let lastCatIndex = -1;

function showRandomCatImage() {
  if (catImages.length === 0) return;
  let index;
  do {
    index = Math.floor(Math.random() * catImages.length);
  } while (index === lastCatIndex && catImages.length > 1);
  lastCatIndex = index;
  
  catImg.src = catImages[index];
  catOverlay.classList.remove('hidden');
}

// ─── Socket ────────────────────────────────────────────────────
function initSocket() {
  state.socket = io();

  state.socket.on('connect', () => {
    state.socket.emit('joinDisplay');
    setTicker('✅ Connected to server – waiting for event to start…');
    loadCurrentRound();
  });

  state.socket.on('disconnect', () => {
    setTicker('⚠️ Disconnected from server – attempting to reconnect…');
  });

  state.socket.on('roundStarted', ({ round }) => {
    state.currentRound = round;
    updateRoundHeader(round);
    setCurrentParticipant(null);
    setTicker(`🚀 Round ${round.roundNumber} has started! Participants are buzzing in…`);
    catOverlay.classList.add('hidden');
  });

  state.socket.on('roundEnded', ({ round }) => {
    if (round) state.currentRound = round;
    if (state.currentRound) {
      state.currentRound.status = 'ENDED';
      updateRoundHeader(state.currentRound);
    }
    setCurrentParticipant(null, 'Round ended');
    setTicker('⏹️ Round has ended. Waiting for next round…');
    showRandomCatImage();
  });

  state.socket.on('roundReset', () => {
    setCurrentParticipant(null, 'Queue reset – buzzing again soon!');
    setTicker('🔄 Round has been reset. Get ready to buzz!');
    catOverlay.classList.add('hidden');
  });

  state.socket.on('queueUpdated', ({ queueDetails }) => {
    state.queueDetails = queueDetails;
    updateCurrentDisplay();
  });

  state.socket.on('leaderboardUpdated', ({ leaderboard, scoresHidden }) => {
    state.leaderboard = leaderboard;
    state.scoresHidden = scoresHidden;
    renderLeaderboard();
    updateScoresHiddenNotice();
  });

  state.socket.on('participantBuzzed', ({ participant, position }) => {
    setTicker(`🔔 ${participant.firstName} ${participant.lastName} buzzed in at position #${position}!`);
  });

  state.socket.on('participantEliminated', ({ participant }) => {
    setTicker(`⛔ ${participant.firstName} ${participant.lastName} has been eliminated.`);
  });

  state.socket.on('participantRestored', ({ participant }) => {
    setTicker(`✅ ${participant.firstName} ${participant.lastName} has been restored.`);
  });

  state.socket.on('scoresVisibilityChanged', ({ hidden }) => {
    state.scoresHidden = hidden;
    renderLeaderboard();
    updateScoresHiddenNotice();
  });

  state.socket.on('wrongAnswerGiven', () => {
    setTicker('❌ Wrong answer! Next participant is up…');
  });

  state.socket.on('eventCleared', () => {
    state.currentRound = null;
    state.queueDetails = { current: null, next: null, remaining: [] };
    state.leaderboard = [];
    setCurrentParticipant(null);
    roundPill.textContent = 'WAITING FOR ROUND';
    roundStatusBadge.textContent = 'WAITING';
    roundStatusBadge.className = 'status-badge waiting';
    renderLeaderboard();
    catOverlay.classList.add('hidden');
    setTicker('🔄 The event session was reset by the host.');
  });
}

// ─── Load current round on connect ─────────────────────────────
async function loadCurrentRound() {
  try {
    const [roundRes, lbRes] = await Promise.all([
      fetch('/api/rounds/current'),
      fetch('/api/scores/leaderboard')
    ]);
    const round = await roundRes.json();
    const lb = await lbRes.json();

    if (round) {
      state.currentRound = round;
      updateRoundHeader(round);
      if (round.status === 'ENDED') {
        showRandomCatImage();
      } else {
        catOverlay.classList.add('hidden');
      }
    } else {
      catOverlay.classList.add('hidden');
    }
    state.leaderboard = lb;
    renderLeaderboard();
  } catch (e) { /* ignore */ }
}

// ─── Update Header ──────────────────────────────────────────────
function updateRoundHeader(round) {
  roundPill.textContent = `Round ${round.roundNumber}`;
  const status = round.status || 'WAITING';
  roundStatusBadge.textContent = status;
  roundStatusBadge.className = `status-badge ${status.toLowerCase()}`;
}

// ─── Current Participant Display ────────────────────────────────
function updateCurrentDisplay() {
  const { current, next } = state.queueDetails;
  if (current) {
    setCurrentParticipant(current, next ? `Up next: ${next.firstName} ${next.lastName}` : 'Last in queue');
  } else {
    setCurrentParticipant(null);
  }
}

function setCurrentParticipant(participant, subtitle = null) {
  if (participant) {
    currentParticipant.textContent = `${participant.firstName} ${participant.lastName}`;
    currentParticipant.style.animation = 'none';
    requestAnimationFrame(() => {
      currentParticipant.style.animation = '';
    });
    currentSubtitle.textContent = subtitle || 'Answering now…';
    currentSubtitle.style.color = '#00d4ff';
  } else {
    currentParticipant.textContent = '—';
    currentSubtitle.textContent = subtitle || 'Waiting for round to start';
    currentSubtitle.style.color = '';
  }
}

// ─── Leaderboard ────────────────────────────────────────────────
function renderLeaderboard() {
  if (!state.leaderboard || state.leaderboard.length === 0) {
    leaderboardBody.innerHTML = '<div class="waiting-msg">Waiting for participants…</div>';
    return;
  }

  leaderboardBody.innerHTML = state.leaderboard.map((p, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'other';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const rowClass = `lb-row rank-${rank <= 3 ? rank : 'other'}${p.status === 'ELIMINATED' ? ' eliminated' : ''}`;
    const pointsDisplay = state.scoresHidden
      ? `<span class="lb-points hidden-pts">• • •</span>`
      : `<span class="lb-points">${p.totalPoints} pts</span>`;

    return `
      <div class="${rowClass}" style="animation-delay: ${i * 0.05}s">
        <div class="lb-rank ${rankClass}">${rankIcon}</div>
        <div class="lb-name">${p.firstName} ${p.lastName}</div>
        ${pointsDisplay}
      </div>
    `;
  }).join('');
}

// ─── Scores Hidden Notice ────────────────────────────────────────
function updateScoresHiddenNotice() {
  if (state.scoresHidden) {
    scoresHiddenNotice.classList.remove('hidden');
  } else {
    scoresHiddenNotice.classList.add('hidden');
  }
}

// ─── Ticker ──────────────────────────────────────────────────────
let tickerMessages = ['🎯 Welcome to Quiz Buzzer!'];
let tickerIndex = 0;

function setTicker(message) {
  tickerMessages.push(message);
  if (tickerMessages.length > 10) tickerMessages.shift();
  tickerContent.textContent = message;
}

// Rotate ticker every 8 seconds
setInterval(() => {
  if (tickerMessages.length > 1) {
    tickerIndex = (tickerIndex + 1) % tickerMessages.length;
    tickerContent.textContent = tickerMessages[tickerIndex];
  }
}, 8000);

// ─── Init ────────────────────────────────────────────────────────
initSocket();
