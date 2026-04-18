const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');

exports.getTopProjects = async (req, res, next) => {
  try {
    const topProjects = await Project.aggregate([
      { $addFields: { likesCount: { $size: "$likes" } } },
      { $sort: { likesCount: -1, commentsCount: -1 } },
      { $limit: 5 }
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
    const userId = new mongoose.Types.ObjectId(req.user.id);
    
    // 1. Projects and Likes count using aggregation for performance
    const stats = await Project.aggregate([
      { $match: { owner: userId } },
      {
        $group: {
          _id: "$owner",
          projectCount: { $sum: 1 },
          totalLikes: { $sum: { $size: "$likes" } }
        }
      }
    ]);

    const userStats = stats.length > 0 ? stats[0] : { projectCount: 0, totalLikes: 0 };

    // 2. Simple Ranking Logic (e.g., Top % based on total likes across all users)
    const totalUsers = await User.countDocuments();
    const usersWithMoreLikes = await Project.aggregate([
      { $group: { _id: "$owner", total: { $sum: { $size: "$likes" } } } },
      { $match: { total: { $gt: userStats.totalLikes } } },
      { $count: "count" }
    ]);

    const higherRankCount = usersWithMoreLikes.length > 0 ? usersWithMoreLikes[0].count : 0;
    const percentile = totalUsers > 0 ? (higherRankCount / totalUsers) * 100 : 100;

    let rankLabel = 'Top 100%';
    if (percentile <= 5) rankLabel = 'Top 5%';
    else if (percentile <= 10) rankLabel = 'Top 10%';
    else if (percentile <= 25) rankLabel = 'Top 25%';
    else if (percentile <= 50) rankLabel = 'Top 50%';

    res.status(200).json({
      projectCount: userStats.projectCount,
      totalLikes: userStats.totalLikes,
      rank: userStats.projectCount > 0 ? rankLabel : 'Newbie'
    });
  } catch (error) {
    next(error);
  }
};
