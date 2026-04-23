const mongoose = require('mongoose');

const ViewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  viewedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for fast lookup of projects viewed by a user in the last 48 hours
ViewSchema.index({ user: 1, viewedAt: -1 });
ViewSchema.index({ project: 1 });

module.exports = mongoose.model('View', ViewSchema);
