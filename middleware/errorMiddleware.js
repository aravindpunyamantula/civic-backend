const logger = require('./logger');

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`\${err.name}: \${err.message}`, {
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    user: req.user ? req.user.id : 'anonymous'
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: Object.values(err.errors).map(val => val.message).join(', ')
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      message: 'Duplicate field value entered'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired'
    });
  }

  // Default to 500 server error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;
