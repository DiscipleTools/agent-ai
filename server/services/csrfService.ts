import crypto from 'crypto'
import jwt from 'jsonwebtoken'

/**
 * CSRF Token Service
 * 
 * Provides CSRF protection by generating and validating tokens
 * that are tied to user sessions and expire after a reasonable time.
 */
class CSRFService {
  private readonly secret: string
  private readonly tokenExpiry: string = '1h' // CSRF tokens expire in 1 hour

  constructor() {
    this.secret = process.env.CSRF_SECRET || process.env.JWT_SECRET || 'fallback-csrf-secret'
    
    if (!process.env.CSRF_SECRET && !process.env.JWT_SECRET) {
      console.warn('No CSRF_SECRET or JWT_SECRET found. Using fallback secret. This is insecure for production!')
    }
  }

  /**
   * Generate a CSRF token for a user session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session identifier (can be access token ID or session ID)
   * @returns {string} - CSRF token
   */
  generateToken(userId: string, sessionId: string): string {
    const payload = {
      userId,
      sessionId,
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
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'agent-ai-server',
        audience: 'agent-ai-client'
      }) as any

      // Validate token type
      if (decoded.type !== 'csrf') {
        return false
      }

      // Validate user and session match
      return decoded.userId === userId && decoded.sessionId === sessionId
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
      const decoded = jwt.decode(accessToken) as any
      
      // For our JWT tokens, we'll use the issued at time + user ID as session identifier
      // This ensures CSRF tokens are tied to specific login sessions
      if (decoded && decoded.userId && decoded.iat) {
        return `${decoded.userId}-${decoded.iat}`
      }
      
      return null
    } catch (error) {
      return null
    }
  }



  /**
   * Generate CSRF token from request context
   */
  generateFromRequest(event: any): string | null {
    const user = event.context.user
    if (!user || !user._id) {
      return null
    }

    const accessToken = getCookie(event, 'access-token') || 
                       getHeader(event, 'authorization')?.replace('Bearer ', '')

    if (accessToken) {
      const sessionId = this.extractSessionId(accessToken)
      if (sessionId) {
        return this.generateToken(user._id.toString(), sessionId)
      }
    }

    // No session ID available - cannot generate CSRF token
    return null
  }

  /**
   * Validate CSRF token from request
   */
  validateFromRequest(event: any, token: string): boolean {
    const user = event.context.user
    if (!user || !user._id) {
      return false
    }

    const userId = user._id.toString()
    const accessToken = getCookie(event, 'access-token') || 
                       getHeader(event, 'authorization')?.replace('Bearer ', '')
    
    if (accessToken) {
      const sessionId = this.extractSessionId(accessToken)
      if (sessionId) {
        return this.validateToken(token, userId, sessionId)
      }
    }

    // No session ID available - cannot validate CSRF token
    return false
  }
}

// Export singleton instance
export default new CSRFService() 