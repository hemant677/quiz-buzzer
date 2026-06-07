// ─── State ─────────────────────────────────────────────────────
const appState = {
  socket: null,
  participant: null,
  currentRound: null,
  hasBuzzed: false,
  myPosition: null
};

// ─── DOM References ─────────────────────────────────────────────
const registerScreen = document.getElementById('register-screen');
const buzzerScreen = document.getElementById('buzzer-screen');
const registerForm = document.getElementById('register-form');
const registerBtn = document.getElementById('register-btn');
const registerError = document.getElementById('register-error');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const displayName = document.getElementById('display-name');
const roundDisplay = document.getElementById('round-display');
const roundStatusBadge = document.getElementById('round-status-badge');
const buzzBtn = document.getElementById('buzz-btn');
const buzzRing = document.getElementById('buzz-ring');
const positionCard = document.getElementById('position-card');
const positionText = document.getElementById('position-text');
const positionNumber = document.getElementById('position-number');
const notificationBar = document.getElementById('notification-bar');
const connectionBadge = document.getElementById('connection-badge');
const connectionText = document.getElementById('connection-text');

const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const countdownLabel = document.getElementById('countdown-label');

const catOverlay = document.getElementById('cat-overlay');
const catImg = document.getElementById('cat-img');
const closeCatBtn = document.getElementById('close-cat-btn');

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

if (closeCatBtn) {
  closeCatBtn.addEventListener('click', () => {
    catOverlay.classList.add('hidden');
  });
}

let countdownInterval = null;

// ─── Socket Init ────────────────────────────────────────────────
function initSocket() {
  appState.socket = io();

  appState.socket.on('connect', () => {
    setConnectionStatus(true);
    // Re-join if we already registered
    if (appState.participant) {
      appState.socket.emit('participantRegistered', { participant: appState.participant });
    }
  });

  appState.socket.on('disconnect', () => setConnectionStatus(false));

  appState.socket.on('roundStarted', ({ round }) => {
    appState.currentRound = round;
    appState.hasBuzzed = false;
    updateRoundUI(round);
    hidePositionCard();
    buzzRing.classList.remove('active');
    
    // Clear any previous countdowns
    if (countdownInterval) clearInterval(countdownInterval);
    countdownOverlay.classList.add('hidden');
    catOverlay.classList.add('hidden'); // Hide cat overlay on new round

    enableBuzz();
    showNotification('🚀 Round ' + round.roundNumber + ' has started! Get ready to BUZZ!', 'success');
  });

  appState.socket.on('roundEnded', ({ round }) => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    countdownOverlay.classList.add('hidden');

    appState.currentRound = round || appState.currentRound;
    if (appState.currentRound) appState.currentRound.status = 'ENDED';
    disableBuzz();
    buzzRing.classList.remove('active');
    updateRoundBadge('ENDED');
    showNotification('⏹️ Round has ended.', 'warning');
    
    // Show cat image overlay when round ends
    showRandomCatImage();
  });

  appState.socket.on('roundReset', () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    countdownOverlay.classList.add('hidden');
    catOverlay.classList.add('hidden'); // Hide cat overlay on reset

    appState.hasBuzzed = false;
    hidePositionCard();
    enableBuzz();
    buzzRing.classList.remove('active');
    showNotification('🔄 Round has been reset. You can buzz again!', 'info');
  });

  appState.socket.on('buzzAccepted', ({ position }) => {
    appState.myPosition = position;
    showPositionCard(position);
    buzzRing.classList.add('active');
    buzzBtn.disabled = true;
    showNotification(`✅ Buzzed! You are #${position} in queue.`, 'success');
  });

  appState.socket.on('buzzRejected', ({ message }) => {
    showNotification('❌ ' + message, 'danger');
  });

  appState.socket.on('queueUpdated', ({ queue }) => {
    if (appState.participant && appState.hasBuzzed) {
      const pos = queue.indexOf(appState.participant._id.toString()) + 1;
      if (pos > 0) {
        appState.myPosition = pos;
        updatePositionDisplay(pos);
      } else {
        // We've been removed from queue
        hidePositionCard();
        buzzRing.classList.remove('active');
        showNotification('You have been removed from the queue.', 'warning');
      }
    }
  });

  appState.socket.on('participantEliminated', ({ participant }) => {
    if (appState.participant && participant._id === appState.participant._id) {
      disableBuzz();
      showNotification('⛔ You have been eliminated from this event.', 'danger');
    }
  });

  appState.socket.on('participantRestored', ({ participant }) => {
    if (appState.participant && participant._id === appState.participant._id) {
      appState.participant.status = 'ACTIVE';
      if (appState.currentRound && appState.currentRound.status === 'RUNNING' && !appState.hasBuzzed) {
        enableBuzz();
      }
      showNotification('✅ You have been restored to the event!', 'success');
    }
  });

  appState.socket.on('participantDeleted', ({ participantId }) => {
    if (appState.participant && appState.participant._id === participantId) {
      appState.participant = null;
      appState.hasBuzzed = false;
      appState.myPosition = null;
      hidePositionCard();
      buzzRing.classList.remove('active');
      
      // Kick back to registration
      buzzerScreen.classList.remove('active');
      buzzerScreen.classList.add('hidden');
      registerScreen.classList.remove('hidden');
      registerScreen.classList.add('active');
      registerBtn.disabled = false;
      registerBtn.querySelector('span').textContent = 'Join Event';
      showNotification('⚠️ Your registration was removed by the host.', 'warning');
    }
  });

  appState.socket.on('eventCleared', () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    countdownOverlay.classList.add('hidden');
    catOverlay.classList.add('hidden'); // Hide cat overlay

    appState.participant = null;
    appState.hasBuzzed = false;
    appState.myPosition = null;
    hidePositionCard();
    buzzRing.classList.remove('active');
    
    // Kick back to registration
    buzzerScreen.classList.remove('active');
    buzzerScreen.classList.add('hidden');
    registerScreen.classList.remove('hidden');
    registerScreen.classList.add('active');
    registerBtn.disabled = false;
    registerBtn.querySelector('span').textContent = 'Join Event';
    showNotification('🔄 The event session was reset by the host.', 'info');
  });

  appState.socket.on('error', ({ message }) => {
    showNotification('⚠️ ' + message, 'danger');
  });
}

