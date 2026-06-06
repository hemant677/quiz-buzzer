const express = require('express');
const router = express.Router();
const { registerParticipant, getAllParticipants, getParticipant } = require('../controllers/participantController');

router.post('/', registerParticipant);
router.get('/', getAllParticipants);
router.get('/:id', getParticipant);

module.exports = router;
