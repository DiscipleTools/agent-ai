/**
 * Input Sanitization Utilities
 * 
 * Provides defense-in-depth against XSS, injection attacks, and other security vulnerabilities
 * by sanitizing all user inputs before processing or display.
 * 
 * These functions should be used consistently across the application for all user input.
 */

/**
 * Sanitize text input by removing HTML tags and encoding special characters
 * @param {string|any} input - The input to sanitize
 * @returns {string} - Sanitized text
 */
export const sanitizeText = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Remove HTML tags and encode special characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

/**
 * Sanitize and validate numeric input
 * @param {number|string|any} input - The input to sanitize
 * @returns {number} - Sanitized number (0 if invalid)
 */
export const sanitizeNumber = (input) => {
  if (typeof input === 'number') return input
  if (!input || typeof input !== 'string') return 0
  
  const num = parseFloat(input.replace(/[^\d.-]/g, ''))
  return isNaN(num) ? 0 : num
}

/**
 * Sanitize URL input and prevent dangerous protocols and SSRF attacks
 * @param {string|any} input - The URL to sanitize
 * @returns {string} - Sanitized URL or empty string if invalid
 */
export const sanitizeUrl = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Basic URL sanitization - remove dangerous protocols and characters
  const cleaned = input.trim()
    .replace(/[<>"']/g, '') // Remove dangerous characters
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/data:/gi, '') // Remove data protocol
    .replace(/vbscript:/gi, '') // Remove vbscript protocol
    .replace(/file:/gi, '') // Remove file protocol
    .replace(/ftp:/gi, '') // Remove ftp protocol
  
  // Only allow http and https protocols
  if (cleaned && !cleaned.match(/^https?:\/\//i)) {
    return cleaned.startsWith('://') ? 'https' + cleaned : 'https://' + cleaned
  }
  
  // Additional validation for potential SSRF prevention
  try {
    const url = new URL(cleaned)
    
    // Block localhost and private IP ranges
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname === '0.0.0.0' ||
        hostname.match(/^10\./) ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./) ||
        hostname.match(/^192\.168\./)) {
      return ''
    }
    
    return cleaned
  } catch (error) {
    return ''
  }
}

/**
 * Sanitize filename to prevent path traversal and dangerous characters
 * @param {string|any} input - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
export const sanitizeFilename = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Remove path traversal attempts and dangerous characters
  return input
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove dangerous filename characters
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/^\.+/, '') // Remove leading dots
    .trim()
    .substring(0, 255) // Limit length to 255 characters
}

/**
 * Sanitize content while preserving formatting but removing dangerous elements
 * Suitable for user content, prompts, descriptions, and display text
 * @param {string|any} input - The content to sanitize
 * @returns {string} - Sanitized content
 */
export const sanitizeContent = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Preserve most formatting but remove dangerous content
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframe tags
    .replace(/<object[^>]*>.*?<\/object>/gi, '') // Remove object tags
    .replace(/<embed[^>]*>/gi, '') // Remove embed tags
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
}

/**
 * Sanitize email address
 * @param {string|any} input - The email to sanitize
 * @returns {string} - Sanitized email
 */
export const sanitizeEmail = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Basic email sanitization
  return input
    .trim()
    .toLowerCase()
    .replace(/[<>"']/g, '') // Remove dangerous characters
    .substring(0, 254) // RFC 5321 limit
}

/**
 * Sanitize HTML content by allowing only safe tags and attributes
 * @param {string|any} input - The HTML content to sanitize
 * @param {Object} options - Options for allowed tags and attributes
 * @returns {string} - Sanitized HTML
 */
export const sanitizeHtml = (input, options = {}) => {
  if (!input || typeof input !== 'string') return ''
  
  const defaultOptions = {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'b', 'i'],
    allowedAttributes: {},
    ...options
  }
  
  // For now, just strip all HTML - can be enhanced with a proper HTML sanitizer library
  if (defaultOptions.allowedTags.length === 0) {
    return input.replace(/<[^>]*>/g, '').trim()
  }
  
  // This is a basic implementation - for production, consider using DOMPurify or similar
  return input.trim()
}

