const Project = require('../models/Project');
const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { normalizeSkills } = require('../utils/skillUtils');
const { calculateMatchScore } = require('../utils/matchingEngine');
const { clearCacheByPrefix, clearMultiplePrefixes } = require('../utils/cacheUtils');
const { deleteAsset } = require('../utils/cloudinary');
const logger = require('../middleware/logger');

exports.createProject = async (req, res, next) => {
  try {
    const { title, description, technologies, status, isCollaborationOpen, media, githubLink, links, teamMembers, collaborationRoles } = req.body;

    // Strict Validation
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Validation error', error: 'Title is required' });
    }
    if (!description || description.trim() === '') {
      return res.status(400).json({ success: false, message: 'Validation error', error: 'Description is required' });
    }
    const validStatuses = ['IDEA', 'IN_PROGRESS', 'COMPLETED', 'COLLAB'];
    const trimmedStatus = status ? status.toUpperCase().trim() : 'IDEA';

    if (status && !validStatuses.includes(trimmedStatus)) {
      return res.status(400).json({ success: false, message: 'Validation error', error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    if (!technologies || !Array.isArray(technologies) || technologies.length === 0) {
      return res.status(400).json({ success: false, message: 'Validation error', error: 'At least one technology is required' });
    }

    let normalizedTech = normalizeSkills(technologies);

    const newProject = new Project({
      title,
      description,
      technologies: normalizedTech,
      status: trimmedStatus,
      isCollaborationOpen: isCollaborationOpen === true || isCollaborationOpen === 'true',
      media,
      githubLink,
      links: links || [],
      owner: req.user.id,
      teamMembers
    });

    // Auto-add team members with userIds as collaborators
    if (Array.isArray(teamMembers)) {
      teamMembers.forEach(member => {
        if (member.user && !newProject.collaborators.includes(member.user)) {
          newProject.collaborators.push(member.user);
        }
      });
    }

    await newProject.save();
    await clearCacheByPrefix('feed');
    await clearCacheByPrefix('user_projects');
    logger.info(`Project created successfully: ${newProject._id}`);

    // Populate owner before returning
    const populatedProject = await Project.findById(newProject._id)
      .populate('owner', 'username fullName profileImage');

    res.status(201).json(populatedProject);
  } catch (error) {
    next(error);
  }
};

exports.getFeed = async (req, res, next) => {
  try {
    const { type, status, collaborationOpen, ownerId, skills, page = 1, limit = 20, isPassedOut } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};
    if (status) filter.status = status.toUpperCase();
    if (ownerId) filter.owner = ownerId;

    if (skills) {
      const skillsArray = normalizeSkills(skills.split(','));
      if (skillsArray.length > 0) filter.technologies = { $in: skillsArray };
    }
    if (collaborationOpen !== undefined) {
      filter.isCollaborationOpen = collaborationOpen === 'true' || collaborationOpen === true;
    }

    // Exclude own projects from general feed
    if (req.user && req.user.id && !ownerId) {
      filter.owner = { $ne: req.user.id };
    }

    // Get user context: following list and skills/interests
    let followingIds = [];
    let userSkills = [];
    let adminIds = [];

    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id).select('following skills');
      const admins = await User.find({ isAdmin: true }).select('_id');
      if (user) {
        followingIds = (user.following || []).map(id => id.toString());
        userSkills = normalizeSkills(user.skills || []);
      }
      adminIds = admins.map(a => a._id.toString());
    }

    // Build aggregation with three priority tiers:
    //   3 = admin post, 2 = following post, 1 = interest match, 0 = everything else
    const followingObjectIds = followingIds.map(id => {
      try { return new (require('mongoose').Types.ObjectId)(id); } catch(e) { return null; }
    }).filter(Boolean);
    const adminObjectIds = adminIds.map(id => {
      try { return new (require('mongoose').Types.ObjectId)(id); } catch(e) { return null; }
    }).filter(Boolean);

    const shuffle = req.query.shuffle === 'true';

    const pipeline = [
      { $match: filter },
      { $addFields: {
        likesCount: { $size: '$likes' },
        isAdmin: { $cond: [{ $in: ['$owner', adminObjectIds] }, true, false] },
        isFollowed: { $cond: [{ $in: ['$owner', followingObjectIds] }, true, false] },
        isInterest: userSkills.length > 0
          ? { $gt: [{ $size: { $ifNull: [{ $setIntersection: ['$technologies', userSkills] }, []] } }, 0] }
          : { $literal: false },
        randomOrder: { $rand: {} } // For variety/shuffle
      }},
      { $addFields: {
        feedPriority: {
          $switch: {
            branches: [
              { case: { $eq: ['$isAdmin', true] }, then: 3 },
              { case: { $eq: ['$isFollowed', true] }, then: 2 },
              { case: { $eq: ['$isInterest', true] }, then: 1 },
            ],
            default: 0
          }
        }
      }},
      { $addFields: {
        totalPopularity: { $add: ["$likesCount", { $ifNull: ["$viewsCount", 0] }] }
      }}
    ];

    // Handle "Passed Out Students" filter
    if (isPassedOut === 'true' || isPassedOut === true) {
      pipeline.push(
        {
          $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'ownerDetails'
          }
        },
        { $unwind: '$ownerDetails' },
        { 
          $match: {
            'ownerDetails.rollNumber': { $exists: true }
          }
        },
        {
          $addFields: {
            // Extract first 2 digits of rollNumber
            joiningYearShort: { $substr: ['$ownerDetails.rollNumber', 0, 2] }
          }
        },
        {
          $addFields: {
            joiningYear: { $add: [2000, { $toInt: '$joiningYearShort' }] }
          }
        },
        {
          $match: {
            // Joined in 2022 or earlier = Graduated by/in 2026
            joiningYear: { $lte: 2022 } 
          }
        }
      );
    }

    const sortOptions = {};
    if (isPassedOut === 'true' || isPassedOut === true) {
      // Most popular first: high likes and views
      sortOptions.totalPopularity = -1;
      sortOptions.createdAt = -1;
    } else if (shuffle) {
      sortOptions.feedPriority = -1;
      sortOptions.randomOrder = 1;
    } else {
      sortOptions.feedPriority = -1;
      sortOptions.likesCount = -1;
      sortOptions.createdAt = -1;
    }

    pipeline.push(
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    let projects = await Project.aggregate(pipeline);

    await Project.populate(projects, [
      { path: 'owner', select: 'username fullName profileImage isAdmin' },
      { path: 'originProblemId', select: 'title' }
    ]);

    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'username fullName profileImage campus branch')
      .populate('teamMembers.user', 'username fullName profileImage')
      .populate('collaborators', 'username fullName profileImage')
      .populate('originProblemId', 'title description tags createdBy');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    res.status(200).json({ project });
  } catch (error) {
    next(error);
  }
};

