import { URL } from 'url'

/**
 * MongoDB Connection String Validator
 * Validates connection strings for same-server setups without SSL requirements
 */

export class ConnectionStringValidator {
  constructor(environment = 'development') {
    this.environment = environment
    this.errors = []
    this.warnings = []
  }

  /**
   * Validate MongoDB connection string
   * @param {string} connectionString - MongoDB URI to validate
   * @returns {object} Validation result with errors and warnings
   */
  validate(connectionString) {
    this.errors = []
    this.warnings = []

    if (!connectionString) {
      this.errors.push('Connection string is required')
      return this.getResult()
    }

    try {
      // Parse the connection string
      const parsed = this.parseConnectionString(connectionString)
      
      // Run validation checks
      this.validateBasicStructure(parsed)
      this.validateAuthentication(parsed)
      this.validateDatabase(parsed)
      this.validateHost(parsed)
      this.validateParameters(parsed)
      this.validateEnvironmentSpecific(parsed)
      
    } catch (error) {
      this.errors.push(`Invalid connection string format: ${error.message}`)
    }

    return this.getResult()
  }

  parseConnectionString(connectionString) {
    // Handle mongodb:// protocol
    if (!connectionString.startsWith('mongodb://')) {
      throw new Error('Connection string must start with mongodb://')
    }

    const url = new URL(connectionString)
    const params = new URLSearchParams(url.search)
    
    return {
      protocol: url.protocol,
      username: url.username,
      password: url.password,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      searchParams: params,
      original: connectionString
    }
  }

  validateBasicStructure(parsed) {
    // Check protocol
    if (parsed.protocol !== 'mongodb:') {
      this.errors.push('Invalid protocol. Must use mongodb://')
    }

    // Check hostname
    if (!parsed.hostname) {
      this.errors.push('Hostname is required')
    }

    // Check port
    if (parsed.port && (isNaN(parsed.port) || parsed.port < 1 || parsed.port > 65535)) {
      this.errors.push('Invalid port number')
    }
  }

  validateAuthentication(parsed) {
    const isProduction = this.environment === 'production'
    const hasAuth = parsed.username && parsed.password

    if (isProduction) {
      // Production requires authentication
      if (!hasAuth) {
        this.errors.push('Authentication (username:password) is required in production')
      } else {
        // Check for placeholder values that weren't replaced
        const placeholderPatterns = [
          /GENERATE.*AUTOMATICALLY/i,
          /placeholder/i,
          /change.*production/i,
          /your.*password/i
        ]

        placeholderPatterns.forEach(pattern => {
          if (pattern.test(parsed.username) || pattern.test(parsed.password)) {
            this.errors.push('Placeholder credentials detected - deployment script may have failed')
          }
        })

        // Check for weak passwords in production
        if (parsed.password.length < 8) {
          this.warnings.push('Password should be at least 8 characters long')
        }

        if (['password', 'admin', '123456', 'mongodb'].includes(parsed.password.toLowerCase())) {
          this.errors.push('Password is too weak for production use')
        }

        // Validate authSource parameter for authenticated connections
        const authSource = parsed.searchParams.get('authSource')
        if (hasAuth && !authSource) {
          this.warnings.push('authSource parameter recommended for authenticated connections')
        }
      }
    } else {
      // Development - authentication is optional but warn if missing for non-localhost
      if (!hasAuth && !this.isLocalhost(parsed.hostname)) {
        this.warnings.push('Authentication recommended for non-localhost connections')
      }
    }
  }

  validateDatabase(parsed) {
    // Check database name
    const dbName = parsed.pathname.replace('/', '')
    
    if (!dbName) {
      this.errors.push('Database name is required')
    } else {
      // Validate database name format
      const invalidChars = /[\/\\. "$*<>:|?]/
      if (invalidChars.test(dbName)) {
        this.errors.push('Database name contains invalid characters')
      }

      // Check if it matches expected database name
      if (dbName !== 'agent-ai-server') {
        this.warnings.push(`Database name '${dbName}' differs from expected 'agent-ai-server'`)
      }
    }
  }

  validateHost(parsed) {
    const isProduction = this.environment === 'production'
    const hostname = parsed.hostname

    if (isProduction) {
      // In production, expect container name or localhost for same-server setup
      const validProductionHosts = ['mongodb', 'localhost', '127.0.0.1']
      if (!validProductionHosts.includes(hostname)) {
        this.warnings.push(`Unexpected hostname '${hostname}' in production. Expected: mongodb (Docker) or localhost`)
      }

      // Check port - MongoDB default is 27017
      const port = parsed.port || '27017'
      if (port !== '27017') {
        this.warnings.push(`Non-standard port ${port}. Default MongoDB port is 27017`)
      }
    } else {
      // Development typically uses localhost
      if (!this.isLocalhost(hostname)) {
        this.warnings.push(`Non-localhost hostname '${hostname}' in development`)
      }
    }
  }

  validateParameters(parsed) {
    const params = parsed.searchParams

    // Check for SSL/TLS parameters (warn about inconsistency with same-server setup)
    if (params.has('ssl') || params.has('tls')) {
      this.warnings.push('SSL/TLS parameters detected but not typically needed for same-server setup')
    }

    // Check for important connection parameters
    const retryWrites = params.get('retryWrites')
    if (retryWrites === 'false') {
      this.warnings.push('retryWrites=false may cause data consistency issues')
    }

    // Validate timeout parameters
    const timeoutParams = ['connectTimeoutMS', 'socketTimeoutMS', 'serverSelectionTimeoutMS']
    timeoutParams.forEach(param => {
      const value = params.get(param)
      if (value && (isNaN(value) || parseInt(value) < 0)) {
        this.errors.push(`Invalid ${param} value: ${value}`)
      }
    })

    // Check read preference
    const readPreference = params.get('readPreference')
    if (readPreference && !['primary', 'secondary', 'nearest'].includes(readPreference)) {
      this.warnings.push(`Unusual readPreference: ${readPreference}`)
    }
  }

  validateEnvironmentSpecific(parsed) {
    // Environment-specific validation
    if (this.environment === 'production') {
      this.validateProductionRequirements(parsed)
    } else if (this.environment === 'development') {
      this.validateDevelopmentSetup(parsed)
    }
  }

  validateProductionRequirements(parsed) {
    // Additional production-specific checks
    const params = parsed.searchParams

    // Recommend connection pooling settings for production
    if (!params.has('maxPoolSize')) {
      this.warnings.push('Consider setting maxPoolSize for production environments')
    }

    // Check for development-only parameters
    if (params.has('debug') || params.has('verbose')) {
      this.warnings.push('Debug parameters detected in production connection string')
    }
  }

  validateDevelopmentSetup(parsed) {
    // Development-specific validation
    if (!this.isLocalhost(parsed.hostname)) {
      this.warnings.push('Development environment using non-localhost database')
    }
  }

  isLocalhost(hostname) {
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  }

  getResult() {
    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      hasWarnings: this.warnings.length > 0
    }
  }

  /**
   * Static method to quickly validate a connection string
   * @param {string} connectionString 
   * @param {string} environment 
   * @returns {object} Validation result
   */
  static validate(connectionString, environment = 'development') {
    const validator = new ConnectionStringValidator(environment)
    return validator.validate(connectionString)
  }
}

export default ConnectionStringValidator 