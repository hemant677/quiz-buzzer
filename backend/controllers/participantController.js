const Participant = require('../models/Participant');

// Register a new participant
const registerParticipant = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required.' });
    }

    const participant = new Participant({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      registrationTime: new Date()
    });

    await participant.save();
    res.status(201).json(participant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all participants
const getAllParticipants = async (req, res) => {
  try {
    const participants = await Participant.find().sort({ registrationTime: 1 });
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single participant
const getParticipant = async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id);
    if (!participant) return res.status(404).json({ error: 'Participant not found.' });
    res.json(participant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { registerParticipant, getAllParticipants, getParticipant };