exports.getUserProjects = async (req, res, next) => {
  console.log('Fetching projects for user ID:', req.params.userId);
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.params.userId },
        { collaborators: req.params.userId },
        { 'teamMembers.user': req.params.userId }
      ]
    })
      .populate('owner', 'username fullName profileImage')
      .sort({ createdAt: -1 });
    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
};

exports.likeProject = async (req, res, next) => {
  console.log(`User ${req.user.id} is toggling like on project ${req.params.id}`);
  try {
    const project = await Project.findById(req.params.id);
    const user = await User.findById(req.user.id);

    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const isLiked = project.likes.includes(user._id);

    if (isLiked) {
      project.likes.pull(user._id);
      user.likedProjects.pull(project._id);
    } else {
      project.likes.push(user._id);
      user.likedProjects.push(project._id);
    }

    await project.save();
    await user.save();
    
    // Clear relevant caches for real-time consistency (Optimized batch clear)
    await clearMultiplePrefixes(['profile', 'feed', 'user_projects', 'project_detail']);

    res.status(200).json({ message: isLiked ? 'Unliked' : 'Liked', likesCount: project.likes.length });
  } catch (error) {
    next(error);
  }
};

exports.saveProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    const user = await User.findById(req.user.id);

    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const isSaved = project.saves.includes(user._id);

    if (isSaved) {
      project.saves.pull(user._id);
      user.savedProjects.pull(project._id);
    } else {
      project.saves.push(user._id);
      user.savedProjects.push(project._id);
    }

    await project.save();
    await user.save();
    
    // Clear relevant caches (Optimized batch clear)
    await clearMultiplePrefixes(['profile', 'feed', 'user_projects', 'project_detail']);

    res.status(200).json({ message: isSaved ? 'Unsaved' : 'Saved', savesCount: project.saves.length });
  } catch (error) {
    next(error);
  }
};

