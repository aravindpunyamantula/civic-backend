const express = require('express');
const router = express.Router();
const problemController = require('../controllers/problemController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuth');

router.use((req, res, next) => {
  console.log(`[PROBLEM ROUTER] ${req.method} ${req.url}`);
  next();
});

router.post('/:id/comments', authMiddleware, problemController.addComment);
router.delete('/:id/comments/:commentId', authMiddleware, problemController.deleteComment);
router.post('/', authMiddleware, problemController.createProblem);
router.get('/', optionalAuth, problemController.getProblems);
router.get('/:id', optionalAuth, problemController.getProblemById);
router.post('/:id/convert-to-project', authMiddleware, problemController.convertToProject);

module.exports = router;