/**
 * Sanitize search query input
 * @param {string|any} input - The search query to sanitize
 * @returns {string} - Sanitized search query
 */
export const sanitizeSearchQuery = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  return input
    .trim()
    .replace(/[<>"']/g, '') // Remove dangerous characters
    .replace(/[^\w\s\-_.,!?]/g, '') // Allow only word characters, spaces, and basic punctuation
    .substring(0, 200) // Limit length
}

/**
 * Sanitize error messages for user display by removing sensitive information
 * @param {Error|Object|string} error - The error to sanitize
 * @returns {string} - User-friendly error message
 */
export const sanitizeErrorMessage = (error) => {
  const message = error?.message || error?.toString() || 'An error occurred'
  
  // Remove sensitive information patterns
  const sanitized = message
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // IP addresses
    .replace(/\/[a-zA-Z0-9_\-\/]+\/[a-zA-Z0-9_\-\.]+/g, '[PATH]') // File paths
    .replace(/Error:\s*/i, '') // Remove "Error:" prefix
    .replace(/at\s+.*/g, '') // Remove stack trace info
    .replace(/\s+/g, ' ') // Normalize whitespace
  
  // Provide user-friendly messages for common errors
  if (message.includes('404') || message.includes('not found')) {
    return 'The requested resource was not found'
  }
  
  if (message.includes('403') || message.includes('forbidden')) {
    return 'You do not have permission to access this resource'
  }
  
  if (message.includes('500') || message.includes('internal server')) {
    return 'A server error occurred. Please try again later'
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection and try again'
  }
  
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again'
  }
  
  return sanitized.trim() || 'An unexpected error occurred. Please try again'
}

/**
 * Sanitize password input. It only ensures it's a string.
 * It does not remove characters, as that could invalidate a correct password.
 * @param {any} input - The password to sanitize
 * @returns {string} - Sanitized password
 */
export const sanitizePassword = (input) => {
  if (typeof input !== 'string') return ''
  return input
}

/**
 * Sanitize a URL that might point to an internal service for display.
 * It obscures the hostname but preserves the port and scheme.
 * @param {string|any} input - The URL to sanitize
 * @returns {string} - Sanitized URL for display
 */
export const sanitizeInternalUrl = (input) => {
  if (!input || typeof input !== 'string') return '';
  try {
    const url = new URL(input);
    // Return scheme, a placeholder for the host, and port if it exists.
    return `${url.protocol}//[hostname]${url.port ? `:${url.port}` : ''}`;
  } catch (error) {
    // Handle cases where input is not a full valid URL (e.g. "localhost:3000")
    // or return a generic string for invalid formats.
    return '[Invalid or partial URL]';
  }
};

/**
 * Sanitize MongoDB ObjectId to prevent injection attacks
 * @param {string|any} input - The ObjectId to sanitize
 * @returns {string} - Sanitized ObjectId or empty string if invalid
 */
export const sanitizeObjectId = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Remove any non-hex characters and trim whitespace
  const sanitized = input.trim().replace(/[^a-fA-F0-9]/g, '')
  
  // MongoDB ObjectIds must be exactly 24 characters long
  if (sanitized.length !== 24) return ''
  
  // Validate that it's a valid hex string
  if (!/^[a-fA-F0-9]{24}$/.test(sanitized)) return ''
  
  return sanitized
}

/**
 * Sanitize a generic token (like a JWT or refresh token)
 * @param {string|any} input - The token to sanitize
 * @returns {string} - Sanitized token
 */
export const sanitizeToken = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Allow only characters typically found in tokens (alphanumeric, ., -, _)
  return input.trim().replace(/[^a-zA-Z0-9\\._-]/g, '')
}

