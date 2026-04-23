const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  image: {
    type: String, // URL
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'announcement'],
    default: 'announcement',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  link: {
    type: String,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // Global if null, targeted if set
  },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
