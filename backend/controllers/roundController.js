const Round = require('../models/Round');

// Get the current/latest round
const getCurrentRound = async (req, res) => {
  try {
    const round = await Round.findOne().sort({ createdAt: -1 });
    if (!round) return res.json(null);
    res.json(round);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCurrentRound };
