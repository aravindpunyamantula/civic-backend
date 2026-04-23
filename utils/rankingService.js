const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const Problem = require('../models/Problem');
const View = require('../models/View');
const redisClient = require('../config/redisClient');

/**
 * Calculates Student Coordinator rankings based on a weighted scoring system.
 * This runs as a heavy daily task.
 */
exports.calculateCoordinatorRankings = async () => {
  try {
    console.log('[RankingService] Starting daily calculation...');

    // 1. Project Output & Quality
    // Score = count*20 + totalLikes*5 + totalViews*1
    const projectStats = await Project.aggregate([
      {
        $group: {
          _id: "$owner",
          ownedProjects: { $sum: 1 },
          totalLikes: { $sum: { $size: { $ifNull: ["$likes", []] } } },
          totalViews: { $sum: { $size: { $ifNull: ["$views", []] } } }
        }
      }
    ]);

    // 2. Problem Output & Impact
    // Score = count*30 + totalComments*2 + linkedProjects*50
    const problemStats = await Problem.aggregate([
      {
        $group: {
          _id: "$createdBy",
          ownedProblems: { $sum: 1 },
          totalComments: { $sum: { $size: { $ifNull: ["$comments", []] } } }
        }
      }
    ]);

    const problemImpactStats = await Project.aggregate([
      { $match: { originProblemId: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: 'problems',
          localField: 'originProblemId',
          foreignField: '_id',
          as: 'problem'
        }
      },
      { $unwind: "$problem" },
      {
        $group: {
          _id: "$problem.createdBy",
          linkedProjectsCount: { $sum: 1 }
        }
      }
    ]);

    // 3. Team Collaboration
    // Score = count*25
    const collabStats = await Project.aggregate([
      { $unwind: "$collaborators" },
      {
        $group: {
          _id: "$collaborators",
          collaboratorProjects: { $sum: 1 }
        }
      }
    ]);

    // 4. Social Interaction
    // Likes given: +2
    const likesGivenStats = await Project.aggregate([
      { $unwind: "$likes" },
      {
        $group: {
          _id: "$likes",
          likesGiven: { $sum: 1 }
        }
      }
    ]);

    // Views given: +0.5
    const viewsGivenStats = await View.aggregate([
      {
        $group: {
          _id: "$user",
          viewsGiven: { $sum: 1 }
        }
      }
    ]);

    // 5. Merge all stats into a User Map
    const userMap = {};

    const merge = (stats, fields) => {
      stats.forEach(stat => {
        const userId = stat._id.toString();
        if (!userMap[userId]) userMap[userId] = {};
        fields.forEach(field => {
          userMap[userId][field] = stat[field] || 0;
        });
      });
    };

    merge(projectStats, ['ownedProjects', 'totalLikes', 'totalViews']);
    merge(problemStats, ['ownedProblems', 'totalComments']);
    merge(problemImpactStats, ['linkedProjectsCount']);
    merge(collabStats, ['collaboratorProjects']);
    merge(likesGivenStats, ['likesGiven']);
    merge(viewsGivenStats, ['viewsGiven']);

    // 6. Calculate Scores & Profile Completeness
    const finalRankings = [];
    const allUsers = await User.find({}).select('username profileImage bio portfolio github leetcode codechef gfg linkedin personalEmail phoneNumber skills');

    for (const user of allUsers) {
      const userId = user._id.toString();
      const s = userMap[userId] || {};
      
      // Profile Score (Max 120)
      let profileScore = 0;
      if (user.profileImage) profileScore += 20;
      if (user.bio && user.bio.length > 20) profileScore += 10;
      if (user.portfolio) profileScore += 10;
      if (user.github) profileScore += 10;
      if (user.linkedin) profileScore += 10;
      if (user.leetcode) profileScore += 10;
      if (user.codechef) profileScore += 10;
      if (user.gfg) profileScore += 10;
      if (user.personalEmail) profileScore += 10;
      if (user.phoneNumber) profileScore += 10;
      if (user.skills && user.skills.length > 0) profileScore += 10;

      const projectScore = (s.ownedProjects || 0) * 20 + (s.totalLikes || 0) * 5 + (s.totalViews || 0) * 1;
      const problemScore = (s.ownedProblems || 0) * 30 + (s.totalComments || 0) * 2 + (s.linkedProjectsCount || 0) * 50;
      const paperworkScore = (s.collaboratorProjects || 0) * 25; // teamworkScore name change to avoid confusion if needed, but keeping logic
      const socialScore = (s.likesGiven || 0) * 2 + (s.viewsGiven || 0) * 0.5;

      const totalScore = projectScore + problemScore + paperworkScore + socialScore + profileScore;

      if (totalScore > 0) {
        finalRankings.push({
          user: userId,
          totalScore,
          breakdown: { projectScore, problemScore, teamworkScore: paperworkScore, socialScore, profileScore }
        });
      }
    }

    // Sort and Take Top 10
    finalRankings.sort((a, b) => b.totalScore - a.totalScore);
    const top10 = finalRankings.slice(0, 10);

    // Populate user info
    const populatedTop10 = (await Promise.all(top10.map(async (r) => {
      const user = await User.findById(r.user).select('username fullName profileImage branch campus');
      return { ...r, user };
    }))).filter(r => r.user !== null);


    // Save to Redis
    if (redisClient) {
      await redisClient.set('ranking:coordinators', JSON.stringify(populatedTop10));
    }

    console.log(`[RankingService] Calculation finished. Top 1 scored ${populatedTop10[0]?.totalScore || 0}`);
    return populatedTop10;

  } catch (error) {
    console.error('[RankingService] Error:', error);
  }
};
