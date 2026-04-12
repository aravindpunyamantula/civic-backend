const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const createAdmin = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      console.error('MONGO_URI is not defined in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const username = 'admin_civic';
    const password = 'admincivic';
    const email = 'admin@civic.app';
    const fullName = 'Civic Administrator';
    const rollNumber = 'ADMIN00001';
    const campus = 'AUS';
    const branch = 'CSE';

    // Check if exists
    const existing = await User.findOne({ username });
    if (existing) {
      console.log('Admin user already exists. Updating privileges...');
      existing.isAdmin = true;
      existing.password = password; // Will be hashed by pre-save hook
      await existing.save();
      console.log('Admin user updated.');
    } else {
      const admin = new User({
        username,
        password,
        email,
        fullName,
        rollNumber,
        campus,
        branch,
        isAdmin: true
      });
      await admin.save();
      console.log('Admin user created successfully.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
};

createAdmin();
