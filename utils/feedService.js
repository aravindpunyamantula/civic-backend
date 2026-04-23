const Project = require('../models/Project');
const View = require('../models/View');
const { normalizeSkills } = require('./skillUtils');

/**
 * Service to handle feed recommendation logic
 */
class FeedService {
  /**
   * Generates a ranked pool of project IDs for a user
   * @param {Object} user User object containing skills and ID
   * @param {Object} options Options like limit, excludeViewed
   * @returns {Array} List of ranked project IDs
   */
  async generateRankedPool(user, options = {}) {
    const { limit = 200, excludeViewedHours = 48 } = options;

    // 1. Candidate Selection
    // Fetch projects that:
    // - match user skills
    // - or are trending (high likes/views)
    // - or are recently created
    
    const userSkills = normalizeSkills(user.skills || []);
    
    // Exclude viewed content in last 48 hours
    const recentlyViewed = await View.find({
      user: user._id,
      viewedAt: { $gte: new Date(Date.now() - excludeViewedHours * 60 * 60 * 1000) }
    }).select('project');
    
    const viewedProjectIds = recentlyViewed.map(v => v.project.toString());

    // Fetch potential candidates (broad query)
    const candidates = await Project.find({
      _id: { $nin: viewedProjectIds },
      owner: { $ne: user._id } // Exclude own projects
    })
    .select('title technologies likes views createdAt status')
    .sort({ createdAt: -1 })
    .limit(limit * 2); // Fetch more than needed for scoring and diversity

    // 2. Scoring
    const scoredProjects = candidates.map(project => {
      const score = this.calculateScore(project, userSkills);
      return { project, score };
    });

    // 3. Ranking
    scoredProjects.sort((a, b) => b.score - a.score);

    // 4. Diversity Constraint (Max 5 per tag in top pool)
    const finalPool = this.applyDiversity(scoredProjects, 5);

    return finalPool.map(p => p.project._id);
  }

  /**
   * Calculate recommendation score for a project
   */
  calculateScore(project, userSkills) {
    const skillMatchWeight = 5;
    const now = new Date();
    const hoursSinceCreation = (now - new Date(project.createdAt)) / (1000 * 60 * 60);

    // skill_match = number of matching tags with user skills
    const matchingTags = project.technologies.filter(tech => 
      userSkills.includes(tech.toLowerCase().trim())
    ).length;

    const skillMatchScore = skillMatchWeight * matchingTags;

    // log(likes + 1) + log(views + 1)
    const popularityScore = Math.log1p(project.likes.length) + Math.log1p(project.views.length);

    // recency_score = higher score for newer posts (simple linear decay for first 7 days)
    const recencyScore = Math.max(0, 10 * (1 - hoursSinceCreation / (24 * 7)));

    // new_post_boost = exponential decay based on time since creation
    // new_post_boost = exp(-hours_since_creation / 24)
    const newPostBoost = 10 * Math.exp(-hoursSinceCreation / 24);

    // Media penalty: Projects without images/videos are pushed to the end
    const mediaPenalty = (!project.media || project.media.length === 0) ? 50 : 0;

    // Links boost: Small reward for providing external links
    const linksBoost = (project.links && project.links.length > 0) ? 5 : 0;

    return skillMatchScore + popularityScore + recencyScore + newPostBoost + linksBoost - mediaPenalty;
  }

  /**
   * Apply diversity constraint: Limit similar content
   * Maximum N projects per same tag in the final list
   */
  applyDiversity(scoredProjects, maxPerTag) {
    const tagCounts = {};
    const result = [];

    for (const item of scoredProjects) {
      const techs = item.project.technologies || [];
      
      // Check if project can be added without violating diversity for ANY of its tags
      // Or we can just check the primary/first tag for simplicity or a combination
      // Let's check all tags and if any exceeds limit, we deprioritize or skip.
      // Here we skip for strict constraint as requested.
      
      let canAdd = true;
      for (const tech of techs) {
        if ((tagCounts[tech] || 0) >= maxPerTag) {
          canAdd = false;
          break;
        }
      }

      if (canAdd) {
        result.push(item);
        for (const tech of techs) {
          tagCounts[tech] = (tagCounts[tech] || 0) + 1;
        }
      }
      
      if (result.length >= 200) break; // Limit pool size
    }

    return result;
  }
  
  /**
   * Handle Cold Start for new users
   */
  async getColdStartCandidates(limit = 20) {
    return await Project.find({})
      .sort({ likes: -1, views: -1, createdAt: -1 })
      .limit(limit)
      .select('_id');
  }
}

module.exports = new FeedService();
