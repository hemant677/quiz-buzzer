const express = require('express');
const router = express.Router();
const { getCurrentRound } = require('../controllers/roundController');

router.get('/current', getCurrentRound);

module.exports = router;
