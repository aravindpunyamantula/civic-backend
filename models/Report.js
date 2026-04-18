const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: ['SPAM', 'SEXUAL_CONTENT', 'BAD_LANGUAGE', 'OTHER'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'RESOLVED'],
    default: 'PENDING'
  },
  adminAction: {
    type: String,
    enum: ['NONE', 'WARNING', 'SUSPENSION', 'BAN'],
    default: 'NONE'
  }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);
