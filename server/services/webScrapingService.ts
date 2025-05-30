import { JSDOM } from 'jsdom'
import validator from 'validator'
import sanitizeHtml from 'sanitize-html'
import urlParse from 'url-parse'

interface ScrapedContent {
  content: string
  title?: string
  url: string
  contentType: string
  scrapedAt: Date
}

interface ScrapingOptions {
  maxContentLength?: number
  timeout?: number
  userAgent?: string
  allowedDomains?: string[]
  blockedDomains?: string[]
}

class WebScrapingService {
  private readonly defaultOptions: ScrapingOptions = {
    maxContentLength: 150000, // 150KB max content (increased from 50KB)
    timeout: 10000, // 10 seconds
    userAgent: 'Agent-AI-Server/1.0 (+https://github.com/agent-ai-server)',
    allowedDomains: [],
    blockedDomains: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'tiktok.com'
    ]
  }

  /**
   * Validate and sanitize URL
   */
  private validateUrl(url: string): { isValid: boolean; error?: string; normalizedUrl?: string } {
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

      // Check against blocked domains
      for (const blockedDomain of this.defaultOptions.blockedDomains!) {
        if (hostname === blockedDomain || hostname.endsWith(`.${blockedDomain}`)) {
          return { isValid: false, error: `Domain ${hostname} is not allowed` }
        }
      }

      // Check for private/local IP addresses
      if (this.isPrivateIP(hostname)) {
        return { isValid: false, error: 'Private IP addresses are not allowed' }
      }

      // Normalize URL - keep it simple to avoid query string issues
      const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`

      return { isValid: true, normalizedUrl }
    } catch (error) {
      return { isValid: false, error: 'URL validation failed' }
    }
  }

  /**
   * Check if hostname is a private IP address
   */
  private isPrivateIP(hostname: string): boolean {
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
   * Fetch content from URL with security checks
   */
  private async fetchContent(url: string, options: ScrapingOptions): Promise<{ content: string; contentType: string }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': options.userAgent!,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal,
        redirect: 'follow',
        // Security: Don't send credentials
        credentials: 'omit'
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Check content type
      const contentType = response.headers.get('content-type') || 'text/html'
      
      // Only process text-based content
      if (!contentType.includes('text/') && !contentType.includes('application/json') && !contentType.includes('application/xml')) {
        throw new Error(`Unsupported content type: ${contentType}`)
      }

      // Check content length
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength) > options.maxContentLength!) {
        throw new Error(`Content too large: ${contentLength} bytes (max: ${options.maxContentLength})`)
      }

      const content = await response.text()

      // Double-check content length after download
      if (content.length > options.maxContentLength!) {
        throw new Error(`Content too large: ${content.length} characters (max: ${options.maxContentLength})`)
      }

      return { content, contentType }
    } catch (error: any) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${options.timeout}ms`)
      }
      
      throw error
    }
  }

  /**
   * Extract and clean text content from HTML
   */
  private extractTextFromHtml(html: string, url: string): { content: string; title?: string } {
    // Temporarily skip JSDOM due to CSS parsing issues and use regex-based extraction
    try {
      
      // Extract title using regex
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : undefined
      
      // Remove script and style tags
      let cleanHtml = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      
      // Remove HTML tags and extract text
      let textContent = cleanHtml
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
      
      if (!textContent || textContent.length < 10) {
        throw new Error('Insufficient content extracted')
      }
      
      return { content: textContent, title }
    } catch (error) {
      throw new Error(`Failed to extract text from HTML: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sanitize extracted content
   */
  private sanitizeContent(content: string): string {
    // Remove any remaining HTML tags
    const sanitized = sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {},
      textFilter: (text: string) => {
        // Remove excessive whitespace and normalize
        return text
          .replace(/[\r\n\t]+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
      }
    })

    return sanitized
  }

  /**
   * Main method to scrape content from URL
   */
  async scrapeUrl(url: string, options: Partial<ScrapingOptions> = {}): Promise<ScrapedContent> {
    const mergedOptions = { ...this.defaultOptions, ...options }

    // Validate URL
    const validation = this.validateUrl(url)
    if (!validation.isValid) {
      throw new Error(`URL validation failed: ${validation.error}`)
    }

    const normalizedUrl = validation.normalizedUrl!

    try {

      // Fetch content
      const { content: rawContent, contentType } = await this.fetchContent(normalizedUrl, mergedOptions)

      let extractedContent: string
      let title: string | undefined

      // Process based on content type
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        const extracted = this.extractTextFromHtml(rawContent, normalizedUrl)
        extractedContent = extracted.content
        title = extracted.title
      } else if (contentType.includes('text/plain')) {
        extractedContent = rawContent
      } else if (contentType.includes('application/json')) {
        // For JSON, just stringify it nicely
        try {
          const parsed = JSON.parse(rawContent)
          extractedContent = JSON.stringify(parsed, null, 2)
        } catch {
          extractedContent = rawContent
        }
      } else {
        // For other text types, use as-is
        extractedContent = rawContent
      }

      // Sanitize content
      const sanitizedContent = this.sanitizeContent(extractedContent)

      if (!sanitizedContent || sanitizedContent.length < 10) {
        throw new Error('Insufficient content extracted from URL')
      }

      return {
        content: sanitizedContent,
        title,
        url: normalizedUrl,
        contentType,
        scrapedAt: new Date()
      }
    } catch (error: any) {
      console.error(`Failed to scrape URL ${normalizedUrl}:`, error.message)
      throw new Error(`Failed to scrape URL: ${error.message}`)
    }
  }

  /**
   * Test if a URL is accessible without fully scraping it
   */
  async testUrl(url: string): Promise<{ accessible: boolean; error?: string; contentType?: string }> {
    
    const validation = this.validateUrl(url)
    if (!validation.isValid) {
      return { accessible: false, error: validation.error }
    }

    const normalizedUrl = validation.normalizedUrl!

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout for test

      const response = await fetch(normalizedUrl, {
        method: 'HEAD', // Only get headers
        headers: {
          'User-Agent': this.defaultOptions.userAgent!
        },
        signal: controller.signal,
        redirect: 'follow',
        credentials: 'omit'
      })

      clearTimeout(timeoutId)

      const contentType = response.headers.get('content-type') || 'unknown'

      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`
        return { accessible: false, error: errorMsg }
      }

      return { accessible: true, contentType }
    } catch (error: any) {
      console.error(`URL test error for ${normalizedUrl}:`, error)
      
      if (error.name === 'AbortError') {
        return { accessible: false, error: 'Request timeout' }
      }
      return { accessible: false, error: error.message || 'Unknown fetch error' }
    }
  }
}

export const webScrapingService = new WebScrapingService()
export default webScrapingService 