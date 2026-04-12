const Project = require('../models/Project');
const User = require('../models/User');

exports.getTopProjects = async (req, res, next) => {
  try {
    const topProjects = await Project.aggregate([
      { $addFields: { likesCount: { $size: "$likes" } } },
      { $sort: { likesCount: -1, commentsCount: -1 } },
      { $limit: 10 }
    ]);
    await Project.populate(topProjects, { path: 'owner', select: 'username fullName profileImage' });
    res.status(200).json(topProjects);
  } catch (error) {
    next(error);
  }
};

exports.getBranchStats = async (req, res, next) => {
  try {
    const branchStats = await User.aggregate([
      { $group: { _id: "$branch", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.status(200).json(branchStats);
  } catch (error) {
    next(error);
  }
};

exports.getTechUsage = async (req, res, next) => {
  try {
    const techStats = await Project.aggregate([
      { $unwind: "$technologies" },
      { $group: { _id: "$technologies", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    res.status(200).json(techStats);
  } catch (error) {
    next(error);
  }
};
