import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

// User schema (simplified version for the script)
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

const User = mongoose.model('User', userSchema)

const resetAdminPassword = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find admin user
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found');
      process.exit(1);
    }

    // Generate new secure password
    const generateSecurePassword = () => {
      const crypto = require('crypto');
      return crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + 'A1!';
    };

    const newPassword = process.argv[2] || generateSecurePassword();

    // Update password
    adminUser.password = newPassword;
    adminUser.mustChangePassword = true;
    await adminUser.save();

    console.log('✅ Admin password reset successfully!');
    console.log('📧 Email:', adminUser.email);
    console.log('👤 Name:', adminUser.name);
    console.log('🔑 New Password:', newPassword);
    console.log('');
    console.log('⚠️  IMPORTANT: Please change the password after login!');

  } catch (error) {
    console.error('❌ Error resetting admin password:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run the script
resetAdminPassword(); 