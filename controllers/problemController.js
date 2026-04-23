const mongoose = require('mongoose');
const Problem = require('../models/Problem');
const Project = require('../models/Project');
const { normalizeSkills } = require('../utils/skillUtils');
const logger = require('../middleware/logger');

exports.createProblem = async (req, res, next) => {
  try {
    const { title, description, tags } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const newProblem = new Problem({
      title,
      description,
      tags: Array.isArray(tags) ? normalizeSkills(tags) : [],
      createdBy: req.user.id
    });

    await newProblem.save();
    res.status(201).json(newProblem);
  } catch (error) {
    next(error);
  }
};

exports.getProblems = async (req, res, next) => {
  try {
    const { tag, userId, sort } = req.query;
    let filter = {};

    if (tag) {
      filter.tags = tag.toLowerCase();
    }
    if (userId) {
      if (userId === 'null' || userId === 'undefined') {
        // Handle cases where client sends string 'null'
        return res.status(200).json([]);
      }
      filter.createdBy = userId;
    } else if (req.query.myUploads === 'true') {
      // If client explicitly asked for my uploads but no userId provided
      return res.status(200).json([]);
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    }

    const problems = await Problem.find(filter)
      .populate('createdBy', 'username fullName profileImage')
      .sort(sortOption);
    res.status(200).json(problems);
  } catch (error) {
    next(error);
  }
};

exports.getProblemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Problem ID' });
    }

    const problem = await Problem.findById(id)
      .populate('createdBy', 'username fullName profileImage followers');
    
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });

    // Check if current user is following the creator
    const isOwner = req.user && problem.createdBy._id.toString() === req.user.id;
    const isFollower = req.user && problem.createdBy.followers.some(id => id.toString() === req.user.id);

    projects = await Project.find({ originProblemId: problem._id })
      .populate('owner', 'username fullName profileImage')
      .sort({ createdAt: -1 });
    
    const populatedProblem = await Problem.findById(problem._id)
      .populate('comments.user', 'username fullName profileImage');
    comments = populatedProblem.comments;

    const problemObj = problem.toObject();
    delete problemObj.createdBy.followers;

    res.status(200).json({
      ...problemObj,
      comments: comments,
      projects: projects
    });
  } catch (error) {
    next(error);
  }
};

exports.convertToProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Problem ID' });
    }
    const problem = await Problem.findById(id);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });

    const newProject = new Project({
      title: problem.title,
      description: problem.description,
      technologies: problem.tags,
      owner: req.user.id,
      originProblemId: problem._id,
      status: 'IDEA'
    });

    await newProject.save();

    const populatedProject = await Project.findById(newProject._id)
      .populate('owner', 'username fullName profileImage')
      .populate('originProblemId', 'title description tags');

    res.status(201).json(populatedProject);
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    const problemId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      return res.status(400).json({ success: false, message: 'Invalid Problem ID' });
    }

    logger.debug(`Adding comment to problem: ${problemId} by user: ${req.user.id}`);

    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const problem = await Problem.findById(problemId).populate('createdBy', 'followers');
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }


    const comment = {
      user: req.user.id,
      text,
      createdAt: new Date()
    };

    problem.comments.push(comment);
    await problem.save();
    logger.info(`Comment added to problem: \${problemId}`);

    const updatedProblem = await Problem.findById(problem._id)
      .populate('comments.user', 'username fullName profileImage');

    res.status(201).json(updatedProblem.comments[updatedProblem.comments.length - 1]);
  } catch (error) {
    next(error);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const problem = await Problem.findById(id);

    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    const comment = problem.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Only creator of comment, problem creator, or admin can delete
    if (comment.user.toString() !== req.user.id && problem.createdBy.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    problem.comments.pull(commentId);
    await problem.save();

    res.status(200).json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};
