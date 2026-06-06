// ─── State ─────────────────────────────────────────────────────
const state = {
  socket: null,
  authenticated: false,
  currentRound: null,
  queue: [],
  queueDetails: { current: null, next: null, remaining: [] },
  participants: [],
  leaderboard: [],
  scoresHidden: false,
  actionHistory: [],
  scoreLogs: []
};

// ─── DOM ────────────────────────────────────────────────────────
const loginOverlay = document.getElementById('login-overlay');
const dashboard = document.getElementById('dashboard');
const hostPasswordInput = document.getElementById('host-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const toast = document.getElementById('toast');

// Round panel
const btnStartRound = document.getElementById('btn-start-round');
const btnEndRound = document.getElementById('btn-end-round');
const btnResetRound = document.getElementById('btn-reset-round');
const roundStatusDisplay = document.getElementById('round-status-display');
const roundBadgeSm = document.getElementById('round-badge-sm');
const currentRoundNum = document.getElementById('current-round-num');
const queueSizeMeta = document.getElementById('queue-size');
const roundStartedAt = document.getElementById('round-started-at');
const activityLog = document.getElementById('activity-log');

// Queue panel
const currentName = document.getElementById('current-name');
const nextName = document.getElementById('next-name');
const remainingList = document.getElementById('remaining-list');
const queueCountBadge = document.getElementById('queue-count-badge');
const btnCorrect = document.getElementById('btn-correct');
const btnWrong = document.getElementById('btn-wrong');
const btnPass = document.getElementById('btn-pass');

// Score panel
const scoreParticipantSelect = document.getElementById('score-participant-select');
const customScoreInput = document.getElementById('custom-score-input');
const customReasonInput = document.getElementById('custom-reason-input');
const btnAwardCustom = document.getElementById('btn-award-custom');
const btnDeductCustom = document.getElementById('btn-deduct-custom');
const btnUndo = document.getElementById('btn-undo');
const btnEliminate = document.getElementById('btn-eliminate');
const btnRestore = document.getElementById('btn-restore');
const scoreLogList = document.getElementById('score-log-list');
const scoreLogCount = document.getElementById('score-log-count');

// Participants panel
const participantsList = document.getElementById('participants-list');
const totalParticipantsBadge = document.getElementById('total-participants-badge');

// Leaderboard panel
const leaderboardTbody = document.getElementById('leaderboard-tbody');
const scoresToggle = document.getElementById('scores-toggle');

// Connection
const connIndicator = document.getElementById('conn-indicator');
const connText = document.getElementById('conn-text');

// ─── Socket Init ────────────────────────────────────────────────
function initSocket() {
  state.socket = io();

  state.socket.on('connect', () => {
    setConnected(true);
    if (state.authenticated) {
      state.socket.emit('hostAuth', { secret: localStorage.getItem('hostSecret') });
    }
  });

  state.socket.on('disconnect', () => setConnected(false));

  state.socket.on('hostAuthSuccess', () => {
    state.authenticated = true;
    loginOverlay.classList.add('hidden');
    dashboard.classList.remove('hidden');
    showToast('Authenticated as host ✓', 'success');
    loadInitialData();
  });

  state.socket.on('hostAuthFail', () => {
    loginError.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login as Host';
  });

  state.socket.on('roundStarted', ({ round }) => {
    state.currentRound = round;
    updateRoundUI();
    addActivity(`🚀 Round ${round.roundNumber} started`, 'success');
    showToast(`Round ${round.roundNumber} started!`, 'success');
  });

  state.socket.on('roundEnded', ({ round }) => {
    if (round) state.currentRound = round;
    if (state.currentRound) state.currentRound.status = 'ENDED';
    updateRoundUI();
    addActivity('⏹️ Round ended', 'warning');
  });

  state.socket.on('roundReset', () => {
    addActivity('🔄 Round reset', 'info');
    showToast('Round reset', 'info');
  });

  state.socket.on('queueUpdated', ({ queue, queueDetails }) => {
    state.queue = queue;
    state.queueDetails = queueDetails;
    renderQueue();
    queueSizeMeta.textContent = queue.length;
  });

  state.socket.on('leaderboardUpdated', ({ leaderboard, scoresHidden }) => {
    state.leaderboard = leaderboard;
    state.scoresHidden = scoresHidden;
    renderLeaderboard();
    renderParticipants();
    renderScoreParticipantSelect();
  });

  state.socket.on('participantBuzzed', ({ participant, position }) => {
    addActivity(`🔔 ${participant.firstName} ${participant.lastName} buzzed (#${position})`, 'info');
  });

  state.socket.on('participantEliminated', ({ participant }) => {
    addActivity(`⛔ ${participant.firstName} ${participant.lastName} eliminated`, 'danger');
    showToast(`${participant.firstName} ${participant.lastName} eliminated`, 'error');
  });

  state.socket.on('participantRestored', ({ participant }) => {
    addActivity(`✅ ${participant.firstName} ${participant.lastName} restored`, 'success');
    showToast(`${participant.firstName} ${participant.lastName} restored`, 'success');
  });

  state.socket.on('participantJoined', ({ participant }) => {
    // Add to participants list if not already present
    if (!state.participants.find(p => p._id === participant._id)) {
      state.participants.push(participant);
      renderParticipants();
      renderScoreParticipantSelect();
      totalParticipantsBadge.textContent = `${state.participants.length} registered`;
    }
    addActivity(`👋 ${participant.firstName} ${participant.lastName} joined`, 'info');
  });

  state.socket.on('actionHistoryUpdated', ({ history }) => {
    state.actionHistory = history;
    btnUndo.disabled = history.length === 0;
  });

  state.socket.on('wrongAnswerGiven', () => {
    addActivity('❌ Wrong answer – next in queue promoted', 'danger');
    showToast('Wrong answer given', 'error');
  });

  state.socket.on('scoresVisibilityChanged', ({ hidden }) => {
    state.scoresHidden = hidden;
    scoresToggle.checked = !hidden;
  });

  state.socket.on('error', ({ message }) => {
    showToast('Error: ' + message, 'error');
  });
}

// ─── Login ──────────────────────────────────────────────────────
loginBtn.addEventListener('click', () => {
  const secret = hostPasswordInput.value.trim();
  if (!secret) return;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Verifying…';
  loginError.classList.add('hidden');
  localStorage.setItem('hostSecret', secret);
  state.socket.emit('hostAuth', { secret });
  // Re-enable after 2s if no response
  setTimeout(() => {
    if (!state.authenticated) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login as Host';
    }
  }, 2000);
});

hostPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// ─── Sidebar Navigation ─────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
    btn.classList.add('active');
    const panelId = btn.dataset.panel;
    const panel = document.getElementById(panelId);
    if (panel) { panel.classList.remove('hidden'); panel.classList.add('active'); }
  });
});

// ─── Round Controls ─────────────────────────────────────────────
btnStartRound.addEventListener('click', () => {
  state.socket.emit('startRound');
});

btnEndRound.addEventListener('click', () => {
  if (confirm('End the current round?')) state.socket.emit('endRound');
});

btnResetRound.addEventListener('click', () => {
  if (confirm('Reset the queue for this round? Scores are NOT affected.')) state.socket.emit('resetRound');
});

// ─── Queue Actions ──────────────────────────────────────────────
btnCorrect.addEventListener('click', () => state.socket.emit('correctAnswer'));
btnWrong.addEventListener('click', () => state.socket.emit('wrongAnswer'));
btnPass.addEventListener('click', () => state.socket.emit('passParticipant'));

// ─── Score Actions ──────────────────────────────────────────────
document.querySelectorAll('.btn-score').forEach(btn => {
  btn.addEventListener('click', () => {
    const participantId = scoreParticipantSelect.value;
    if (!participantId) return showToast('Select a participant first', 'warning');
    const points = parseInt(btn.dataset.points);
    state.socket.emit('awardPoints', { participantId, points, reason: `+${points} pts` });
    showToast(`+${points} points awarded`, 'success');
  });
});

