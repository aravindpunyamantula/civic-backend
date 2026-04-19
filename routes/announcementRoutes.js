const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuth');
const adminMiddleware = require('../middleware/adminMiddleware');

router.get('/', optionalAuth, announcementController.getAnnouncements);
router.post('/', authMiddleware, adminMiddleware, announcementController.createAnnouncement);
router.delete('/:id', authMiddleware, adminMiddleware, announcementController.deleteAnnouncement);

module.exports = router;
