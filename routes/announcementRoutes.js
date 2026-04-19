const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuth');

router.get('/', optionalAuth, announcementController.getAnnouncements);
router.post('/', authMiddleware, announcementController.createAnnouncement);
router.delete('/:id', authMiddleware, announcementController.deleteAnnouncement);

module.exports = router;
