const mongoose = require('mongoose');
const { normalizeSkills } = require('../utils/skillUtils');

const TeamMemberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  name: { type: String, required: true },
  role: { type: String, required: true }
}, { _id: false });

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  technologies: { type: [String], default: [] },
  status: { 
    type: String, 
    enum: ["IDEA", "IN_PROGRESS", "COMPLETED", "COLLAB"], 
    default: "IDEA" 
  },
  isCollaborationOpen: { type: Boolean, default: false },
  media: [{
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' }
  }],
  githubLink: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teamMembers: { type: [TeamMemberSchema], default: [] },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // user IDs
  saves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // user IDs
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  collabRequests: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    message: String,
    status: { 
      type: String, 
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'], 
      default: 'PENDING' 
    },
    requestedAt: { type: Date, default: Date.now }
  }],
  collaborationRoles: { type: [String], default: [] },
  originProblemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: false }
}, { timestamps: true });

// Pre-save hook to normalize technologies and roles
ProjectSchema.pre('save', function () {
  if (this.isModified('technologies')) {
    this.technologies = normalizeSkills(this.technologies);
  }
  if (this.isModified('collaborationRoles')) {
    this.collaborationRoles = normalizeSkills(this.collaborationRoles);
  }
});

// Efficient querying for lifecycle and collaboration
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ isCollaborationOpen: 1 });
ProjectSchema.index({ technologies: 1 });

module.exports = mongoose.model('Project', ProjectSchema);
