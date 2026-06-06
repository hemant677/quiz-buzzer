const mongoose = require('mongoose');

const buzzSchema = new mongoose.Schema({
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
  buzzTime: {
    type: Date,
    required: true
  },
  buzzOrder: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Buzz', buzzSchema);
