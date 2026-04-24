const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All routes here require authentication AND admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', adminController.getAllUsers);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/block', adminController.toggleBlockUser);
router.delete('/users/:id', adminController.deleteUser);

// Moderation & Reports
router.get('/reports/categorized', adminController.getReportedUsersCategorized);
router.get('/users/:id/content', adminController.getUserContent);
router.post('/users/:id/warn', adminController.warnUser);
router.post('/users/:id/suspend', adminController.suspendUser);
router.post('/users/:id/unsuspend', adminController.unsuspendUser);
router.post('/users/:id/ban', adminController.banUser);
router.post('/users/:id/unban', adminController.unbanUser);

// Platform Overview
router.get('/stats', adminController.getStats);

// Coordinator Rankings
router.post('/trigger-rankings', adminController.triggerRankings);

// Feedback System
router.post('/feedback', adminController.createFeedbackForm);
router.get('/feedback', adminController.getAllFeedbackForms);
router.put('/feedback/:id', adminController.updateFeedbackForm);
router.delete('/feedback/:id', adminController.deleteFeedbackForm);
router.patch('/feedback/:id/toggle', adminController.toggleFeedbackStatus);
router.get('/feedback/:id/responses', adminController.getFeedbackResponses);

// Targeted Alerts
router.post('/targeted-alert', adminController.sendTargetedAlert);

module.exports = router;
