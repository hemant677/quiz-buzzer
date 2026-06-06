const mongoose = require('mongoose');

const queueLogSchema = new mongoose.Schema({
  roundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round',
    required: true
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  action: {
    type: String,
    enum: ['BUZZED', 'PASSED', 'WRONG', 'CORRECT', 'REINSERTED'],
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('QueueLog', queueLogSchema);
