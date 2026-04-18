const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const cacheMiddleware = require('../middleware/cacheMiddleware');

// Analytics data (Cache for 10 mins)
router.get('/top-projects', cacheMiddleware('analytics:top', 600), analyticsController.getTopProjects);
router.get('/branch-stats', cacheMiddleware('analytics:branches', 600), analyticsController.getBranchStats);
router.get('/tech-usage', cacheMiddleware('analytics:tech', 600), analyticsController.getTechUsage);

const auth = require('../middleware/authMiddleware');
router.get('/personal', auth, analyticsController.getPersonalStats);

module.exports = router;
