# Website Scraping Feature

The Agent AI platform now supports crawling entire websites to extract content for agent context. This feature allows you to add comprehensive website content to your agents, enabling them to have deep knowledge about specific websites or documentation.

## Features

### 🕷️ Website Crawling
- **Multi-page crawling**: Automatically discover and scrape multiple pages from a website
- **Configurable depth**: Control how deep the crawler follows links (1-3 levels)
- **Page limits**: Set maximum number of pages to crawl (1-50 pages)
- **Domain filtering**: Option to stay within the same domain or allow external links
- **Content filtering**: Exclude common non-content pages (admin, login, media files, etc.)

### 🤖 Robots.txt Compliance
- **Automatic robots.txt checking**: Respects website crawling permissions
- **User-agent identification**: Identifies as "Agent-AI-Server" for transparency
- **Graceful handling**: Falls back to single-page scraping if robots.txt disallows crawling

### 🔒 Security & Performance
- **Rate limiting**: 1-second delay between requests to be respectful
- **Content size limits**: Maximum 150KB per page to prevent abuse
- **Timeout protection**: 10-second timeout per page request
- **Domain blocking**: Prevents crawling of social media and private networks
- **Input validation**: Comprehensive URL and option validation

## Usage

### Frontend (Agent Form)

1. **Navigate to Agent Creation/Editing**
   - Go to the agent form in your dashboard
   - Scroll to the "Context Documents" section

2. **Add Website Content**
   - Click "Add Website" button
   - Enter the website URL (e.g., `https://docs.example.com`)
   - Click "Test" to verify the website is crawlable

3. **Configure Crawl Options**
   - **Max Pages**: Number of pages to crawl (1-50)
   - **Max Depth**: How many link levels to follow (1-3)
   - **Same Domain Only**: Whether to stay on the same domain

4. **Start Crawling**
   - Click "Crawl Website" to begin the process
   - Wait for completion (may take several minutes for large sites)

### API Endpoints

#### Test Website Crawlability
```http
POST /api/agents/{agentId}/context/test-website
Content-Type: application/json

{
  "url": "https://example.com",
  "options": {
    "maxPages": 10,
    "maxDepth": 2,
    "sameDomainOnly": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Website is accessible and ready to be crawled",
  "data": {
    "url": "https://example.com",
    "accessible": true,
    "robotsAllowed": true,
    "estimatedPages": 8,
    "sampleLinks": [
      "https://example.com/about",
      "https://example.com/contact",
      "https://example.com/services"
    ],
    "estimatedProcessingTime": "Should process quickly"
  }
}
```

#### Crawl and Add Website
```http
POST /api/agents/{agentId}/context/website
Content-Type: application/json

{
  "url": "https://example.com",
  "options": {
    "maxPages": 10,
    "maxDepth": 2,
    "sameDomainOnly": true,
    "excludePatterns": ["/admin", "/login"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Website content added to agent context (8 pages crawled)",
  "data": {
    "contextDocument": {
      "type": "website",
      "url": "https://example.com",
      "filename": "example.com (8 pages)",
      "contentLength": 45230,
      "metadata": {
        "totalPages": 8,
        "totalContentLength": 45230,
        "crawlOptions": { "maxPages": 10, "maxDepth": 2 }
      }
    },
    "website": {
      "baseUrl": "https://example.com",
      "totalPages": 8,
      "summary": "Website: example.com\nPages crawled: 8\nTotal content: 12,450 words\n..."
    }
  }
}
```

## Configuration Options

### Crawl Options
| Option | Type | Default | Range | Description |
|--------|------|---------|-------|-------------|
| `maxPages` | number | 10 | 1-50 | Maximum number of pages to crawl |
| `maxDepth` | number | 2 | 1-3 | Maximum link depth to follow |
| `sameDomainOnly` | boolean | true | - | Only crawl pages on the same domain |
| `includePatterns` | string[] | [] | - | URL patterns that must be included |
| `excludePatterns` | string[] | [see below] | - | URL patterns to exclude |

