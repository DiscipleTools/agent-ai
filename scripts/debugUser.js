import mongoose from 'mongoose'
import User from '../server/models/User.js'
import dotenv from 'dotenv'

dotenv.config()

const debugUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find the admin user
    const user = await User.findOne({ email: 'admin@example.com' }).select('+refreshTokens +password');
    
    if (user) {
          console.log('User found:');
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Role:', user.role);
    console.log('Password hash: [HIDDEN]');
    console.log('Is Active:', user.isActive);
      
      // Test multiple passwords
      const passwords = ['password123', 'AdminPassword123!', 'admin123', 'admin'];
      
          for (const pwd of passwords) {
        const isValid = await user.comparePassword(pwd);
        console.log(`Password "[HIDDEN]" is valid:`, isValid);
    }
    } else {
      console.log('User not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run the script
debugUser(); 