btnAwardCustom.addEventListener('click', () => {
  const participantId = scoreParticipantSelect.value;
  const points = parseInt(customScoreInput.value);
  if (!participantId) return showToast('Select a participant first', 'warning');
  if (!points || points <= 0) return showToast('Enter valid points', 'warning');
  const reason = customReasonInput.value.trim() || `+${points} pts`;
  state.socket.emit('awardPoints', { participantId, points, reason });
  customScoreInput.value = '';
  customReasonInput.value = '';
  showToast(`+${points} points awarded`, 'success');
});

btnDeductCustom.addEventListener('click', () => {
  const participantId = scoreParticipantSelect.value;
  const points = parseInt(customScoreInput.value);
  if (!participantId) return showToast('Select a participant first', 'warning');
  if (!points || points <= 0) return showToast('Enter valid points', 'warning');
  const reason = customReasonInput.value.trim() || `-${points} pts`;
  state.socket.emit('deductPoints', { participantId, points, reason });
  customScoreInput.value = '';
  customReasonInput.value = '';
  showToast(`-${points} points deducted`, 'error');
});

btnUndo.addEventListener('click', () => {
  if (confirm('Undo the last score action?')) {
    state.socket.emit('undoLastAction');
    showToast('Last action undone', 'info');
  }
});

btnEliminate.addEventListener('click', () => {
  const participantId = scoreParticipantSelect.value;
  if (!participantId) return showToast('Select a participant first', 'warning');
  if (confirm('Eliminate this participant?')) {
    state.socket.emit('eliminateParticipant', { participantId });
  }
});

btnRestore.addEventListener('click', () => {
  const participantId = scoreParticipantSelect.value;
  if (!participantId) return showToast('Select a participant first', 'warning');
  state.socket.emit('restoreParticipant', { participantId });
});

// ─── Hide/Show Scores Toggle ────────────────────────────────────
scoresToggle.addEventListener('change', () => {
  const hidden = !scoresToggle.checked;
  state.scoresHidden = hidden;
  state.socket.emit('toggleHideScores', { hidden });
  renderLeaderboard();
  showToast(hidden ? 'Scores hidden from audience' : 'Scores visible to audience', 'info');
});

// ─── Load Initial Data ──────────────────────────────────────────
async function loadInitialData() {
  try {
    const [partRes, roundRes, lbRes] = await Promise.all([
      fetch('/api/participants'),
      fetch('/api/rounds/current'),
      fetch('/api/scores/leaderboard')
    ]);
    state.participants = await partRes.json();
    state.currentRound = await roundRes.json();
    state.leaderboard = await lbRes.json();

    renderParticipants();
    renderScoreParticipantSelect();
    renderLeaderboard();
    updateRoundUI();

    totalParticipantsBadge.textContent = `${state.participants.length} registered`;
  } catch (e) {
    showToast('Failed to load data', 'error');
  }
}

// ─── Render Functions ───────────────────────────────────────────
function updateRoundUI() {
  const round = state.currentRound;
  if (!round) {
    roundStatusDisplay.textContent = 'WAITING';
    roundStatusDisplay.className = 'status-pill waiting';
    roundBadgeSm.textContent = 'No Round';
    roundBadgeSm.className = 'status-pill waiting';
    currentRoundNum.textContent = '—';
    roundStartedAt.textContent = '—';
    btnStartRound.disabled = false;
    btnEndRound.disabled = true;
    btnResetRound.disabled = true;
    return;
  }
  const status = round.status || 'WAITING';
  roundStatusDisplay.textContent = status;
  roundStatusDisplay.className = `status-pill ${status.toLowerCase()}`;
  roundBadgeSm.textContent = `Round ${round.roundNumber}`;
  roundBadgeSm.className = `status-pill ${status.toLowerCase()}`;
  currentRoundNum.textContent = round.roundNumber;
  roundStartedAt.textContent = round.startedAt ? new Date(round.startedAt).toLocaleTimeString() : '—';

  const running = status === 'RUNNING';
  btnStartRound.disabled = running;
  btnEndRound.disabled = !running;
  btnResetRound.disabled = !running;
}

