const User = require('../models/User');

const adminMiddleware = async (req, res, next) => {
  try {
    // Current user is already populated in req.user by authMiddleware
    const user = await User.findById(req.user.id);

    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = adminMiddleware;
