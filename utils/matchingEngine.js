const { normalizeSkills } = require('./skillUtils');

/**
 * Calculates a match score between a user and a project.
 * @param {Object} user User object with skills
 * @param {Object} project Project object with technologies and collaborationRoles
 * @returns {Object} { score, reasons }
 */
const calculateMatchScore = (user, project) => {
  const userSkills = new Set(normalizeSkills(user.skills || []));
  const projectTech = normalizeSkills(project.technologies || project.techStack || []);
  const collabRoles = normalizeSkills(project.collaborationRoles || []);

  if (projectTech.length === 0) return { score: 0, reasons: ['Project has no technologies specified'] };

  let score = 0;
  let reasons = [];

  // 1. Skill Overlap (up to 70 points)
  const matchedSkills = projectTech.filter(skill => userSkills.has(skill));
  const skillScore = (matchedSkills.length / projectTech.length) * 70;
  score += skillScore;

  if (matchedSkills.length > 0) {
    reasons.push(`Matches ${matchedSkills.length} project technologies: ${matchedSkills.join(', ')}`);
  }

  // 2. Role Match (up to 30 points)
  const matchedRoles = collabRoles.filter(role => userSkills.has(role));
  if (matchedRoles.length > 0) {
    score += 30;
    reasons.push(`User skills match targeted collaboration roles: ${matchedRoles.join(', ')}`);
  }

  // Cap score at 100
  score = Math.min(Math.round(score), 100);

  return {
    score,
    reasons
  };
};

module.exports = { calculateMatchScore };
