import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

interface IUser extends mongoose.Document {
  email: string
  name: string
  password: string
  role: 'admin' | 'user'
  isActive: boolean
  agentAccess: mongoose.Types.ObjectId[]
  invitedBy?: mongoose.Types.ObjectId
  invitationToken?: string
  invitationTokenExpires?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
  lastLogin?: Date
  refreshTokens: string[]
  comparePassword(candidatePassword: string): Promise<boolean>
  createInvitationToken(): string
  createPasswordResetToken(): string
  addRefreshToken(token: string): void
  removeRefreshToken(token: string): void
  clearRefreshTokens(): void
}

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'user'],
      message: 'Role must be either admin or user'
    },
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
  invitationToken: {
    type: String,
    required: false,
    select: false // Don't include in queries by default
  },
  invitationTokenExpires: {
    type: Date,
    required: false,
    select: false // Don't include in queries by default
  },
  passwordResetToken: {
    type: String,
    required: false,
    select: false // Don't include in queries by default
  },
  passwordResetExpires: {
    type: Date,
    required: false,
    select: false // Don't include in queries by default
  },
  lastLogin: {
    type: Date
  },
  refreshTokens: {
    type: [String],
    default: [],
    select: false // Don't include in queries by default
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.invitationToken;
      delete ret.invitationTokenExpires;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      return ret;
    }
  }
});

// Indexes for better performance (removed duplicate email index)
userSchema.index({ isActive: 1 });
userSchema.index({ invitationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate invitation token
userSchema.methods.createInvitationToken = function(): string {
  const token = crypto.randomBytes(32).toString('hex');
  
  this.invitationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.invitationTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  
  return token;
};

// Instance method to generate password reset token
userSchema.methods.createPasswordResetToken = function(): string {
  const token = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return token;
};

// Instance method to add refresh token
userSchema.methods.addRefreshToken = function(token: string): void {
  // Initialize refreshTokens array if it doesn't exist
  if (!this.refreshTokens) {
    this.refreshTokens = [];
  }
  
  // Limit to 5 refresh tokens per user (5 devices)
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift(); // Remove oldest token
  }
  this.refreshTokens.push(token);
};

// Instance method to remove refresh token
userSchema.methods.removeRefreshToken = function(token: string): void {
  if (!this.refreshTokens) {
    this.refreshTokens = [];
    return;
  }
  this.refreshTokens = this.refreshTokens.filter((t: string) => t !== token);
};

// Instance method to clear all refresh tokens
userSchema.methods.clearRefreshTokens = function(): void {
  this.refreshTokens = [];
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase(), isActive: true }).select('+refreshTokens');
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find users by role
userSchema.statics.findByRole = function(role: string) {
  return this.find({ role, isActive: true });
};

// Virtual for user's full profile
userSchema.virtual('profile').get(function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    role: this.role,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
});

const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User; 