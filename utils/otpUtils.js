const crypto = require('crypto');

const OTP_SECRET = process.env.OTP_SECRET;
if (!OTP_SECRET) {
  console.error('CRITICAL: OTP_SECRET not set in environment variables');
}

/**
 * Generates a random 6-digit OTP
 */
exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generates a verification token (HMAC hash)
 * @param {string} identifier - Email or User ID
 * @param {string} otp - The 6-digit OTP
 * @param {number} expiry - Expiry timestamp in milliseconds
 */
exports.generateOTPToken = (identifier, otp, expiry) => {
  const data = `${identifier}|${otp}|${expiry}`;
  return crypto.createHmac('sha256', OTP_SECRET).update(data).digest('hex');
};

/**
 * Verifies if the provided OTP matches the hash
 * @param {string} identifier - Email or User ID
 * @param {string} otp - The 6-digit OTP provided by user
 * @param {number} expiry - Expiry timestamp provided by frontend
 * @param {string} hash - The hash (token) provided by frontend
 */
exports.verifyOTPToken = (identifier, otp, expiry, hash) => {
  // Check if expired
  if (Date.now() > expiry) {
    return false;
  }

  const expectedHash = this.generateOTPToken(identifier, otp, expiry);
  return expectedHash === hash;
};