function renderQueue() {
  const { current, next, remaining } = state.queueDetails;
  const hasQueue = state.queue.length > 0;

  currentName.textContent = current ? `${current.firstName} ${current.lastName}` : 'No one yet';
  nextName.textContent = next ? `${next.firstName} ${next.lastName}` : '—';

  btnCorrect.disabled = !hasQueue;
  btnWrong.disabled = !hasQueue;
  btnPass.disabled = !hasQueue;

  queueCountBadge.textContent = `${state.queue.length} in queue`;

  if (!remaining || remaining.length === 0) {
    remainingList.innerHTML = '<p class="empty-state">No more in queue</p>';
  } else {
    remainingList.innerHTML = remaining.map((p, i) =>
      `<div class="remaining-item">
        <div class="remaining-pos">${i + 3}</div>
        <span>${p.firstName} ${p.lastName}</span>
      </div>`
    ).join('');
  }
}

function renderLeaderboard() {
  if (!state.leaderboard || state.leaderboard.length === 0) {
    leaderboardTbody.innerHTML = '<tr><td colspan="4" class="empty-state">No data yet…</td></tr>';
    return;
  }
  leaderboardTbody.innerHTML = state.leaderboard.map((p, i) => `
    <tr>
      <td class="rank-cell">${getRankIcon(i + 1)}</td>
      <td>${p.firstName} ${p.lastName}</td>
      <td class="points-cell">${state.scoresHidden ? '—' : p.totalPoints}</td>
      <td><span class="participant-status ${p.status.toLowerCase()}">${p.status}</span></td>
    </tr>
  `).join('');
}

function renderParticipants() {
  const list = state.leaderboard.length > 0 ? state.leaderboard : state.participants;
  if (!list || list.length === 0) {
    participantsList.innerHTML = '<p class="empty-state">No participants yet…</p>';
    return;
  }
  participantsList.innerHTML = list.map(p => `
    <div class="participant-item">
      <div class="participant-info">
        <span class="participant-name">${p.firstName} ${p.lastName}</span>
        <span class="participant-pts">${p.totalPoints} pts</span>
      </div>
      <span class="participant-status ${p.status.toLowerCase()}">${p.status}</span>
    </div>
  `).join('');
  totalParticipantsBadge.textContent = `${list.length} registered`;
}

function renderScoreParticipantSelect() {
  const list = state.leaderboard.length > 0 ? state.leaderboard : state.participants;
  const current = scoreParticipantSelect.value;
  scoreParticipantSelect.innerHTML = '<option value="">— Choose participant —</option>';
  list.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p._id;
    opt.textContent = `${p.firstName} ${p.lastName} (${p.totalPoints} pts)`;
    if (p.status === 'ELIMINATED') opt.textContent += ' ⛔';
    scoreParticipantSelect.appendChild(opt);
  });
  if (current) scoreParticipantSelect.value = current;
}

function getRankIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

// ─── Activity Log ────────────────────────────────────────────────
function addActivity(message, type = 'info') {
  const existing = activityLog.querySelector('.empty-state');
  if (existing) existing.remove();

  const item = document.createElement('div');
  item.className = `activity-item ${type}`;
  item.textContent = `${new Date().toLocaleTimeString()} – ${message}`;
  activityLog.insertBefore(item, activityLog.firstChild);

  // Cap at 50 items
  const items = activityLog.querySelectorAll('.activity-item');
  if (items.length > 50) items[items.length - 1].remove();
}

// ─── Toast ───────────────────────────────────────────────────────
let toastTimeout;
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ─── Connection Status ───────────────────────────────────────────
function setConnected(connected) {
  connIndicator.className = `conn-indicator ${connected ? 'connected' : 'disconnected'}`;
  connText.textContent = connected ? 'Connected' : 'Disconnected';
}

// ─── Init ────────────────────────────────────────────────────────
initSocket();
