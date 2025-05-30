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
        
        // Common navigation patterns
        const navPatterns = [
          /^(home|about|contact|login|register|sign in|sign up|logout|search)$/i,
          /^(menu|navigation|nav|breadcrumb)$/i,
          /^(previous|next|back|forward|more|view all)$/i,
          /^(categories|tags|archive|recent|popular)$/i,
          /^(facebook|twitter|instagram|linkedin|youtube|social)$/i,
          /^(privacy|terms|policy|legal|copyright)$/i,
          /^(subscribe|newsletter|follow|share|like)$/i,
          /^(documentation|training|videos|community|forum|discord|channel)$/i
        ]
        
        // Check if text matches navigation patterns
        for (const pattern of navPatterns) {
          if (pattern.test(text)) {
            return true
          }
        }
        
        // Check for very short navigation-like text
        if (text.length < 30 && (
          lowerText.includes('click') ||
          lowerText.includes('here') ||
          lowerText.includes('link') ||
          lowerText.includes('page') ||
          lowerText.includes('view') ||
          lowerText.includes('see')
        )) {
          return true
        }
        
        // Check for lists of short items (likely navigation)
        const words = text.split(/\s+/)
        if (words.length <= 3 && text.length < 50) {
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
            
            // Remove lines with common navigation patterns
            const navKeywords = [
              'view categories', 'search about', 'kingdom vision', 'our history',
              'what is disciple', 'for online strategies', 'for small teams', 'for multiple teams',
              'why disciple', 'pricing (free)', 'software download', 'translation',
              'open source', 'resources documentation', 'training videos', 'community forum',
              'discord channel', 'join the community', 'news', 'home', 'about', 'contact'
            ]
            
            const lowerLine = trimmedLine.toLowerCase()
            for (const keyword of navKeywords) {
              if (lowerLine.includes(keyword)) {
                return false
              }
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
   * Calculate similarity between two text strings using simple word overlap
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(word => word.length > 3))
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(word => word.length > 3))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * Remove duplicate or very similar content from pages
   */
  private deduplicateContent(pages: ScrapedContent[]): ScrapedContent[] {
    const uniquePages: ScrapedContent[] = []
    const similarityThreshold = 0.7 // 70% similarity threshold
    
    for (const page of pages) {
      let isDuplicate = false
      
      for (const existingPage of uniquePages) {
        const similarity = this.calculateSimilarity(page.content, existingPage.content)
        if (similarity > similarityThreshold) {
          console.log(`Skipping duplicate content: ${page.url} (${(similarity * 100).toFixed(1)}% similar to ${existingPage.url})`)
          isDuplicate = true
          break
        }
      }
      
      if (!isDuplicate) {
        uniquePages.push(page)
      }
    }
    
    console.log(`Content deduplication: ${pages.length} pages → ${uniquePages.length} unique pages`)
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
            const absoluteUrl = new URL(href, baseUrl).toString()
            links.push(absoluteUrl)
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
        if (options.excludePatterns?.some(pattern => url.includes(pattern))) {
          return false
        }

        // Include patterns (if specified, URL must match at least one)
        if (options.includePatterns?.length && 
            !options.includePatterns.some(pattern => url.includes(pattern))) {
          return false
        }

        // Basic validation
        return this.validateUrl(url).isValid
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

        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 100))
        
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