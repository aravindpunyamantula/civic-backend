const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const deleteUsers = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      console.error('MONGO_URI is not defined in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const usersToDelete = [
      { rollNumber: '23A91A6171' },
      { username: 'mani_shankar005' },
      { username: 'mohan manishankar' }
    ];

    for (const query of usersToDelete) {
      const result = await User.deleteMany(query);
      console.log(`Deleted ${result.deletedCount} users matching query: ${JSON.stringify(query)}`);
    }

    console.log('User deletion process completed.');
    process.exit(0);
  } catch (err) {
    console.error('Error deleting users:', err);
    process.exit(1);
  }
};

deleteUsers();