// Collaboration Requests
exports.requestCollab = async (req, res) => {
  try {
    const { role, message } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() === req.user.id) {
      return res.status(400).json({ message: 'Owner cannot request collaboration' });
    }

    const existingRequest = project.collabRequests.find(r => r.user.toString() === req.user.id && r.status === 'PENDING');
    if (existingRequest) {
      return res.status(400).json({ message: 'Request already pending' });
    }

    project.collabRequests.push({
      user: req.user.id,
      role,
      message
    });

    await project.save();

    // Create Notification
    const userWhoRequested = await User.findById(req.user.id);
    const notification = new Notification({
      recipient: project.owner,
      sender: req.user.id,
      type: 'COLLAB_REQ',
      relatedId: project._id,
      title: 'New Collaboration Request',
      message: `${userWhoRequested.fullName} wants to collaborate on "${project.title}"`
    });
    await notification.save();

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(project.owner.toString()).emit('new_notification', {
        ...notification.toObject(),
        sender: {
          username: userWhoRequested.username,
          fullName: userWhoRequested.fullName,
          profileImage: userWhoRequested.profileImage
        }
      });
    }

    res.status(201).json({ message: 'Collaboration request sent' });
  } catch (error) {
    next(error);
  }
};

exports.getCollabRequests = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('collabRequests.user', 'username fullName profileImage');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only owner can view requests' });
    }

    res.status(200).json(project.collabRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
};

exports.acceptCollabRequest = async (req, res, next) => {
  try {
    const { requestId } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const request = project.collabRequests.id(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    request.status = 'ACCEPTED';
    project.collaborators.push(request.user);

    // Notification for requester
    const notification = new Notification({
      recipient: request.user,
      sender: req.user.id,
      type: 'COLLAB_ACCEPT',
      relatedId: project._id,
      title: 'Collaboration Request Accepted',
      message: `Your request to join ${project.title} has been accepted!`
    });
    await notification.save();

    // Remove the request from the array (User said: "if accept or reject remove it from their")
    project.collabRequests = project.collabRequests.filter(r => r._id.toString() !== requestId);

    await project.save();

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(request.user.toString()).emit('new_notification', notification);
    }

    res.status(200).json({ message: 'Request accepted' });
  } catch (error) {
    next(error);
  }
};

exports.rejectCollabRequest = async (req, res, next) => {
  try {
    const { requestId } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const request = project.collabRequests.id(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    request.status = 'REJECTED';

    // Notification for requester
    const notification = new Notification({
      recipient: request.user,
      sender: req.user.id,
      type: 'COLLAB_REJECT',
      relatedId: project._id,
      title: 'Collaboration Request Update',
      message: `Your collaboration request for "${project.title}" was not accepted at this time.`
    });
    await notification.save();

    // Remove the request from the array
    project.collabRequests = project.collabRequests.filter(r => r._id.toString() !== requestId);

    await project.save();

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(request.user.toString()).emit('new_notification', notification);
    }

    res.status(200).json({ message: 'Request rejected' });
  } catch (error) {
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: Only the owner can update this project' });
    }

    const { title, description, technologies, status, isCollaborationOpen, media, githubLink, links, teamMembers, collaborationRoles } = req.body;

    if (title) project.title = title;
    if (description) project.description = description;
    if (technologies && Array.isArray(technologies)) {
      project.technologies = normalizeSkills(technologies);
    }

    const validStatuses = ['IDEA', 'IN_PROGRESS', 'COMPLETED', 'COLLAB'];
    if (status) {
      const trimmedStatus = status.toUpperCase().trim();
      if (!validStatuses.includes(trimmedStatus)) {
        return res.status(400).json({ success: false, message: 'Validation error', error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      project.status = trimmedStatus;
    }

    if (isCollaborationOpen !== undefined) {
      project.isCollaborationOpen = isCollaborationOpen === true || isCollaborationOpen === 'true';
    }

    if (collaborationRoles && Array.isArray(collaborationRoles)) {
      project.collaborationRoles = normalizeSkills(collaborationRoles);
    }

    if (links && Array.isArray(links)) {
      project.links = links;
    }

    // Update collaborators if team members changed
    if (Array.isArray(teamMembers)) {
      teamMembers.forEach(member => {
        if (member.user && !project.collaborators.includes(member.user)) {
          project.collaborators.push(member.user);
        }
      });
    }

    await project.save();
    
    // Clear all related caches (Optimized batch clear)
    await clearMultiplePrefixes(['feed', 'user_projects', 'project_detail']);

    // Populate owner before returning
    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'username fullName profileImage');

    res.status(200).json(populatedProject);
  } catch (error) {
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: Only the owner can delete this project' });
    }

    // Remove project from all users' savedProjects and likedProjects
    await User.updateMany(
      { $or: [{ savedProjects: project._id }, { likedProjects: project._id }] },
      { $pull: { savedProjects: project._id, likedProjects: project._id } }
    );

    // Delete Cloudinary assets
    if (project.media && project.media.length > 0) {
      for (const m of project.media) {
        if (m.url) {
          const type = m.type === 'video' ? 'video' : 'image';
          deleteAsset(m.url, type).catch(err => logger.error(`Project media deletion failed: ${m.url}`, err));
        }
      }
    }

    // Delete the project
    await Project.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getRecommendedProjects = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    if (!user.skills || user.skills.length === 0) {
      // If no skills, return latest projects as fallback or empty list? 
      // Requirement says "Return projects based on user skills", so I'll return empty list to be strict, 
      // or maybe the user wants some discovery. Let's return empty list for now.
      return res.status(200).json([]);
    }

    const recommendedProjects = await Project.find({
      technologies: { $in: user.skills },
      owner: { $ne: user._id }
    })
      .populate('owner', 'username fullName profileImage')
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json(recommendedProjects);
  } catch (error) {
    next(error);
  }
};