// ─── Registration ───────────────────────────────────────────────
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  if (!firstName || !lastName) return;

  registerBtn.disabled = true;
  registerBtn.querySelector('span').textContent = 'Joining…';
  registerError.classList.add('hidden');

  try {
    const res = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    appState.participant = data;
    appState.socket.emit('participantRegistered', { participant: data });

    displayName.textContent = `${data.firstName} ${data.lastName}`;
    showBuzzerScreen();
    loadCurrentRound();
  } catch (err) {
    registerError.textContent = err.message;
    registerError.classList.remove('hidden');
    registerBtn.disabled = false;
    registerBtn.querySelector('span').textContent = 'Join Event';
  }
});

// ─── Load current round on join ────────────────────────────────
async function loadCurrentRound() {
  try {
    const res = await fetch('/api/rounds/current');
    const round = await res.json();
    if (round) {
      appState.currentRound = round;
      updateRoundUI(round);
      if (round.status === 'RUNNING') enableBuzz();
    } else {
      roundDisplay.textContent = '—';
      roundStatusBadge.textContent = 'Waiting';
      roundStatusBadge.className = 'badge waiting';
    }
  } catch (e) { /* ignore */ }
}

// ─── Buzz Action ────────────────────────────────────────────────
buzzBtn.addEventListener('click', () => {
  if (!appState.participant || appState.hasBuzzed || buzzBtn.disabled) return;
  appState.hasBuzzed = true;
  disableBuzz();
  appState.socket.emit('buzz', { participantId: appState.participant._id });
});

// ─── UI Helpers ────────────────────────────────────────────────
function showBuzzerScreen() {
  registerScreen.classList.remove('active');
  registerScreen.classList.add('hidden');
  buzzerScreen.classList.remove('hidden');
  buzzerScreen.classList.add('active');
}

function enableBuzz() {
  if (appState.participant && appState.participant.status !== 'ELIMINATED' && !appState.hasBuzzed) {
    buzzBtn.disabled = false;
  }
}

function disableBuzz() {
  buzzBtn.disabled = true;
}

function updateRoundUI(round) {
  roundDisplay.textContent = `Round ${round.roundNumber}`;
  updateRoundBadge(round.status);
}

function updateRoundBadge(status) {
  roundStatusBadge.textContent = status;
  roundStatusBadge.className = 'badge ' + status.toLowerCase();
}

function showPositionCard(position) {
  positionCard.classList.remove('hidden');
  updatePositionDisplay(position);
}

function updatePositionDisplay(position) {
  positionNumber.textContent = `#${position}`;
  positionText.textContent = position === 1 ? 'You are CURRENT!' : `You are in the queue`;
  positionNumber.style.color = position === 1 ? '#00e676' : '#00d4ff';
}

function hidePositionCard() {
  positionCard.classList.add('hidden');
}

let notifTimeout;
function showNotification(message, type = 'info') {
  notificationBar.textContent = message;
  notificationBar.className = `notification-bar ${type}`;
  notificationBar.classList.remove('hidden');
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => {
    notificationBar.classList.add('hidden');
  }, 5000);
}

function setConnectionStatus(connected) {
  connectionBadge.className = `connection-badge ${connected ? 'connected' : 'disconnected'}`;
  connectionText.textContent = connected ? 'Connected' : 'Disconnected';
}

// ─── Init ───────────────────────────────────────────────────────
initSocket();
