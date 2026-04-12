const User = require('../models/User');
const { clearMultiplePrefixes } = require('../utils/cacheUtils');
const logger = require('../middleware/logger');

// Signup logic
exports.signup = async (req, res, next) => {
  try {
    const { username, password, email, fullName, campus, branch, rollNumber } = req.body;

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
    const rollNo = emailParts[0];
    const finalUsername = rollNo;
    const finalRollNumber = rollNo;

    // Roll Number Validation (Extract from email prefix if not provided, or validate if provided)
    if (rollNo.length !== 10) {
      return res.status(400).json({ message: 'Email prefix must be a 10-digit roll number' });
    }

    // Password Complexity Validation
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passRegex.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters, and include uppercase, lowercase, number, and special character' });
    }

    const validBranches = ["CSE", "IT", "AIML", "AI-DS", "IOT", "ECE", "EEE", "MECH", "CIVIL", "PT-MINING", "CHEMICAL"];

    if (!validBranches.includes(branch)) {
      return res.status(400).json({ message: 'Invalid branch selected' });
    }

    // Check if user already exists (by email or username)
    const existingUser = await User.findOne({ $or: [{ username: finalUsername }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with that roll number or email already exists' });
    }

    // Create new user (password is automatically hashed by the Mongoose pre-save hook)
    const newUser = new User({
      username: finalUsername,
      email,
      fullName,
      rollNumber: finalRollNumber,
      campus: mappedCampus,
      branch,
      password,
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

    // Find the user by username or email
    const user = await User.findOne({ $or: [{ username: username }, { email: username }] });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact the administrator.' });
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
        isAdmin: user.isAdmin
      },
    });
  } catch (err) {
    next(err);
  }
};