### Default Exclude Patterns
The crawler automatically excludes these patterns:
- `/admin` - Admin pages
- `/login` - Login pages  
- `/register` - Registration pages
- `/cart` - Shopping cart pages
- `/checkout` - Checkout pages
- `/account` - User account pages
- `/profile` - User profile pages
- `.pdf`, `.jpg`, `.png`, etc. - Media files
- `.css`, `.js` - Static assets

### Service Configuration
| Setting | Value | Description |
|---------|-------|-------------|
| Max Content Length | 150KB | Maximum content per page |
| Request Timeout | 10 seconds | Timeout per page request |
| Crawl Delay | 1 second | Delay between requests |
| User Agent | `Agent-AI-Server/1.0` | Identifies the crawler |

## Content Processing

### Content Combination
When a website is crawled, all pages are combined into a single context document:

```
Website: example.com
Pages crawled: 8
Total content: 12,450 words

Page titles:
1. Home - Example Company
2. About Us - Example Company
3. Services - Example Company
...

=== WEBSITE CONTENT ===

--- Page 1: Home - Example Company ---
URL: https://example.com/
[Page content here]

--- Page 2: About Us - Example Company ---
URL: https://example.com/about
[Page content here]

...
```

### Metadata Storage
Each website document includes metadata:
- `totalPages`: Number of pages crawled
- `totalContentLength`: Total characters across all pages
- `crawlOptions`: Original crawl configuration
- `pageUrls`: List of all crawled page URLs
- `lastCrawled`: Timestamp of last crawl (for re-crawls)

## Re-crawling Websites

Website documents can be refreshed to get updated content:

1. **Frontend**: Click "Re-crawl" button next to website document
2. **API**: Send PUT request to `/api/agents/{agentId}/context/{docId}` with `{ "refreshUrl": true }`

The system will:
- Use the original crawl options
- Re-crawl all discoverable pages
- Update the content and metadata
- Preserve the document ID and history

## Best Practices

### 🎯 Choosing What to Crawl
- **Documentation sites**: Perfect for product docs, APIs, guides
- **Company websites**: Good for about pages, service descriptions
- **Blog sites**: Useful for knowledge bases and articles
- **Avoid**: Social media, e-commerce product pages, user-generated content

### ⚙️ Optimal Settings
- **Small sites (< 20 pages)**: `maxPages: 20, maxDepth: 3`
- **Medium sites (20-100 pages)**: `maxPages: 30, maxDepth: 2`
- **Large sites (> 100 pages)**: `maxPages: 50, maxDepth: 1`

### 🚀 Performance Tips
- Start with lower page limits and increase if needed
- Use `sameDomainOnly: true` for focused crawling
- Add specific `excludePatterns` for irrelevant sections
- Test websites before full crawling

### 🔒 Ethical Considerations
- Respect robots.txt files
- Don't crawl too frequently (use re-crawl sparingly)
- Be mindful of server load on target websites
- Only crawl publicly accessible content

## Troubleshooting

### Common Issues

**"Website is not accessible for crawling"**
- Check if the URL is correct and publicly accessible
- Verify the website doesn't block automated access
- Try accessing the URL manually in a browser

**"Crawling is disallowed by robots.txt"**
- The website explicitly disallows crawling
- Try crawling a specific page instead of the whole site
- Contact the website owner for permission

**"No pages could be scraped from the website"**
- The website might use JavaScript for navigation
- Try increasing the timeout settings
- Check if the site requires authentication

**"Content too large" errors**
- Reduce the `maxPages` setting
- Add more specific `excludePatterns`
- Focus on specific sections of the website

### Error Codes
- `400`: Invalid URL or crawl options
- `403`: Access denied to agent
- `404`: Agent not found
- `409`: Website already exists in context
- `500`: Server error during crawling

## Limitations

- **JavaScript-heavy sites**: May not capture dynamically loaded content
- **Authentication required**: Cannot crawl password-protected content
- **Rate limits**: Some websites may block rapid requests
- **Content size**: Large websites may hit content limits
- **Dynamic content**: Real-time data may not be captured accurately

## Future Enhancements

- **JavaScript rendering**: Support for SPA and dynamic content
- **Selective crawling**: Choose specific sections or page types
- **Scheduled re-crawling**: Automatic content updates
- **Content filtering**: Extract only specific content types
- **Multi-language support**: Better handling of international sites 