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
    const branchStats = await Project.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'ownerData'
        }
      },
      { $unwind: '$ownerData' },
      { $group: { _id: "$ownerData.branch", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    // Format to match expected frontend structure if necessary
    const formattedStats = branchStats.map(stat => ({
      branch: stat._id || 'Unknown',
      count: stat.count
    }));
    res.status(200).json(formattedStats);
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

exports.getPersonalStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectCount = await Project.countDocuments({ owner: userId });
    
    const projects = await Project.find({ owner: userId });
    const totalLikes = projects.reduce((sum, p) => sum + (p.likes ? p.likes.length : 0), 0);
    
    // Get rank (simplified: based on project count)
    const rank = await User.countDocuments({ 
      // This is a simple rank logic, could be more complex
    }) + 1;

    res.status(200).json({
      projectCount,
      totalLikes,
      rank: 'Top 10%' // Mocked rank for now
    });
  } catch (error) {
    next(error);
  }
};
