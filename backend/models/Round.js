const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  roundNumber: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['WAITING', 'RUNNING', 'ENDED'],
    default: 'WAITING'
  },
  startedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Round', roundSchema);
