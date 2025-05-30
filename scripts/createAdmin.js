import mongoose from 'mongoose'
import User from '../server/models/User.js'
import dotenv from 'dotenv'

dotenv.config()

const createAdminUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Get admin details from command line arguments or use defaults
    const email = process.argv[2] || 'admin@example.com';
    const name = process.argv[3] || 'Admin User';
    const password = process.argv[4] || 'AdminPassword123';

    // Create admin user
    const adminUser = new User({
      email,
      name,
      password,
      role: 'admin',
      isActive: true
    });

    await adminUser.save();

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', email);
    console.log('👤 Name:', name);
    console.log('🔑 Password:', password);
    console.log('');
    console.log('⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run the script
createAdminUser(); 