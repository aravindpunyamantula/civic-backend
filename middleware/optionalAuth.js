const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async function (req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // If no token, proceed without user
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  // Verify token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const User = require('../models/User');
    const user = await User.findById(decoded.id);
    req.user = user;
    next();
  } catch (err) {
    // If token is invalid, we still proceed but without user context
    req.user = null;
    next();
  }
};
