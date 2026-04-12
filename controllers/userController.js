const User = require('../models/User');
const Project = require('../models/Project');
const Comment = require('../models/Comment');
const { calculateMatchScore } = require('../utils/matchingEngine');
const { clearCacheByPrefix, clearMultiplePrefixes } = require('../utils/cacheUtils');
const logger = require('../middleware/logger');

// Fetch user profile
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = user.toObject();
    userData.followersCount = await User.countDocuments({ _id: { $in: userData.followers || [] } });
    userData.followingCount = await User.countDocuments({ _id: { $in: userData.following || [] } });

    const projectCount = await Project.countDocuments({ owner: user._id });
    userData.projectCount = projectCount;

    res.status(200).json(userData);
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateUserProfile = async (req, res, next) => {
  try {
    const { fullName, bio, skills, profileImage, portfolio, github, leetcode, codechef, gfg, linkedin } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (skills !== undefined) user.skills = skills;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (portfolio !== undefined) user.portfolio = portfolio;
    if (github !== undefined) user.github = github;
    if (leetcode !== undefined) user.leetcode = leetcode;
    if (codechef !== undefined) user.codechef = codechef;
    if (gfg !== undefined) user.gfg = gfg;
    if (linkedin !== undefined) user.linkedin = linkedin;

    const updatedUser = await user.save();
    await clearCacheByPrefix('profile');
    logger.info(`Profile updated for user: \${user.username}`);

    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.status(200).json(userResponse);
  } catch (error) {
    next(error);
  }
};

// Get user by ID
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userData = user.toObject();
    userData.followersCount = await User.countDocuments({ _id: { $in: userData.followers || [] } });
    userData.followingCount = await User.countDocuments({ _id: { $in: userData.following || [] } });

    const projectCount = await Project.countDocuments({ owner: user._id });
    userData.projectCount = projectCount;

    res.status(200).json(userData);
  } catch (error) {
    next(error);
  }
};

// Get user followers
exports.getFollowers = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const rawCount = (user.followers || []).length;
    await user.populate('followers', 'username fullName profileImage _id');
    const validFollowers = user.followers.filter(f => f != null);
    
    if (validFollowers.length !== rawCount) {
        // Update database to remove ghost IDs
        await User.findByIdAndUpdate(req.params.id, { 
            $set: { followers: validFollowers.map(f => f._id) } 
        });
        await clearCacheByPrefix('profile');
        logger.info(`Sanitized followers list for user: ${req.params.id}. Removed ${rawCount - validFollowers.length} ghost IDs.`);
    }

    res.status(200).json(validFollowers);
  } catch (error) {
    next(error);
  }
};

// Get user following
exports.getFollowing = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const rawCount = (user.following || []).length;
    await user.populate('following', 'username fullName profileImage _id');
    const validFollowing = user.following.filter(f => f != null);
    
    if (validFollowing.length !== rawCount) {
        await User.findByIdAndUpdate(req.params.id, { 
            $set: { following: validFollowing.map(f => f._id) } 
        });
        await clearCacheByPrefix('profile');
        logger.info(`Sanitized following list for user: ${req.params.id}. Removed ${rawCount - validFollowing.length} ghost IDs.`);
    }

    res.status(200).json(validFollowing);
  } catch (error) {
    next(error);
  }
};

// Follow user
exports.followUser = async (req, res, next) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }
    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);
    
    if (!targetUser || !currentUser) return res.status(404).json({ message: 'User not found' });
    
    const targetIdStr = targetUser._id.toString();
    const isFollowing = currentUser.following.some(id => id.toString() === targetIdStr);

    if (!isFollowing) {
      currentUser.following.push(targetUser._id);
      targetUser.followers.push(currentUser._id);
      await currentUser.save();
      await targetUser.save();
      
      // Invalidate relevant caches (Optimized batch clear)
      await clearMultiplePrefixes(['profile', 'user_search']);
      
      logger.info(`User \${req.user.id} followed \${req.params.id}`);
      return res.status(200).json({ 
        message: 'User followed successfully',
        followersCount: targetUser.followers.length,
        followingCount: currentUser.following.length
      });
    } else {
      return res.status(400).json({ message: 'Already following user' });
    }
  } catch (error) {
    next(error);
  }
};

// Unfollow user
exports.unfollowUser = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);
    
    if (!targetUser || !currentUser) return res.status(404).json({ message: 'User not found' });
    
    const targetIdStr = targetUser._id.toString();
    const isFollowing = currentUser.following.some(id => id.toString() === targetIdStr);

    if (isFollowing) {
      await User.findByIdAndUpdate(req.user.id, { $pull: { following: targetUser._id } });
      await User.findByIdAndUpdate(targetUser._id, { $pull: { followers: currentUser._id } });
      
      await clearMultiplePrefixes(['profile', 'user_search']);
      
      logger.info(`User ${req.user.id} unfollowed ${req.params.id}`);
      return res.status(200).json({ 
        message: 'User unfollowed successfully',
        followersCount: targetUser.followers.length - 1, // Approximate or re-fetch for precise
        followingCount: currentUser.following.length - 1
       });
    } else {
      return res.status(400).json({ message: 'Not following user' });
    }
  } catch (error) {
    next(error);
  }
};

// Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Unauthorized: You can only delete your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userProjects = await Project.find({ owner: user._id });
    const projectIds = userProjects.map(p => p._id);

    await User.updateMany(
      {},
      { $pull: { savedProjects: { $in: projectIds }, likedProjects: { $in: projectIds } } }
    );

    await Comment.deleteMany({ project: { $in: projectIds } });
    await Project.deleteMany({ owner: user._id });
    await Comment.deleteMany({ user: user._id });

    await User.updateMany(
      {},
      { $pull: { followers: user._id, following: user._id } }
    );

    await User.findByIdAndDelete(user._id);
    logger.info(`User account deleted: \${user.username}`);

    res.status(200).json({ message: 'User account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Search users
exports.searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json([]);

    const query = {
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } }
      ]
    };

    const users = await User.find(query)
      .select('username fullName profileImage bio followers following')
      .limit(20);

    const usersWithCounts = users.map(user => {
      const u = user.toObject();
      u.followersCount = u.followers ? u.followers.length : 0;
      u.followingCount = u.following ? u.following.length : 0;
      return u;
    });

    res.status(200).json(usersWithCounts);
  } catch (error) {
    next(error);
  }
};

exports.getSuggestedUsers = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ message: 'projectId is required' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
       return res.status(403).json({ message: 'Unauthorized: Only project owner can view suggestions' });
    }

    const users = await User.find({ _id: { $ne: project.owner } })
      .select('username fullName profileImage bio skills followers following');

    const suggestedUsers = users.map(u => {
      const matchData = calculateMatchScore(u, project);
      return {
        ...u.toObject(),
        matchScore: matchData.score,
        matchReasons: matchData.reasons
      };
    });

    suggestedUsers.sort((a, b) => b.matchScore - a.matchScore);
    res.status(200).json(suggestedUsers.slice(0, 20));
  } catch (error) {
    next(error);
  }
};
