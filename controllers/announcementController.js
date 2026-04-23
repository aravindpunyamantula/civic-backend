const Announcement = require('../models/Announcement');
const logger = require('../middleware/logger');

exports.getAnnouncements = async (req, res, next) => {
  try {
    let query = { isActive: true, recipient: null }; // Global announcements
    
    if (req.user) {
      query = {
        isActive: true,
        $or: [
          { recipient: null },
          { recipient: req.user.id }
        ]
      };
    }

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .limit(10);
    res.status(200).json(announcements);
  } catch (error) {
    next(error);
  }
};

exports.createAnnouncement = async (req, res, next) => {
  try {
    const { title, content, image, type, link, recipient } = req.body;
    
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const announcement = new Announcement({
      title,
      content,
      image,
      type,
      link,
      recipient,
      createdBy: req.user.id,
    });

    await announcement.save();
    logger.info(`Announcement created by admin ${req.user.id}: ${announcement._id}`);
    
    res.status(201).json(announcement);
  } catch (error) {
    next(error);
  }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    await Announcement.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Announcement deleted' });
  } catch (error) {
    next(error);
  }
};
