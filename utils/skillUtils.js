/**
 * Normalizes an array of skills or technologies.
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes duplicates
 * - Filters out empty strings
 */
const normalizeSkills = (skills) => {
  if (!skills || !Array.isArray(skills)) return [];
  return [...new Set(skills
    .map(s => s.toLowerCase().trim())
    .filter(s => s !== '')
  )];
};

module.exports = { normalizeSkills };
