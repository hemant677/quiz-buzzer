const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'ELIMINATED'],
    default: 'ACTIVE'
  },
  registrationTime: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

participantSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

participantSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Participant', participantSchema);
