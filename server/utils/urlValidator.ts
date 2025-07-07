/**
 * URL Validation Utilities
 * 
 * Provides security-focused URL validation to prevent SSRF attacks
 * and ensure only allowed URLs are processed by the application.
 * 
 * All validation functions use the same core logic for consistency:
 * - Protocol validation (HTTP/HTTPS only)
 * - Private IP address blocking
 * - Configurable blocked domain checking
 * - URL normalization and sanitization
 */

import validator from 'validator'
import urlParse from 'url-parse'



// Default blocked domains for security
const DEFAULT_BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com'
]

/**
 * Check if hostname is a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // Check for IPv4 private ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = hostname.match(ipv4Regex)
  
  if (match) {
    const [, a, b, c, d] = match.map(Number)
    
    // Private IPv4 ranges
    if (a === 10) return true // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 127) return true // 127.0.0.0/8 (localhost)
    if (a === 169 && b === 254) return true // 169.254.0.0/16 (link-local)
  }

  // Check for IPv6 private ranges (simplified)
  if (hostname.includes(':')) {
    if (hostname.startsWith('::1') || hostname.startsWith('fc') || hostname.startsWith('fd')) {
      return true
    }
  }

  return false
}

/**
 * Validates if a URL is allowed for processing by the application.
 * Blocks private/internal IP ranges and localhost to prevent SSRF attacks.
 * 
 * @param url - The URL string to validate
 * @param blockedDomains - Optional array of additional blocked domains
 * @returns boolean - True if the URL is allowed, false otherwise
 */
export function isAllowedUrl(url: string, blockedDomains: string[] = []): boolean {
  const result = validateUrl(url, blockedDomains)
  return result.isValid
}

/**
 * Comprehensive URL validation with detailed response
 * 
 * @param url - The URL string to validate
 * @param blockedDomains - Optional array of additional blocked domains
 * @returns Object with validation result, error message, and normalized URL
 */
export function validateUrl(url: string, blockedDomains: string[] = []): { 
  isValid: boolean; 
  error?: string; 
  normalizedUrl?: string 
} {
  try {
    // Basic URL validation
    if (!validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false
    })) {
      return { isValid: false, error: 'Invalid URL format' }
    }

    const parsedUrl = urlParse(url, true)
    
    // Check for blocked domains
    const hostname = parsedUrl.hostname?.toLowerCase()
    if (!hostname) {
      return { isValid: false, error: 'Invalid hostname' }
    }

    // Check against default blocked domains
    const allBlockedDomains = [...DEFAULT_BLOCKED_DOMAINS, ...blockedDomains]
    for (const blockedDomain of allBlockedDomains) {
      if (hostname === blockedDomain || hostname.endsWith(`.${blockedDomain}`)) {
        return { isValid: false, error: `Domain ${hostname} is not allowed` }
      }
    }

    // Check for private/local IP addresses
    if (isPrivateIP(hostname)) {
      return { isValid: false, error: 'Private IP addresses are not allowed' }
    }

    // Normalize URL - remove fragment and keep it simple to avoid query string issues
    const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`

    return { isValid: true, normalizedUrl }
  } catch (error) {
    return { isValid: false, error: 'URL validation failed' }
  }
}

/**
 * Validates and throws an error if URL is not allowed.
 * Convenience function for endpoint handlers.
 * 
 * @param url - The URL string to validate
 * @param blockedDomains - Optional array of additional blocked domains
 * @throws Error with descriptive message if URL is not allowed
 */
export function validateUrlOrThrow(url: string, blockedDomains: string[] = []): void {
  const result = validateUrl(url, blockedDomains)
  if (!result.isValid) {
    throw new Error(`URL validation failed: ${result.error}`)
  }
} 