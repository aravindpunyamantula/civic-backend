const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cacheMiddleware');

// Search users (Cache for 10 mins)
router.get('/search', cacheMiddleware('user_search', 600), userController.searchUsers);
router.get('/suggested', authMiddleware, userController.getSuggestedUsers);

// Get current user profile (Cache for 10 mins)
router.get('/profile', authMiddleware, cacheMiddleware('profile', 600), userController.getUserProfile);

// Update current user profile
router.put('/profile', authMiddleware, userController.updateUserProfile);

// Get user by ID
router.get('/:id', userController.getUserById);

// Get followers
router.get('/:id/followers', userController.getFollowers);

// Get following
router.get('/:id/following', userController.getFollowing);

// Follow user
router.post('/:id/follow', authMiddleware, userController.followUser);

// Unfollow user
router.post('/:id/unfollow', authMiddleware, userController.unfollowUser);

// Delete user
router.delete('/:id', authMiddleware, userController.deleteUser);

module.exports = router;
