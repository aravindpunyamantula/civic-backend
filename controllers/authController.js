const User = require('../models/User');
const BannedIdentifier = require('../models/BannedIdentifier');
const { clearMultiplePrefixes } = require('../utils/cacheUtils');
const logger = require('../middleware/logger');

// Signup logic
exports.signup = async (req, res, next) => {
  try {
    const { username, password, email, fullName, campus, branch, rollNumber, phoneNumber, personalEmail } = req.body;

    // Basic type validation to prevent NoSQL injection
    if (typeof username !== 'string' || typeof password !== 'string' || typeof email !== 'string') {
      return res.status(400).json({ message: 'Invalid input types' });
    }

    // Email Domain Validation
    const allowedDomains = ['acoe.edu.in', 'acet.ac.in', 'adityauniversity.in', 'aec.edu.in'];
    const emailParts = email.split('@');
    if (emailParts.length !== 2 || !allowedDomains.includes(emailParts[1])) {
      return res.status(400).json({ message: `Only institutional emails from Aditya University (${allowedDomains.join(', ')}) are allowed` });
    }

    // Auto-map Campus based on Domain
    let mappedCampus = "AUS"; // Default to AUS for adityauniversity.in and aec.edu.in
    if (emailParts[1] === 'acoe.edu.in') mappedCampus = "ACOE";
    else if (emailParts[1] === 'acet.ac.in') mappedCampus = "ACET";

    // Auto-set username as rollNumber from email prefix
    const rollNo = emailParts[0].toLowerCase();
    const finalUsername = rollNo;
    const finalRollNumber = rollNo;
    const finalEmail = email.toLowerCase();

    // Roll Number Validation (Extract from email prefix if not provided, or validate if provided)
    if (rollNo.length !== 10) {
      return res.status(400).json({ message: 'Email prefix must be a 10-digit roll number' });
    }

    // Password Complexity Validation
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passRegex.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters, and include uppercase, lowercase, number, and special character' });
    }

    const validBranches = ["CSE", "IT", "AIML", "AI-DS", "IOT", "ECE", "EEE", "MECH", "CIVIL", "CHEMICAL", "AGRICULTURE", "PT-MINING"];

    if (!validBranches.includes(branch)) {
      return res.status(400).json({ message: `Invalid branch selected. Allowed branches: ${validBranches.join(', ')}` });
    }

    // Check for banned identifiers
    const banned = await BannedIdentifier.findOne({
      $or: [
        { value: email },
        { value: finalRollNumber },
        { value: phoneNumber },
        { value: personalEmail }
      ].filter(item => item.value)
    });

    if (banned) {
      return res.status(403).json({ message: 'This account or its identifiers are permanently banned from the platform.' });
    }

    // Check if user already exists (by email or username)
    const existingUser = await User.findOne({ $or: [{ username: finalUsername }, { email: finalEmail }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with that roll number or email already exists' });
    }

    // Create new user (password is automatically hashed by the Mongoose pre-save hook)
    const newUser = new User({
      username: finalUsername,
      email: finalEmail,
      fullName,
      rollNumber: finalRollNumber,
      campus: mappedCampus,
      branch,
      password,
      phoneNumber: phoneNumber || '',
      personalEmail: personalEmail || '',
    });

    await newUser.save();
    await clearMultiplePrefixes(['user_search']);
    logger.info(`New user registered: ${newUser.username}`);

    const token = newUser.generateAuthToken();
    const refreshToken = newUser.generateRefreshToken();

    res.status(201).json({ 
      message: 'User created successfully',
      token,
      refreshToken,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        rollNumber: newUser.rollNumber,
        campus: newUser.campus,
        branch: newUser.branch
      }
    });
  } catch (err) {
    next(err);
  }
};

// Login logic
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body; 

    // Prevent NoSQL injection
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid input types' });
    }

    // Find the user by username, email, or rollNumber (case-insensitive)
    const login = username.toLowerCase();
    const user = await User.findOne({ 
      $or: [
        { username: login }, 
        { email: login }, 
        { rollNumber: login }
      ] 
    });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact the administrator.' });
    }

    if (user.isPermanentlyBanned) {
      return res.status(403).json({ message: 'Your account has been permanently banned.' });
    }

    if (user.suspensionExpiresAt && user.suspensionExpiresAt > new Date()) {
      const remainingDays = Math.ceil((user.suspensionExpiresAt - new Date()) / (1000 * 60 * 60 * 24));
      return res.status(403).json({ 
        message: `Your account is suspended for ${remainingDays} more days contact to higher authorities.`,
        suspensionExpiresAt: user.suspensionExpiresAt
      });
    }

    // Validate password using the model's instance method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Generate JWT tokens using the model's instance methods
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    res.status(200).json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        rollNumber: user.rollNumber,
        campus: user.campus,
        branch: user.branch,
        isAdmin: user.isAdmin,
        warningExpiresAt: user.warningExpiresAt,
        warningMessage: user.warningMessage
      },
    });
  } catch (err) {
    next(err);
  }
};
