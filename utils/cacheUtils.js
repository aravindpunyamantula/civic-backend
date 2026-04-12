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
      // Use unlink for non-blocking deletion if possible (Redis 4.0+)
      const delMethod = redisClient.unlink ? 'unlink' : 'del';
      await redisClient[delMethod](keys);
      logger.info(`Cleared ${keys.length} cache keys with prefix: ${prefix}`);
    }
  } catch (err) {
    logger.error(`Error clearing cache for prefix ${prefix}:`, err);
  }
};

/**
 * Clears multiple cache prefixes in an optimized way.
 * @param {Array<string>} prefixes Array of prefixes to clear
 */
const clearMultiplePrefixes = async (prefixes) => {
  try {
    const allKeys = [];
    for (const prefix of prefixes) {
      const pattern = `civic:cache:${prefix}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        allKeys.push(...keys);
      }
    }

    if (allKeys.length > 0) {
      const delMethod = redisClient.unlink ? 'unlink' : 'del';
      await redisClient[delMethod](allKeys);
      logger.info(`Cleared ${allKeys.length} cache keys for prefixes: ${prefixes.join(', ')}`);
    }
  } catch (err) {
    logger.error(`Error clearing multiple cache prefixes:`, err);
  }
};

module.exports = {
  clearCacheByPrefix,
  clearMultiplePrefixes
};
