const Project = require('../models/Project');
const User = require('../models/User');
const redisClient = require('../config/redisClient');

exports.getTopCoordinators = async (req, res, next) => {
  try {
    const cachedRankings = await redisClient.get('ranking:coordinators');
    
    if (cachedRankings) {
      return res.status(200).json(JSON.parse(cachedRankings));
    }
    
    // Fallback: This should usually be handled by a manual trigger or wait for cron
    res.status(200).json([]);
  } catch (error) {
    next(error);
  }
};

exports.getTopProjects = async (req, res, next) => {
  try {
    const topProjects = await Project.aggregate([
      // Metadata Scoring
      {
        $addFields: {
          metadataScore: {
            $add: [
              { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$title", ""] } }, 10] }, 5, 0] },
              { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$description", ""] } }, 50] }, 10, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ["$media", []] } }, 0] }, 10, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ["$technologies", []] } }, 0] }, 5, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ["$links", []] } }, 0] }, 5, 0] }
            ]
          },
          likesCount: { $size: { $ifNull: ["$likes", []] } },
          viewsCount: { $size: { $ifNull: ["$views", []] } }
        }
      },
      // Engagement Scoring (Like Rate & Discovery Boost)
      {
        $addFields: {
          likeRate: {
            $cond: [
              { $eq: ["$viewsCount", 0] },
              { $cond: [{ $gt: ["$likesCount", 0] }, 1.0, 0.0] },
              { $divide: ["$likesCount", { $add: ["$viewsCount", 1] }] }
            ]
          },
          discoveryBoost: {
            $divide: [20, { $ln: { $add: ["$viewsCount", 2] } }]
          }
        }
      },
      // Total Score Calculation
      {
        $addFields: {
          totalScore: {
            $add: [
              "$metadataScore",
              { $multiply: ["$likeRate", 50] },
              "$discoveryBoost"
            ]
          }
        }
      },
      { $sort: { totalScore: -1 } },
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
      { $limit: 6 }
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

exports.getAdminStats = async (req, res, next) => {
  try {
    const userCount = await User.countDocuments();
    const projectCount = await Project.countDocuments();
    const problemCount = await mongoose.model('Problem').countDocuments();
    
    res.status(200).json({
      userCount,
      projectCount,
      problemCount
    });
  } catch (error) {
    next(error);
  }
};
