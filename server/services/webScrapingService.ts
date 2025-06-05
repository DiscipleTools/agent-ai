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

interface WebsiteContent {
  baseUrl: string
  pages: ScrapedContent[]
  totalPages: number
  totalContentLength: number
  scrapedAt: Date
  summary: string
}

interface CrawlOptions {
  maxPages?: number
  maxDepth?: number
  sameDomainOnly?: boolean
  includePatterns?: string[]
  excludePatterns?: string[]
  respectRobotsTxt?: boolean
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
    maxContentLength: 1000000, // 500KB max content (increased from 150KB)
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

  private readonly defaultCrawlOptions: CrawlOptions = {
    maxPages: 50,
    maxDepth: 2,
    sameDomainOnly: true,
    includePatterns: [],
    excludePatterns: [
      '/admin',
      '/login',
      '/register',
      '/cart',
      '/checkout',
      '/account',
      '/profile',
      '.pdf',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.svg',
      '.css',
      '.js',
      '.xml',
      '.json'
    ],
    respectRobotsTxt: true
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

      // Normalize URL - remove fragment and keep it simple to avoid query string issues
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
   * Extract and clean text content from HTML, focusing on headings and main content
   */
  private extractTextFromHtml(html: string, url: string): { content: string; title?: string } {
    try {
      
      // Extract title using regex
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : undefined
      
      // Remove script, style, and navigation elements
      let cleanHtml = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        // Be more selective with aside - only remove obvious sidebars
        .replace(/<aside[^>]*class="[^"]*(?:sidebar|widget|ad|banner)[^"]*"[^>]*>[\s\S]*?<\/aside>/gi, '')
        // Enhanced navigation and menu filtering
        .replace(/<div[^>]*class="[^"]*(?:sidebar|menu|navigation|breadcrumb|social|share|comment|navbar|topbar|header|footer)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
        .replace(/<ul[^>]*class="[^"]*(?:menu|nav|navigation|breadcrumb|social|share)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi, '')
        .replace(/<ol[^>]*class="[^"]*(?:menu|nav|navigation|breadcrumb)[^"]*"[^>]*>[\s\S]*?<\/ol>/gi, '')
        // Remove common navigation patterns
        .replace(/<div[^>]*id="[^"]*(?:menu|nav|navigation|sidebar|header|footer)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
        .replace(/<section[^>]*class="[^"]*(?:menu|nav|navigation|sidebar|header|footer)[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '')
      
      // Helper function to clean text content
      const cleanText = (text: string): string => {
        return text
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x2d;/g, '-')
          .replace(/\s+/g, ' ')
          .trim()
      }
      
      // Helper function to filter out navigation-like content
      const isNavigationContent = (text: string): boolean => {
        const lowerText = text.toLowerCase()
        
        // Common navigation patterns (generic, not site-specific)
        const navPatterns = [
          /^(home|about|contact|login|register|sign in|sign up|logout|search)$/i,
          /^(menu|navigation|nav|breadcrumb)$/i,
          /^(previous|next|back|forward|more|view all)$/i,
          /^(categories|tags|archive|recent|popular)$/i,
          /^(facebook|twitter|instagram|linkedin|youtube|social)$/i,
          /^(privacy|terms|policy|legal|copyright)$/i,
          /^(subscribe|newsletter|follow|share|like)$/i,
          /^(documentation|training|videos|community|forum|blog|news)$/i,
          /^(help|support|faq|guide|tutorial)$/i
        ]
        
        // Check if text matches navigation patterns
        for (const pattern of navPatterns) {
          if (pattern.test(text)) {
            return true
          }
        }
        
        // Check for very short navigation-like text with action words
        if (text.length < 30 && (
          lowerText.includes('click') ||
          lowerText.includes('here') ||
          lowerText.includes('link') ||
          lowerText.includes('page') ||
          lowerText.includes('view') ||
          lowerText.includes('see') ||
          lowerText.includes('read more') ||
          lowerText.includes('learn more')
        )) {
          return true
        }
        
        // Check for lists of short items (likely navigation)
        const words = text.split(/\s+/)
        if (words.length <= 3 && text.length < 50) {
          return true
        }
        
        // Check for common navigation separators in short text
        if (text.length < 100 && /[|•\-›»>]/.test(text) && words.length <= 5) {
          return true
        }
        
        return false
      }
      
      // Extract headings with their content (improved regex to handle nested HTML)
      const headings: string[] = []
      const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi
      let headingMatch
      while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
        const level = headingMatch[1].toUpperCase()
        const text = cleanText(headingMatch[2])
        if (text && text.length > 0 && !isNavigationContent(text)) {
          headings.push(`${level}: ${text}`)
        }
      }
      
