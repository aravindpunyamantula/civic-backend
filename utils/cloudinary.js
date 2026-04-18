const cloudinary = require('cloudinary').v2;
const logger = require('../middleware/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Extracts public_id from a Cloudinary URL
 * Example: https://res.cloudinary.com/cloudname/image/upload/v12345/folder/id.jpg -> folder/id
 * @param {string} url 
 * @returns {string|null}
 */
const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  try {
    // Cloudinary URL usually follows: .../upload/(v\d+/)?(folder/)?public_id(\.ext)?
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;

    // Get everything after 'upload'
    const afterUpload = parts.slice(uploadIndex + 1);
    
    // Skip version tag if present (v1234567890)
    if (afterUpload[0].startsWith('v') && !isNaN(afterUpload[0].substring(1))) {
      afterUpload.shift();
    }

    // Join remaining parts and remove extension
    const fullPath = afterUpload.join('/');
    const lastDotIndex = fullPath.lastIndexOf('.');
    
    return lastDotIndex !== -1 ? fullPath.substring(0, lastDotIndex) : fullPath;
  } catch (error) {
    logger.error('Error extracting public_id from Cloudinary URL:', error);
    return null;
  }
};

/**
 * Deletes an asset from Cloudinary
 * @param {string} url 
 * @param {string} resourceType - 'image' or 'video'
 */
const deleteAsset = async (url, resourceType = 'image') => {
  const publicId = getPublicIdFromUrl(url);
  if (!publicId) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });
    logger.info(`Cloudinary asset deleted: ${publicId} (Type: ${resourceType}), Result: ${result.result}`);
    return result;
  } catch (error) {
    logger.error(`Failed to delete Cloudinary asset: ${publicId}`, error);
  }
};

module.exports = {
  getPublicIdFromUrl,
  deleteAsset
};
