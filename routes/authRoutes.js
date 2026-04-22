const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const auth = require('../middleware/authMiddleware');

// POST /api/auth/signup
router.post('/signup', authController.signup);

// POST /api/auth/login
router.post('/login', authController.login);

// Password Reset (Public)
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Password Change (Private)
router.post('/change-password', auth, authController.changePassword);

// Email Verification (Private)
router.post('/verify-email/request', auth, authController.requestEmailVerification);
router.post('/verify-email/confirm', auth, authController.confirmEmailVerification);

module.exports = router;
