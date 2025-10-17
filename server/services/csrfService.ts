/**
 * CSRF Token Service
 * 
 * Service for generating and validating CSRF tokens to protect against Cross-Site Request Forgery attacks.
 * Provides token generation tied to user sessions, validation methods, and request context helpers.
 */

import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { getCookie, getHeader } from 'h3'
import { sanitizeToken, sanitizeObjectId } from '~/utils/sanitize.js'

/**
 * CSRF Token Service
 * 
 * Provides CSRF protection by generating and validating tokens
 * that are tied to user sessions and expire after a reasonable time.
 */
class CSRFService {
  private readonly secret: string
  private readonly jwtSecret: string
  private readonly tokenExpiry: string = '1h' // CSRF tokens expire in 1 hour

  constructor() {
    // Use separate secret for CSRF tokens if available
    const csrfSecret = process.env.CSRF_SECRET || process.env.JWT_SECRET

    if (!csrfSecret || !process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be configured for CSRF protection')
    }

    this.secret = csrfSecret
    this.jwtSecret = process.env.JWT_SECRET // Always use JWT_SECRET to verify access tokens
  }

  /**
   * Generate a CSRF token for a user session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session identifier (can be access token ID or session ID)
   * @returns {string} - CSRF token
   */
  generateToken(userId: string, sessionId: string): string {
    // Sanitize inputs
    const sanitizedUserId = sanitizeObjectId(userId)
    const sanitizedSessionId = sanitizeToken(sessionId)
    
    if (!sanitizedUserId || !sanitizedSessionId) {
      throw new Error('Invalid userId or sessionId provided')
    }

    const payload = {
      userId: sanitizedUserId,
      sessionId: sanitizedSessionId,
      type: 'csrf',
      nonce: crypto.randomBytes(16).toString('hex'), // Add randomness
      iat: Math.floor(Date.now() / 1000)
    }

    return jwt.sign(payload, this.secret, {
      expiresIn: this.tokenExpiry,
      issuer: 'agent-ai-server',
      audience: 'agent-ai-client'
    } as jwt.SignOptions)
  }

  /**
   * Validate a CSRF token against user session
   * @param {string} token - CSRF token to validate
   * @param {string} userId - Expected user ID
   * @param {string} sessionId - Expected session identifier
   * @returns {boolean} - Whether token is valid
   */
  validateToken(token: string, userId: string, sessionId: string): boolean {
    try {
      // Sanitize inputs
      const sanitizedToken = sanitizeToken(token)
      const sanitizedUserId = sanitizeObjectId(userId)
      const sanitizedSessionId = sanitizeToken(sessionId)
      
      if (!sanitizedToken || !sanitizedUserId || !sanitizedSessionId) {
        return false
      }

      const decoded = jwt.verify(sanitizedToken, this.secret, {
        issuer: 'agent-ai-server',
        audience: 'agent-ai-client'
      }) as any

      // Validate token type
      if (decoded.type !== 'csrf') {
        return false
      }

      // Validate user and session match
      return decoded.userId === sanitizedUserId && decoded.sessionId === sanitizedSessionId
    } catch (error) {
      // Token is invalid, expired, or malformed
      return false
    }
  }

  /**
   * Extract session ID from JWT access token
   * @param {string} accessToken - JWT access token
   * @returns {string|null} - Session ID or null if invalid
   */
  extractSessionId(accessToken: string): string | null {
    try {
      // Sanitize token input
      const sanitizedToken = sanitizeToken(accessToken)
      if (!sanitizedToken) {
        return null
      }

      // IMPORTANT: Use jwtSecret (not this.secret) to verify access tokens
      // Access tokens are signed with JWT_SECRET, not CSRF_SECRET
      const decoded = jwt.verify(sanitizedToken, this.jwtSecret) as any

      // For our JWT tokens, we'll use the issued at time + user ID as session identifier
      // This ensures CSRF tokens are tied to specific login sessions
      if (decoded && decoded.userId && decoded.iat) {
        const sanitizedUserId = sanitizeObjectId(decoded.userId.toString())
        if (sanitizedUserId) {
          return `${sanitizedUserId}-${decoded.iat}`
        }
      }

      return null
    } catch (error: any) {
      // Invalid token
      return null
    }
  }

  /**
   * Generate CSRF token from request context
   */
  generateFromRequest(event: any): string | null {
    try {
      const user = event.context.user
      if (!user || !user._id) {
        return null
      }

      const sanitizedUserId = sanitizeObjectId(user._id.toString())
      if (!sanitizedUserId) {
        return null
      }

      const accessToken = getCookie(event, 'access-token') ||
                         getHeader(event, 'authorization')?.replace('Bearer ', '')

      if (!accessToken) {
        return null
      }

      const sessionId = this.extractSessionId(accessToken)
      if (!sessionId) {
        return null
      }

      return this.generateToken(sanitizedUserId, sessionId)
    } catch (error) {
      // Error generating token
      return null
    }
  }

  /**
   * Validate CSRF token from request
   */
  validateFromRequest(event: any, token: string): boolean {
    try {
      const user = event.context.user
      if (!user || !user._id) {
        return false
      }

      const sanitizedUserId = sanitizeObjectId(user._id.toString())
      if (!sanitizedUserId) {
        return false
      }

      const accessToken = getCookie(event, 'access-token') ||
                         getHeader(event, 'authorization')?.replace('Bearer ', '')

      if (!accessToken) {
        return false
      }

      const sessionId = this.extractSessionId(accessToken)
      if (!sessionId) {
        return false
      }

      return this.validateToken(token, sanitizedUserId, sessionId)
    } catch (error) {
      // Error validating token
      return false
    }
  }
}

// Export singleton instance
export default new CSRFService() 