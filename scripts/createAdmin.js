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
  agentAccess: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  }],
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastLogin: Date,
  refreshTokens: [String]
}, {
  timestamps: true
})

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)

const createAdminUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);

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
    console.log('🔑 Password: [HIDDEN - Check deployment logs for initial password]');
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