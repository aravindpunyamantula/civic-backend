const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuth');
const cacheMiddleware = require('../middleware/cacheMiddleware');

// Get Feed (Cache for 10 mins)
router.get('/feed', optionalAuth, cacheMiddleware('feed', 600), projectController.getFeed);

// Get User Projects
router.get('/user/discussions', authMiddleware, projectController.getUserDiscussions);
router.get('/user/saved', authMiddleware, projectController.getSavedProjects);
router.get('/user/:userId', cacheMiddleware('user_projects', 600), projectController.getUserProjects);

// Recommendations
router.get('/recommended', optionalAuth, projectController.getRecommendedProjects);

// Get Project by id
router.get('/:id', cacheMiddleware('project_detail', 600), projectController.getProjectById);

// Like and Save
router.post('/:id/like', authMiddleware, projectController.likeProject);
router.post('/:id/save', authMiddleware, projectController.saveProject);
router.post('/:id/view', authMiddleware, projectController.recordView);

// Create Project
router.post('/', authMiddleware, projectController.createProject);

// Update Project
router.put('/:id', authMiddleware, projectController.updateProject);

// Delete Project
router.delete('/:id', authMiddleware, projectController.deleteProject);

// Collaboration
router.post('/:id/request-collab', authMiddleware, projectController.requestCollab);
router.get('/:id/requests', authMiddleware, projectController.getCollabRequests);
router.post('/:id/accept-request', authMiddleware, projectController.acceptCollabRequest);
router.post('/:id/reject-request', authMiddleware, projectController.rejectCollabRequest);
router.get('/:id/messages', authMiddleware, projectController.getChatHistory);
router.delete('/:id/messages/:messageId', authMiddleware, projectController.deleteMessage);
router.post('/:id/collaborators', authMiddleware, projectController.addCollaborator);
router.delete('/:id/collaborators/:userId', authMiddleware, projectController.removeCollaborator);

module.exports = router;
