const nodemailer = require('nodemailer');
const logger = require('../middleware/logger');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'thecivic.9@gmail.com',
    pass: process.env.EMAIL_PASSWORD, // User should provide this in .env (App Password)
  },
});

exports.sendOTPEmail = async (email, otp, type = 'verification') => {
  const subject = type === 'verification' ? 'CIVIC - Email Verification OTP' : 'CIVIC - Password Reset OTP';
  const actionText = type === 'verification' ? 'verify your email address' : 'reset your password';

  const mailOptions = {
    from: '"CIVIC Team" <thecivic.9@gmail.com>',
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">CIVIC</h2>
        <p>Hello,</p>
        <p>You requested to ${actionText}. Please use the following One-Time Password (OTP) to complete the process:</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          © 2026 CIVIC - Student Collaborator Community
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP Email sent to ${email} for ${type}`);
    return true;
  } catch (error) {
    logger.error('Error sending OTP Email:', error);
    return false;
  }
};
