const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const BannedIdentifier = require('../models/BannedIdentifier');
const Problem = require('../models/Problem');
const FeedbackForm = require('../models/FeedbackForm');
const FeedbackResponse = require('../models/FeedbackResponse');
const Announcement = require('../models/Announcement');
const rankingService = require('../utils/rankingService');

// @desc    Get all users with pagination
// @route   GET /api/admin/users
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search;

    let query = {};
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { rollNumber: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user details
// @route   PUT /api/admin/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID' });
    }
    const user = await User.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle user block status
// @route   PUT /api/admin/users/:id/block
exports.toggleBlockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID' });
    }
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Cascade delete or cleanup could be added here
    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc    Get categorized reported users
// @route   GET /api/admin/reports/categorized
exports.getReportedUsersCategorized = async (req, res, next) => {
  try {
    const users = await User.find({ reportCount: { $gt: 0 } }).sort({ reportCount: -1 });
    
    const lowReportList = users.filter(u => u.reportCount >= 1 && u.reportCount < 2);
    const warningList = users.filter(u => u.reportCount >= 2 && u.reportCount < 5);
    const suspendList = users.filter(u => u.reportCount >= 5 && u.reportCount < 10);
    const banList = users.filter(u => u.reportCount >= 10);

    res.status(200).json({
      success: true,
      data: {
        lowReportList,
        warningList,
        suspendList,
        banList,
        allReported: users
      }
    });
  } catch (err) {
    console.error('Moderation Dashboard Error Details:', err);
    next(err);
  }
};

// @desc    Get all content for a specific user for moderation
// @route   GET /api/admin/users/:id/content
exports.getUserContent = async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID' });
    }
    
    const reports = await Report.find({ target: userId }).populate('reporter', 'username fullName');
    const projects = await Project.find({ owner: userId });
    const problems = await Problem.find({ createdBy: userId });
    
    res.status(200).json({
      success: true,
      data: {
        reports,
        projects,
        problems
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Give warning to a user
// @route   POST /api/admin/users/:id/warn
exports.warnUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID' });
    }
    const { message } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.warningExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    user.warningMessage = message || "Don't do unwanted activities. If you continue like this, your account will be banned and your details will be forwarded to higher authorities.";
    
    await user.save();
    
    res.status(200).json({ success: true, message: 'Warning issued', data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Suspend a user
// @route   POST /api/admin/users/:id/suspend
exports.suspendUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID' });
    }
    const { days } = req.body;
    const duration = days || 7; // Default 7 days
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.suspensionExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    
    await user.save();
    
    res.status(200).json({ success: true, message: `User suspended for ${duration} days`, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Permanently ban a user
// @route   POST /api/admin/users/:id/ban
exports.banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isPermanentlyBanned = true;
    
    // Save identifiers to BannedIdentifier
    const identifiers = [
      { type: 'email', value: user.email },
      { type: 'rollNumber', value: user.rollNumber }
    ];
    if (user.phoneNumber) identifiers.push({ type: 'phone', value: user.phoneNumber });
    if (user.personalEmail) identifiers.push({ type: 'email', value: user.personalEmail });

    for (const ident of identifiers) {
      await BannedIdentifier.findOneAndUpdate(
        { value: ident.value },
        ident,
        { upsert: true }
      );
    }

    await user.save();
    
    res.status(200).json({ success: true, message: 'User permanently banned', data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Manual trigger coordinator rankings
// @route   POST /api/admin/trigger-rankings
exports.triggerRankings = async (req, res, next) => {
  try {
    await rankingService.calculateCoordinatorRankings();
    res.status(200).json({ success: true, message: 'Rankings recalculated successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc    Create Feedback Form
// @route   POST /api/admin/feedback
exports.createFeedbackForm = async (req, res, next) => {
  try {
    const { question, description } = req.body;
    
    // Deactivate previous active forms
    await FeedbackForm.updateMany({ isActive: true }, { isActive: false });

    const form = await FeedbackForm.create({
      question,
      description,
      createdBy: req.user.id,
      isActive: true
    });

    res.status(201).json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Feedback Responses
// @route   GET /api/admin/feedback/:id/responses
exports.getFeedbackResponses = async (req, res, next) => {
  try {
    const responses = await FeedbackResponse.find({ formId: req.params.id })
      .populate('userId', 'username fullName profileImage');
    
    res.status(200).json({ success: true, data: responses });
  } catch (err) {
    next(err);
  }
};

// @desc    Send Targeted Alert (Announcement)
// @route   POST /api/admin/targeted-alert
exports.sendTargetedAlert = async (req, res, next) => {
  try {
    const { userId, title, content, image, link, type } = req.body;
    
    const announcement = await Announcement.create({
      title,
      content,
      image,
      link,
      type: type || 'announcement',
      recipient: userId,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Active Feedback Form
// @route   GET /api/admin/feedback/active
exports.getActiveFeedbackForm = async (req, res, next) => {
  try {
    const form = await FeedbackForm.findOne({ isActive: true });
    res.status(200).json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit Feedback Response
// @route   POST /api/admin/feedback/:id/respond
exports.submitFeedbackResponse = async (req, res, next) => {
  try {
    const { response } = req.body;
    const feedback = await FeedbackResponse.create({
      formId: req.params.id,
      userId: req.user.id,
      response
    });
    res.status(201).json({ success: true, data: feedback });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already responded to this feedback.' });
    }
    next(err);
  }
};

// @desc    Get platform statistics
// @route   GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const userCount = await User.countDocuments();
    const projectCount = await Project.countDocuments();
    const problemCount = await Problem.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        userCount,
        projectCount,
        problemCount
      }
    });
  } catch (err) {
    next(err);
  }
};
