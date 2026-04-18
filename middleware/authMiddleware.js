const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async function (req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if no token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  // Verify token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is suspended or banned
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found, authorization denied' });
    }

    if (user.isPermanentlyBanned) {
      return res.status(403).json({ message: 'Your account has been permanently banned.' });
    }

    if (user.suspensionExpiresAt && user.suspensionExpiresAt > new Date()) {
      const remainingDays = Math.ceil((user.suspensionExpiresAt - new Date()) / (1000 * 60 * 60 * 24));
      return res.status(403).json({ 
        message: `Your account is suspended for ${remainingDays} more days contact to higher authorities.`,
        suspensionExpiresAt: user.suspensionExpiresAt
      });
    }

    req.user = decoded; 
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
