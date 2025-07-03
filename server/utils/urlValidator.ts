/**
 * URL Validation Utilities
 * 
 * Provides security-focused URL validation to prevent SSRF attacks
 * and ensure only allowed URLs are processed by the application.
 */

// Security constants
const ALLOWED_URL_PROTOCOLS = ['http:', 'https:']

/**
 * Validates if a URL is allowed for processing by the application.
 * Blocks private/internal IP ranges and localhost to prevent SSRF attacks.
 * 
 * @param url - The URL string to validate
 * @returns boolean - True if the URL is allowed, false otherwise
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    
    // Check protocol - only allow HTTP and HTTPS
    if (!ALLOWED_URL_PROTOCOLS.includes(parsedUrl.protocol)) {
      return false
    }
    
    // Block private/internal IP ranges to prevent SSRF
    const hostname = parsedUrl.hostname.toLowerCase()
    
    // Block localhost and private IPs
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^172\.(1[6-9]|2\d|3[01])\./) ||
        hostname.startsWith('169.254.') ||
        hostname.startsWith('fc00:') ||
        hostname.startsWith('fe80:')) {
      return false
    }
    
    return true
  } catch {
    // Invalid URL format
    return false
  }
}

/**
 * Validates and throws an error if URL is not allowed.
 * Convenience function for endpoint handlers.
 * 
 * @param url - The URL string to validate
 * @throws Error with descriptive message if URL is not allowed
 */
export function validateUrlOrThrow(url: string): void {
  if (!isAllowedUrl(url)) {
    throw new Error('URL not allowed: must use HTTP/HTTPS and cannot target private/internal networks')
  }
} 