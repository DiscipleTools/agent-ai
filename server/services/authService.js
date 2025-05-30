import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import User from '../models/User.js'

class AuthService {
  /**
   * Generate access and refresh tokens for a user
   * @param {string} userId - User ID
   * @returns {Object} Object containing accessToken and refreshToken
   */
  generateTokens(userId) {
    const config = useRuntimeConfig()
    
    const accessToken = jwt.sign(
      { 
        userId,
        type: 'access'
      },
      config.jwtSecret,
      { 
        expiresIn: config.jwtExpire || '1h',
        issuer: 'agent-ai-server',
        audience: 'agent-ai-client'
      }
    );

    const refreshToken = jwt.sign(
      { 
        userId, 
        type: 'refresh',
        tokenId: crypto.randomBytes(16).toString('hex')
      },
      config.jwtRefreshSecret,
      { 
        expiresIn: config.jwtRefreshExpire || '7d',
        issuer: 'agent-ai-server',
        audience: 'agent-ai-client'
      }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   * @param {string} token - JWT access token
   * @returns {Object} Decoded token payload
   */
  async verifyAccessToken(token) {
    try {
      const config = useRuntimeConfig()
      const decoded = jwt.verify(token, config.jwtSecret, {
        issuer: 'agent-ai-server',
        audience: 'agent-ai-client'
      });

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token
   * @returns {Object} Decoded token payload
   */
  async verifyRefreshToken(token) {
    try {
      const config = useRuntimeConfig()
      const decoded = jwt.verify(token, config.jwtRefreshSecret, {
        issuer: 'agent-ai-server',
        audience: 'agent-ai-client'
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Authenticate user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} User data and tokens
   */
  async login(email, password) {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokens = this.generateTokens(user._id);
      
      // Store refresh token and update last login
      user.addRefreshToken(tokens.refreshToken);
      user.lastLogin = new Date();
      await user.save();

      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLogin: user.lastLogin
        },
        tokens
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @returns {Object} New tokens
   */
  async refreshTokens(refreshToken) {
    try {
      // Verify refresh token
      const decoded = await this.verifyRefreshToken(refreshToken);
      
      // Find user and check if refresh token exists
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      if (!user.refreshTokens.includes(refreshToken)) {
        throw new Error('Invalid refresh token');
      }

      // Remove old refresh token and generate new tokens
      user.removeRefreshToken(refreshToken);
      const newTokens = this.generateTokens(user._id);
      user.addRefreshToken(newTokens.refreshToken);
      await user.save();

      return newTokens;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout user by removing refresh token
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token to remove
   */
  async logout(userId, refreshToken) {
    try {
      const user = await User.findById(userId);
      if (user) {
        user.removeRefreshToken(refreshToken);
        await user.save();
      }
    } catch (error) {
      // Log error but don't throw - logout should always succeed
      console.error('Logout error:', error);
    }
  }

  /**
   * Logout user from all devices by clearing all refresh tokens
   * @param {string} userId - User ID
   */
  async logoutAll(userId) {
    try {
      const user = await User.findById(userId);
      if (user) {
        user.clearRefreshTokens();
        await user.save();
      }
    } catch (error) {
      console.error('Logout all error:', error);
    }
  }

  /**
   * Get user by ID (for authentication middleware)
   * @param {string} userId - User ID
   * @returns {Object} User data
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select('-password -refreshTokens');
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default AuthService 