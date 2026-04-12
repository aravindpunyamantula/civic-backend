const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { normalizeSkills } = require('../utils/skillUtils');

const JWT_SECRET = process.env.JWT_SECRET;

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  rollNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  campus: {
    type: String,
    required: true,
    enum: ["AUS", "ACET", "ACOE"],
  },
  branch: {
    type: String,
    required: true,
    enum: ["CSE", "IT", "AIML", "AI-DS", "IOT", "ECE", "EEE", "MECH", "CIVIL", "PT-MINING", "CHEMICAL"],
  },
  password: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    default: '',
  },
  skills: {
    type: [String],
    default: [],
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  savedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  likedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  portfolio: { type: String, default: '' },
  github: { type: String, default: '' },
  leetcode: { type: String, default: '' },
  codechef: { type: String, default: '' },
  gfg: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Pre-save hook to hash password before saving to database
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Pre-save hook to normalize skills
UserSchema.pre('save', function () {
  if (this.isModified('skills')) {
    this.skills = normalizeSkills(this.skills);
  }
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to generate Access Token (7 days)
UserSchema.methods.generateAuthToken = function () {
  return jwt.sign({ id: this._id }, JWT_SECRET, { expiresIn: '7d' });
};

// Instance method to generate Refresh Token (30 days)
UserSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ id: this._id }, JWT_SECRET, { expiresIn: '30d' });
};

UserSchema.index({ skills: 1 });

module.exports = mongoose.model('User', UserSchema);
