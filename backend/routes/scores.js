const express = require('express');
const router = express.Router();
const { getLeaderboard, getScoreLogs } = require('../controllers/scoreController');

router.get('/leaderboard', getLeaderboard);
router.get('/logs', getScoreLogs);

module.exports = router;
