const redisClient = require('../config/redisClient');
const logger = require('../middleware/logger');

/**
 * Clears all cache keys that start with the given prefix.
 * @param {string} prefix The prefix to clear (e.g., 'feed')
 */
const clearCacheByPrefix = async (prefix) => {
  try {
    const pattern = `civic:cache:${prefix}:*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleared ${keys.length} cache keys with prefix: ${prefix}`);
    }
  } catch (err) {
    logger.error(`Error clearing cache for prefix ${prefix}:`, err);
  }
};

module.exports = {
  clearCacheByPrefix
};
