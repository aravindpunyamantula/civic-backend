const Report = require('../models/Report');
const User = require('../models/User');
const logger = require('../middleware/logger');

exports.submitReport = async (req, res, next) => {
  try {
    const { targetId, reason, description } = req.body;

    if (!targetId || !reason) {
      return res.status(400).json({ message: 'Target user and reason are required' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot report yourself' });
    }

    const newReport = new Report({
      reporter: req.user.id,
      target: targetId,
      reason,
      description
    });

    await newReport.save();

    // Increment report count on target user
    targetUser.reportCount += 1;
    await targetUser.save();

    logger.info(`User ${req.user.id} reported user ${targetId} for ${reason}`);

    res.status(201).json({ 
      success: true, 
      message: 'Report submitted successfully. Thank you for making our community safer.' 
    });
  } catch (error) {
    next(error);
  }
};
