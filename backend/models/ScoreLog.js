const mongoose = require('mongoose');

const scoreLogSchema = new mongoose.Schema({
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  roundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ScoreLog', scoreLogSchema);
