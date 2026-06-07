require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const participantRoutes = require('./routes/participants');
const roundRoutes = require('./routes/rounds');
const scoreRoutes = require('./routes/scores');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ─── Middleware ───────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Serve Frontend Static Files ─────────────
app.use('/home', express.static(path.join(__dirname, '../frontend/home')));
app.use('/participant', express.static(path.join(__dirname, '../frontend/participant')));
app.use('/host', express.static(path.join(__dirname, '../frontend/host')));
app.use('/display', express.static(path.join(__dirname, '../frontend/display')));
app.use('/public', express.static(path.join(__dirname, '../frontend/public')));

// ─── REST Routes ─────────────────────────────
app.use('/api/participants', participantRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/scores', scoreRoutes);

// ─── Config endpoint (for frontend to get HOST_SECRET hint) ──
app.get('/api/config', (req, res) => {
  res.json({ hostSecretHint: 'Ask your administrator for the host password.' });
});

// ─── Root redirect ─────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/home/index.html'));
});

// ─── Socket.IO ────────────────────────────────
socketHandler(io);

// ─── MongoDB + Start ─────────────────────────
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/quizbuzzer';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`   Participant: http://localhost:${PORT}/participant`);
      console.log(`   Host:        http://localhost:${PORT}/host`);
      console.log(`   Display:     http://localhost:${PORT}/display`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
