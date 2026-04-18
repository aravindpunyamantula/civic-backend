const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const createAdmin = async () => {
    try {
        console.log('Using MONGO_URI:', process.env.MONGO_URI ? 'Defined' : 'UNDEFINED');
        if (!process.env.MONGO_URI) {
            console.error('Error: MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        const adminExists = await User.findOne({ username: 'civic' });

        if (adminExists) {
            console.log('Admin user "civic" already exists. Updating to ensure admin privileges...');
            adminExists.isAdmin = true;
            await adminExists.save();
            console.log('Admin user "civic" updated successfully.');
        } else {
            console.log('Creating admin user "civic"...');
            const adminUser = new User({
                username: 'civic',
                email: 'admin@civic.com',
                fullName: 'Civic Admin',
                rollNumber: 'ADMIN001',
                campus: 'ACET',
                branch: 'IT',
                password: 'civic', // The user requested username civic and we'll use same for password as a start or "civic123"
                isAdmin: true
            });

            await adminUser.save();
            console.log('Admin user "civic" created successfully.');
        }

        process.exit();
    } catch (err) {
        console.error('Error creating admin user:', err);
        process.exit(1);
    }
};

createAdmin();
