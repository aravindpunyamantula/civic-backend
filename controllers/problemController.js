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
    const { tag } = req.query;
    let filter = {};
    if (tag) {
      filter.tags = tag;
    }

    const problems = await Problem.find(filter)
      .populate('createdBy', 'username fullName profileImage')
      .sort({ createdAt: -1 });
    res.status(200).json(problems);
  } catch (error) {
    next(error);
  }
};

exports.getProblemById = async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id)
      .populate('createdBy', 'username fullName profileImage')
      .populate('comments.user', 'username fullName profileImage');
    
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
    
    const projects = await Project.find({ originProblemId: problem._id })
      .populate('owner', 'username fullName profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json({
      ...problem.toObject(),
      projects
    });
  } catch (error) {
    next(error);
  }
};

exports.convertToProject = async (req, res, next) => {
  try {
    const problem = await Problem.findById(req.params.id);
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
    logger.debug(`Adding comment to problem: \${problemId} by user: \${req.user.id}`);

    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const problem = await Problem.findById(problemId);
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
