const express = require('express');
const router = express.Router();
const problemController = require('../controllers/problemController');
const authMiddleware = require('../middleware/authMiddleware');

router.use((req, res, next) => {
  console.log(`[PROBLEM ROUTER] ${req.method} ${req.url}`);
  next();
});

router.post('/:id/comments', authMiddleware, problemController.addComment);
router.post('/', authMiddleware, problemController.createProblem);
router.get('/', problemController.getProblems);
router.get('/:id', problemController.getProblemById);
router.post('/:id/convert-to-project', authMiddleware, problemController.convertToProject);

module.exports = router;
