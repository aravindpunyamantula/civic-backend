const mongoose = require('mongoose');

const BannedIdentifierSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['email', 'rollNumber', 'phone'],
    required: true
  },
  value: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }
}, { timestamps: true });

BannedIdentifierSchema.index({ value: 1 });

module.exports = mongoose.model('BannedIdentifier', BannedIdentifierSchema);