      // Extract ALL main content paragraphs (improved regex to handle nested HTML)
      const paragraphs: string[] = []
      const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
      let paragraphMatch
      while ((paragraphMatch = paragraphRegex.exec(cleanHtml)) !== null) {
        const text = cleanText(paragraphMatch[1])
        
        // Filter out navigation content and very short paragraphs
        if (text && text.length > 20 && !isNavigationContent(text)) {
          paragraphs.push(text)
        }
      }
      
      // Extract ALL list items for structured content (improved regex to handle nested HTML)
      const listItems: string[] = []
      const listRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
      let listMatch
      while ((listMatch = listRegex.exec(cleanHtml)) !== null) {
        const text = cleanText(listMatch[1])
        
        // Filter out navigation content and very short items
        if (text && text.length > 10 && !isNavigationContent(text)) {
          listItems.push(`• ${text}`)
        }
      }
      
      // Also try to extract content from div elements that might contain main content
      const contentDivs: string[] = []
      const contentDivRegex = /<div[^>]*class="[^"]*(?:content|entry|post|article|main)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
      let contentDivMatch
      while ((contentDivMatch = contentDivRegex.exec(cleanHtml)) !== null) {
        const text = cleanText(contentDivMatch[1])
        if (text && text.length > 50 && !isNavigationContent(text)) {
          // Extract paragraphs from content divs
          const divParagraphs = text.split(/\.\s+/).filter(p => p.trim().length > 20 && !isNavigationContent(p.trim()))
          contentDivs.push(...divParagraphs.map(p => p.trim() + (p.endsWith('.') ? '' : '.')))
        }
      }
      
      // Post-process to remove any remaining navigation content
      const filterNavigationLines = (content: string): string => {
        return content
          .split('\n')
          .filter(line => {
            const trimmedLine = line.trim()
            if (!trimmedLine) return true // Keep empty lines for formatting
            
            // Remove lines that are clearly navigation
            if (trimmedLine.startsWith('•') && isNavigationContent(trimmedLine.substring(1).trim())) {
              return false
            }
            
            // Generic navigation pattern detection (not site-specific)
            const lowerLine = trimmedLine.toLowerCase()
            
            // Skip lines that are just navigation links (multiple short words separated by bullets/pipes)
            if (/^[•\|\-\s]*([a-z\s]{1,20}[•\|\-\s]+){3,}[a-z\s]{1,20}[•\|\-\s]*$/i.test(trimmedLine)) {
              return false
            }
            
            // Skip lines with multiple navigation-like separators
            if ((trimmedLine.match(/[•\|\-]/g) || []).length >= 3 && trimmedLine.length < 200) {
              return false
            }
            
            // Skip lines that are mostly common navigation words
            const commonNavWords = ['home', 'about', 'contact', 'login', 'register', 'search', 'menu', 'news', 'blog', 'help', 'support', 'privacy', 'terms', 'policy']
            const words = lowerLine.split(/\s+/).filter(word => word.length > 2)
            if (words.length > 0) {
              const navWordCount = words.filter(word => commonNavWords.includes(word)).length
              if (navWordCount / words.length > 0.5 && words.length <= 10) {
                return false
              }
            }
            
            // Skip lines that look like breadcrumbs (word > word > word)
            if (/\w+\s*[>»]\s*\w+\s*[>»]\s*\w+/.test(trimmedLine)) {
              return false
            }
            
            return true
          })
          .join('\n')
      }
      
      // Combine extracted content
      let extractedContent = ''
      
      if (headings.length > 0) {
        extractedContent += headings.join('\n') + '\n\n'
      }
      
      if (paragraphs.length > 0) {
        // Include ALL paragraphs, not just first 5
        extractedContent += paragraphs.join('\n\n') + '\n\n'
      }
      
      if (listItems.length > 0) {
        // Include ALL list items
        extractedContent += listItems.join('\n') + '\n\n'
      }
      
      if (contentDivs.length > 0 && paragraphs.length < 3) {
        // If we didn't get many paragraphs, include content from divs
        extractedContent += contentDivs.slice(0, 10).join('\n\n') + '\n'
      }
      
      // Apply final navigation filtering
      extractedContent = filterNavigationLines(extractedContent)
      
      if (!extractedContent || extractedContent.trim().length < 10) {
        throw new Error('Insufficient content extracted')
      }
      
      return { content: extractedContent.trim(), title }
    } catch (error) {
      throw new Error(`Failed to extract text from HTML: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Calculate similarity between two text strings using optimized word overlap
   * CPU-optimized version with early exits and length limits
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Early exit for identical texts
    if (text1 === text2) return 1
    
    // Early exit for very different lengths (likely different content)
    const lengthRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length)
    if (lengthRatio < 0.3) return 0
    
    // Limit text size for comparison to prevent CPU overload
    const maxChars = 5000
    const t1 = text1.length > maxChars ? text1.substring(0, maxChars) : text1
    const t2 = text2.length > maxChars ? text2.substring(0, maxChars) : text2
    
    const words1 = new Set(t1.toLowerCase().split(/\s+/).filter(word => word.length > 3))
    const words2 = new Set(t2.toLowerCase().split(/\s+/).filter(word => word.length > 3))
    
    // Early exit for very different word counts
    const wordCountRatio = Math.min(words1.size, words2.size) / Math.max(words1.size, words2.size)
    if (wordCountRatio < 0.2) return 0
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * Remove duplicate URLs from pages (URL-only deduplication for CPU efficiency)
   */
  private deduplicateContent(pages: ScrapedContent[]): ScrapedContent[] {
    console.log(`Starting URL deduplication for ${pages.length} pages...`)
    
    const seenUrls = new Set<string>()
    const uniquePages: ScrapedContent[] = []
    let skippedCount = 0
    
    for (const page of pages) {
      if (seenUrls.has(page.url)) {
        console.log(`Skipping duplicate URL: ${page.url}`)
        skippedCount++
        continue
      }
      
      seenUrls.add(page.url)
      uniquePages.push(page)
    }
    
    console.log(`URL deduplication complete: ${pages.length} pages → ${uniquePages.length} unique pages (${skippedCount} duplicate URLs removed)`)
    return uniquePages
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

      // Truncate content if it's too large (instead of failing)
      let finalContent = sanitizedContent
      let wasTruncated = false
      
      if (sanitizedContent.length > mergedOptions.maxContentLength!) {
        finalContent = sanitizedContent.substring(0, mergedOptions.maxContentLength!) + '\n\n[Content truncated due to size limit]'
        wasTruncated = true
        console.warn(`Content truncated for ${normalizedUrl}: ${sanitizedContent.length} chars -> ${finalContent.length} chars`)
      }

      return {
        content: finalContent,
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

  /**
   * Extract links from HTML content
   */
  private extractLinks(html: string, baseUrl: string): string[] {
    try {
      const links: string[] = []
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
      let match

      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1]
        if (href) {
          try {
            // Convert relative URLs to absolute
            const absoluteUrl = new URL(href, baseUrl)
            // Remove fragment (hash) to prevent treating same page with different anchors as separate pages
            absoluteUrl.hash = ''
            links.push(absoluteUrl.toString())
          } catch (error) {
            // Skip invalid URLs
            continue
          }
        }
      }

      return [...new Set(links)] // Remove duplicates
    } catch (error) {
      console.warn('Failed to extract links:', error)
      return []
    }
  }

  /**
   * Filter URLs based on crawl options
   */
  private filterUrls(urls: string[], baseUrl: string, options: CrawlOptions): string[] {
    const baseDomain = new URL(baseUrl).hostname
    const basePath = new URL(baseUrl).pathname
    
    return urls.filter(url => {
      try {
        const parsedUrl = new URL(url)
        // Remove fragment for consistent comparison
        parsedUrl.hash = ''
        const normalizedUrl = parsedUrl.toString()
        
        // Same domain check
        if (options.sameDomainOnly && parsedUrl.hostname !== baseDomain) {
          return false
        }

        // Path-based filtering: if base URL has a path, only include subpages of that path
        if (basePath && basePath !== '/' && basePath !== '') {
          const urlPath = parsedUrl.pathname
          // Ensure the URL path starts with the base path
          if (!urlPath.startsWith(basePath)) {
            return false
          }
          // Additional check: make sure it's actually a subpage, not just a path that starts with the same characters
          // e.g., /docs should match /docs/page but not /documentation
          if (urlPath !== basePath && !urlPath.startsWith(basePath + '/')) {
            return false
          }
        }

        // Exclude patterns
        if (options.excludePatterns?.some(pattern => normalizedUrl.includes(pattern))) {
          return false
        }

        // Include patterns (if specified, URL must match at least one)
        if (options.includePatterns?.length && 
            !options.includePatterns.some(pattern => normalizedUrl.includes(pattern))) {
          return false
        }

        // Basic validation
        return this.validateUrl(normalizedUrl).isValid
      } catch (error) {
        return false
      }
    })
  }

  /**
   * Check robots.txt for crawling permissions
   */
  private async checkRobotsTxt(baseUrl: string): Promise<boolean> {
    if (!this.defaultCrawlOptions.respectRobotsTxt) {
      return true
    }

    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString()
      const response = await fetch(robotsUrl, {
        method: 'GET',
        headers: { 'User-Agent': this.defaultOptions.userAgent! },
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        return true // If robots.txt doesn't exist, assume crawling is allowed
      }

      const robotsContent = await response.text()
      
      // Simple robots.txt parsing - look for Disallow rules for our user agent
      const lines = robotsContent.split('\n')
      let isOurUserAgent = false
      
      for (const line of lines) {
        const trimmed = line.trim().toLowerCase()
        
        if (trimmed.startsWith('user-agent:')) {
          const userAgent = trimmed.split(':')[1]?.trim()
          isOurUserAgent = userAgent === '*' || userAgent === 'agent-ai-server'
        }
        
        if (isOurUserAgent && trimmed.startsWith('disallow:')) {
          const disallowPath = trimmed.split(':')[1]?.trim()
          if (disallowPath === '/' || disallowPath === '') {
            return false // Crawling is disallowed
          }
        }
      }

      return true
    } catch (error) {
      console.warn('Failed to check robots.txt:', error)
      return true // If we can't check, assume it's allowed
    }
  }

  /**
   * Crawl a website starting from a base URL
   */
  async crawlWebsite(baseUrl: string, options: Partial<CrawlOptions> = {}): Promise<WebsiteContent> {
    const mergedOptions = { ...this.defaultCrawlOptions, ...options }
    
    // Validate base URL
    const validation = this.validateUrl(baseUrl)
    if (!validation.isValid) {
      throw new Error(`Base URL validation failed: ${validation.error}`)
    }

    const normalizedBaseUrl = validation.normalizedUrl!
    
    // Check robots.txt
    const robotsAllowed = await this.checkRobotsTxt(normalizedBaseUrl)
    if (!robotsAllowed) {
      throw new Error('Crawling is disallowed by robots.txt')
    }

    const visitedUrls = new Set<string>()
    const urlsToVisit: Array<{ url: string; depth: number }> = [{ url: normalizedBaseUrl, depth: 0 }]
    const scrapedPages: ScrapedContent[] = []
    let totalContentLength = 0

    console.log(`Starting website crawl: ${normalizedBaseUrl}`)
    console.log(`Options: maxPages=${mergedOptions.maxPages}, maxDepth=${mergedOptions.maxDepth}`)

    // Log path filtering if active
    const basePath = new URL(normalizedBaseUrl).pathname
    if (basePath && basePath !== '/' && basePath !== '') {
      console.log(`Path filtering active: only crawling subpages of ${basePath}`)
    }

    while (urlsToVisit.length > 0 && scrapedPages.length < mergedOptions.maxPages!) {
      const { url, depth } = urlsToVisit.shift()!
      
      if (visitedUrls.has(url) || depth > mergedOptions.maxDepth!) {
        continue
      }

      visitedUrls.add(url)
      
      try {
        console.log(`Crawling page ${scrapedPages.length + 1}/${mergedOptions.maxPages}: ${url} (depth: ${depth})`)
        
        // Scrape the current page
        const scrapedContent = await this.scrapeUrl(url)
        scrapedPages.push(scrapedContent)
        totalContentLength += scrapedContent.content.length

        // Extract links for next level if we haven't reached max depth
        if (depth < mergedOptions.maxDepth!) {
          const { content } = await this.fetchContent(url, this.defaultOptions)
          const links = this.extractLinks(content, url)
          const filteredLinks = this.filterUrls(links, normalizedBaseUrl, mergedOptions)
          
          // Add new URLs to visit
          for (const link of filteredLinks) {
            if (!visitedUrls.has(link) && !urlsToVisit.some(item => item.url === link)) {
              urlsToVisit.push({ url: link, depth: depth + 1 })
            }
          }
        }

        // Add delay between requests to be respectful and reduce CPU load
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.warn(`Failed to scrape ${url}:`, error)
        // Continue with other pages even if one fails
      }
    }

    if (scrapedPages.length === 0) {
      throw new Error('No pages could be scraped from the website')
    }

    // Remove duplicate/similar content between pages
    const uniquePages = this.deduplicateContent(scrapedPages)
    const finalContentLength = uniquePages.reduce((sum, page) => sum + page.content.length, 0)

    // Generate summary
    const summary = this.generateWebsiteSummary(uniquePages, normalizedBaseUrl)

    console.log(`Website crawl completed: ${uniquePages.length} unique pages (${scrapedPages.length} total), ${finalContentLength} total characters`)

    return {
      baseUrl: normalizedBaseUrl,
      pages: uniquePages,
      totalPages: uniquePages.length,
      totalContentLength: finalContentLength,
      scrapedAt: new Date(),
      summary
    }
  }

  /**
   * Crawl a website with progress callbacks for real-time updates
   */
  async crawlWebsiteWithProgress(
    baseUrl: string, 
    options: Partial<CrawlOptions> = {},
    onProgress?: (progress: {
      message: string;
      currentPage: number;
      estimatedTotal: number;
      currentUrl: string;
    }) => void | Promise<void>
  ): Promise<WebsiteContent> {
    const mergedOptions = { ...this.defaultCrawlOptions, ...options }
    
    // Validate base URL
    const validation = this.validateUrl(baseUrl)
    if (!validation.isValid) {
      throw new Error(`Base URL validation failed: ${validation.error}`)
    }

    const normalizedBaseUrl = validation.normalizedUrl!
    
    // Check robots.txt
    const robotsAllowed = await this.checkRobotsTxt(normalizedBaseUrl)
    if (!robotsAllowed) {
      throw new Error('Crawling is disallowed by robots.txt')
    }

    const visitedUrls = new Set<string>()
    const urlsToVisit: Array<{ url: string; depth: number }> = [{ url: normalizedBaseUrl, depth: 0 }]
    const scrapedPages: ScrapedContent[] = []
    let totalContentLength = 0

    console.log(`Starting website crawl with progress: ${normalizedBaseUrl}`)
    console.log(`Options: maxPages=${mergedOptions.maxPages}, maxDepth=${mergedOptions.maxDepth}`)

    // Log path filtering if active
    const basePath = new URL(normalizedBaseUrl).pathname
    if (basePath && basePath !== '/' && basePath !== '') {
      console.log(`Path filtering active: only crawling subpages of ${basePath}`)
    }

    while (urlsToVisit.length > 0 && scrapedPages.length < mergedOptions.maxPages!) {
      const { url, depth } = urlsToVisit.shift()!
      
      if (visitedUrls.has(url) || depth > mergedOptions.maxDepth!) {
        continue
      }

      visitedUrls.add(url)
      
      try {
        console.log(`Crawling page ${scrapedPages.length + 1}/${mergedOptions.maxPages}: ${url} (depth: ${depth})`)
        
        // Send progress update
        if (onProgress) {
          await onProgress({
            message: `Crawling page ${scrapedPages.length + 1}`,
            currentPage: scrapedPages.length + 1,
            estimatedTotal: Math.min(urlsToVisit.length + scrapedPages.length + 1, mergedOptions.maxPages!),
            currentUrl: url
          })
        }
        
        // Scrape the current page
        const scrapedContent = await this.scrapeUrl(url)
        scrapedPages.push(scrapedContent)
        totalContentLength += scrapedContent.content.length

        // Extract links for next level if we haven't reached max depth
        if (depth < mergedOptions.maxDepth!) {
          const { content } = await this.fetchContent(url, this.defaultOptions)
          const links = this.extractLinks(content, url)
          const filteredLinks = this.filterUrls(links, normalizedBaseUrl, mergedOptions)
          
          // Add new URLs to visit
          for (const link of filteredLinks) {
            if (!visitedUrls.has(link) && !urlsToVisit.some(item => item.url === link)) {
              urlsToVisit.push({ url: link, depth: depth + 1 })
            }
          }
        }

        // Add delay between requests to be respectful and reduce CPU load
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.warn(`Failed to scrape ${url}:`, error)
        // Continue with other pages even if one fails
      }
    }

    if (scrapedPages.length === 0) {
      throw new Error('No pages could be scraped from the website')
    }

    // Remove duplicate/similar content between pages
    const uniquePages = this.deduplicateContent(scrapedPages)
    const finalContentLength = uniquePages.reduce((sum, page) => sum + page.content.length, 0)

    // Generate summary
    const summary = this.generateWebsiteSummary(uniquePages, normalizedBaseUrl)

    console.log(`Website crawl completed: ${uniquePages.length} unique pages (${scrapedPages.length} total), ${finalContentLength} total characters`)

    return {
      baseUrl: normalizedBaseUrl,
      pages: uniquePages,
      totalPages: uniquePages.length,
      totalContentLength: finalContentLength,
      scrapedAt: new Date(),
      summary
    }
  }

  /**
   * Generate a summary of the crawled website
   */
  private generateWebsiteSummary(pages: ScrapedContent[], baseUrl: string): string {
    const parsedBaseUrl = new URL(baseUrl)
    const domain = parsedBaseUrl.hostname
    const basePath = parsedBaseUrl.pathname
    const titles = pages.map(page => page.title).filter(Boolean)
    const totalWords = pages.reduce((sum, page) => sum + page.content.split(/\s+/).length, 0)
    
    let summary = `Website: ${domain}`
    if (basePath && basePath !== '/' && basePath !== '') {
      summary += ` (${basePath} section)`
    }
    summary += `\n`
    summary += `Pages crawled: ${pages.length}\n`
    summary += `Total content: ${totalWords.toLocaleString()} words\n`
    
    if (titles.length > 0) {
      summary += `\nPage titles:\n`
      titles.slice(0, 10).forEach((title, index) => {
        summary += `${index + 1}. ${title}\n`
      })
      if (titles.length > 10) {
        summary += `... and ${titles.length - 10} more pages\n`
      }
    }
    
    return summary
  }

  /**
   * Test if a website can be crawled
   */
  async testWebsite(baseUrl: string, options: Partial<CrawlOptions> = {}): Promise<{
    accessible: boolean
    error?: string
    estimatedPages?: number
    robotsAllowed?: boolean
    sampleLinks?: string[]
  }> {
    try {
      // First test the base URL
      const urlTest = await this.testUrl(baseUrl)
      if (!urlTest.accessible) {
        return { accessible: false, error: urlTest.error }
      }

      // Check robots.txt
      const robotsAllowed = await this.checkRobotsTxt(baseUrl)
      if (!robotsAllowed) {
        return { 
          accessible: false, 
          error: 'Crawling is disallowed by robots.txt',
          robotsAllowed: false
        }
      }

      // Try to get a sample of links to estimate crawlable pages
      try {
        const { content } = await this.fetchContent(baseUrl, this.defaultOptions)
        const links = this.extractLinks(content, baseUrl)
        const mergedOptions = { ...this.defaultCrawlOptions, ...options }
        const filteredLinks = this.filterUrls(links, baseUrl, mergedOptions)
        
        return {
          accessible: true,
          robotsAllowed: true,
          estimatedPages: Math.min(filteredLinks.length + 1, mergedOptions.maxPages!),
          sampleLinks: filteredLinks.slice(0, 5)
        }
      } catch (error) {
        // If we can't analyze links, but the base URL is accessible, still return success
        return {
          accessible: true,
          robotsAllowed: true,
          estimatedPages: 1
        }
      }
    } catch (error: any) {
      return { accessible: false, error: error.message }
    }
  }
}

export const webScrapingService = new WebScrapingService()
export default webScrapingService 