const redisClient = require('../config/redisClient');
const logger = require('./logger');

const cacheMiddleware = (keyPrefix, duration = 600) => {
  return async (req, res, next) => {
    // We only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Bypass cache if shuffle is requested (Instagram style refresh)
    if (req.query.shuffle === 'true') {
      logger.debug(`Bypassing cache for ${keyPrefix} as shuffle is requested`);
      return next();
    }

    // Generate cache key based on URL and authenticated user (if any)
    const userId = req.user ? req.user.id : 'public';
    const key = `civic:cache:${keyPrefix}:${req.originalUrl}:${userId}`;

    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        logger.debug(`Cache HIT for key: ${key}`);
        try {
          return res.status(200).json(JSON.parse(cachedData));
        } catch (parseErr) {
          logger.error('Error parsing cached data:', parseErr);
          // If cache is corrupted, proceed to DB
        }
      }

      logger.debug(`Cache MISS for key: ${key}`);

      // Overide res.send to intercept the response and cache it
      const originalSend = res.send;
      res.send = function (body) {
        // Only cache successful JSON responses
        if (res.statusCode === 200 && body) {
          try {
            // In Express, body of res.json() which eventually calls res.send() is usually a string
            const dataToCache = typeof body === 'object' ? JSON.stringify(body) : body;
            
            // Basic sanity check to ensure we are caching valid JSON if possible
            // We don't want to cache error messages or HTML accidentally
            redisClient.setEx(key, duration, dataToCache)
              .catch(err => logger.error('Error saving to Redis:', err));
          } catch (err) {
            logger.error('Error stringifying data for Redis:', err);
          }
        }
        return originalSend.call(this, body);
      };

      next();
    } catch (err) {
      logger.error('Redis Caching Middleware Error:', err);
      // Fallback to DB if Redis fails
      next();
    }
  };
};

module.exports = cacheMiddleware;
