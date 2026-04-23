const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

// Authenticated users can get the active form and respond
router.use(authMiddleware);

router.get('/active', adminController.getActiveFeedbackForm);
router.post('/:id/respond', adminController.submitFeedbackResponse);

module.exports = router;
