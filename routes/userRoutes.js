const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuth');
const cacheMiddleware = require('../middleware/cacheMiddleware');

// Search users (Cache for 10 mins)
router.get('/search', optionalAuth, cacheMiddleware('user_search', 600), userController.searchUsers);

// Get current user profile (Cache for 10 mins)
router.get('/profile', authMiddleware, cacheMiddleware('profile', 600), userController.getUserProfile);

// Update current user profile
router.put('/profile', authMiddleware, userController.updateUserProfile);

// Get user by ID
router.get('/:id', optionalAuth, userController.getUserById);

// Get followers
router.get('/:id/followers', optionalAuth, userController.getFollowers);

// Get following
router.get('/:id/following', optionalAuth, userController.getFollowing);

// Follow user (Sends request)
router.post('/:id/follow', authMiddleware, userController.followUser);

// Unfollow user (or cancel request)
router.post('/:id/unfollow', authMiddleware, userController.unfollowUser);

// Follow requests management
router.get('/requests/pending', authMiddleware, userController.getFollowRequests);
router.post('/requests/accept', authMiddleware, userController.acceptFollowRequest);
router.post('/requests/reject', authMiddleware, userController.rejectFollowRequest);

// Delete user
router.delete('/:id', authMiddleware, userController.deleteUser);

// Report user
router.post('/report', authMiddleware, reportController.submitReport);

module.exports = router;