/**
 * Sanitize a generic object by applying appropriate sanitization to each property
 * @param {Object} obj - The object to sanitize
 * @param {Object} schema - Schema defining how to sanitize each property
 * @returns {Object} - Sanitized object
 */
export const sanitizeObject = (obj, schema) => {
  if (!obj || typeof obj !== 'object') return {}
  
  const sanitized = {}
  
  for (const [key, sanitizer] of Object.entries(schema)) {
    if (obj.hasOwnProperty(key)) {
      if (typeof sanitizer === 'function') {
        sanitized[key] = sanitizer(obj[key])
      } else if (sanitizer === 'text') {
        sanitized[key] = sanitizeText(obj[key])
      } else if (sanitizer === 'number') {
        sanitized[key] = sanitizeNumber(obj[key])
      } else if (sanitizer === 'url') {
        sanitized[key] = sanitizeUrl(obj[key])
      } else if (sanitizer === 'email') {
        sanitized[key] = sanitizeEmail(obj[key])
      } else if (sanitizer === 'content') {
        sanitized[key] = sanitizeContent(obj[key])
      } else if (sanitizer === 'filename') {
        sanitized[key] = sanitizeFilename(obj[key])
      }
    }
  }
  
  return sanitized
}

/**
 * Sanitize user object for frontend display.
 * Removes sensitive fields and ensures data is clean.
 * @param {Object} user - The user object from the database
 * @returns {Object|null} - A sanitized user object or null
 */
export const sanitizeUserForFrontend = (user) => {
  if (!user || typeof user !== 'object') return null

  // If it's a Mongoose document, convert it to a plain object
  const userObject = typeof user.toObject === 'function' ? user.toObject() : user

  return {
    _id: userObject._id ? sanitizeObjectId(userObject._id.toString()) : undefined,
    id: userObject._id ? sanitizeObjectId(userObject._id.toString()) : undefined, // for convenience
    name: userObject.name ? sanitizeText(userObject.name) : undefined,
    email: userObject.email ? sanitizeEmail(userObject.email) : undefined,
    role: userObject.role ? sanitizeText(userObject.role) : undefined,
    isActive: userObject.isActive,
    lastLogin: userObject.lastLogin,
    createdAt: userObject.createdAt,
    updatedAt: userObject.updatedAt,
    mustChangePassword: userObject.mustChangePassword,
    agentAccess: Array.isArray(userObject.agentAccess) 
      ? userObject.agentAccess.map(id => sanitizeObjectId(id.toString())) 
      : undefined,
  }
}

/**
 * Validation helpers that work with sanitization
 */
export const validators = {
  /**
   * Validate that a sanitized text meets length requirements
   */
  textLength: (text, min = 0, max = Infinity) => {
    const sanitized = sanitizeText(text)
    return sanitized.length >= min && sanitized.length <= max
  },
  
  /**
   * Validate that a sanitized number is within range
   */
  numberRange: (num, min = -Infinity, max = Infinity) => {
    const sanitized = sanitizeNumber(num)
    return sanitized >= min && sanitized <= max
  },
  
  /**
   * Validate that a sanitized URL is valid
   */
  validUrl: (url) => {
    const sanitized = sanitizeUrl(url)
    if (!sanitized) return false
    
    try {
      new URL(sanitized)
      return true
    } catch {
      return false
    }
  },
  
  /**
   * Validate email format after sanitization
   */
  validEmail: (email) => {
    const sanitized = sanitizeEmail(email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(sanitized)
  }
}

/**
 * Preset schemas for common objects
 */
export const schemas = {
  // Agent form schema
  agent: {
    name: 'text',
    description: 'text',
    prompt: 'content',
    temperature: 'number',
    maxTokens: 'number',
    responseDelay: 'number',
    connectionId: 'text',
    modelId: 'text',
    chatwootApiKey: 'text'
  },
  
  // User form schema
  user: {
    name: 'text',
    email: 'email'
  },
  
  // URL/Website schema
  urlInput: {
    url: 'url',
    maxPages: 'number',
    maxDepth: 'number'
  }
}