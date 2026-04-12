const { createClient } = require('redis');
const logger = require('../middleware/logger');

let redisURL = process.env.REDIS_URL || 'redis://localhost:6379';

if (redisURL.includes('upstash.io') && redisURL.startsWith('redis://')) {
  redisURL = redisURL.replace('redis://', 'rediss://');
}

const redisClient = createClient({
  url: redisURL,
  socket: {
    reconnectStrategy: (retries) => {
      return Math.min(retries * 100, 5000);
    },
    connectTimeout: 10000,
  }
});

redisClient.on('error', (err) => {
  // Only log full error if it's not a common reconnection issue
  if (err.message !== 'Socket closed unexpectedly') {
    logger.error('Redis Client Error', err);
  } else {
    logger.warn('Redis Connection lost, retrying...');
  }
});
redisClient.on('connect', () => logger.info('Redis connected successfully'));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.error('Could not connect to Redis', err);
  }
})();

module.exports = redisClient;