exports.getProjectMatchScore = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    const user = await User.findById(req.user.id);
    if (!project || !user) return res.status(404).json({ message: 'Project or user not found' });

    const matchData = calculateMatchScore(user, project);
    res.status(200).json(matchData);
  } catch (error) {
    next(error);
  }
};

exports.getRecommendedProjectsWithMatchScore = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Fetch collaboration open projects excluding owned ones
    const projects = await Project.find({
      owner: { $ne: user._id },
      isCollaborationOpen: true
    }).populate('owner', 'username fullName profileImage');

    const scoredProjects = projects.map(p => {
      const matchData = calculateMatchScore(user, p);
      return {
        ...p.toObject(),
        matchScore: matchData.score,
        matchReasons: matchData.reasons
      };
    });

    // Sort by score descending
    scoredProjects.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json(scoredProjects);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recommended matches', error: error.message });
  }
};

// addComment removed

exports.getChatHistory = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const isOwner = project.owner.toString() === req.user.id;
    const isCollaborator = project.collaborators.some(c => c.toString() === req.user.id);
    const isTeamMember = project.teamMembers.some(m => m.user?.toString() === req.user.id);

    if (!isOwner && !isCollaborator && !isTeamMember) {
      return res.status(403).json({ message: 'Only owner or collaborators can access chat' });
    }

    const messages = await Message.find({ project: req.params.id })
      .populate('sender', 'username fullName profileImage')
      .populate({
        path: 'repliedTo',
        populate: { path: 'sender', select: 'username fullName' }
      })
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chat history', error: error.message });
  }
};

exports.getUserDiscussions = async (req, res, next) => {
  try {
    // Find projects where the user is either the owner or a collaborator
    const projects = await Project.find({
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id }
      ]
    })
      .populate('owner', 'username fullName profileImage')
      .populate('collaborators', 'username fullName profileImage')
      .sort({ updatedAt: -1 });

    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching discussions', error: error.message });
  }
};

exports.removeCollaborator = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Only owner can remove collaborators
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: Only the owner can remove members' });
    }

    // Cannot remove owner
    if (userId === project.owner.toString()) {
      return res.status(400).json({ message: 'Cannot remove the owner' });
    }

    project.collaborators = project.collaborators.filter(c => c.toString() !== userId);
    project.teamMembers = project.teamMembers.filter(m => !(m.user && m.user.toString() === userId));

    // Also update collabRequests if needed
    await project.save();

    res.status(200).json({ message: 'Collaborator removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing collaborator', error: error.message });
  }
};

exports.addCollaborator = async (req, res) => {
  try {
    const { id } = req.params;
    const { query } = req.body; // username or email

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: Only the owner can manage members' });
    }

    const userToAdd = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${query}$`, 'i') } },
        { email: { $regex: new RegExp(`^${query}$`, 'i') } }
      ]
    });

    if (!userToAdd) return res.status(404).json({ message: 'User not found' });

    if (project.collaborators.includes(userToAdd._id)) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    project.collaborators.push(userToAdd._id);
    
    // Add to teamMembers crew if not present
    const isInTeam = project.teamMembers.some(m => m.user && m.user.toString() === userToAdd._id.toString());
    if (!isInTeam) {
      project.teamMembers.push({
        user: userToAdd._id,
        name: userToAdd.fullName,
        role: 'Collaborator'
      });
    }

    await project.save();
    
    // Return populated project to update frontend state
    const populated = await Project.findById(id)
      .populate('owner', 'username fullName profileImage')
      .populate('collaborators', 'username fullName profileImage');

    res.status(200).json({ message: 'Member added successfully', project: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error adding member', error: error.message });
  }
};

exports.getSavedProjects = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const projects = await Project.find({
      _id: { $in: user.savedProjects }
    })
      .populate('owner', 'username fullName profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
};

exports.recordView = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Unique view: only add if user hasn't viewed before
    if (!project.views.includes(userId)) {
      project.views.push(userId);
      await project.save();
    }

    res.status(200).json({ views: project.views.length });
  } catch (error) {
    next(error);
  }
};

