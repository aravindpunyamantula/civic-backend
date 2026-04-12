const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function (req, res, next) {
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
    req.user = decoded;
    next();
  } catch (err) {
    // If token is invalid, we still proceed but without user context
    // This allows guest access while still identifying logged in users for filtering
    req.user = null;
    next();
  }
};
