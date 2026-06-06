const Participant = require('../models/Participant');
const ScoreLog = require('../models/ScoreLog');

// Get full leaderboard sorted by totalPoints desc
const getLeaderboard = async (req, res) => {
  try {
    const participants = await Participant.find()
      .sort({ totalPoints: -1, registrationTime: 1 })
      .select('firstName lastName totalPoints status');
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get score logs
const getScoreLogs = async (req, res) => {
  try {
    const logs = await ScoreLog.find()
      .populate('participantId', 'firstName lastName')
      .populate('roundId', 'roundNumber')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getLeaderboard, getScoreLogs };
