# Input Sanitization Library

This library provides comprehensive input sanitization utilities to protect against XSS, injection attacks, and other security vulnerabilities.

## Quick Start

```javascript
import { sanitizeText, sanitizeUrl, sanitizeObject, schemas } from '~/utils/sanitize'

// Sanitize individual inputs
const cleanName = sanitizeText(userInput.name)
const cleanUrl = sanitizeUrl(userInput.websiteUrl)

// Sanitize entire objects using schemas
const cleanFormData = sanitizeObject(formData, schemas.agent)
```

## Available Functions

### Basic Sanitization

- `sanitizeText(input)` - Remove HTML tags and encode special characters
- `sanitizeNumber(input)` - Parse and validate numeric input
- `sanitizeUrl(input)` - Clean URLs and prevent SSRF attacks
- `sanitizeFilename(input)` - Remove dangerous filename characters
- `sanitizePrompt(input)` - Clean prompts while preserving formatting
- `sanitizeEmail(input)` - Clean and normalize email addresses
- `sanitizeHtml(input, options)` - Allow only safe HTML tags
- `sanitizeSearchQuery(input)` - Clean search queries

### Advanced Functions

- `sanitizeObject(obj, schema)` - Sanitize objects using schema definitions
- `validators` - Validation helpers that work with sanitization

## Usage Examples

### Component Form Handling

```javascript
// In your component
import { sanitizeText, sanitizePrompt, sanitizeObject, schemas, validators } from '~/utils/sanitize'

// Form state with sanitization
const form = reactive({
  name: sanitizeText(props.data?.name || ''),
  description: sanitizeText(props.data?.description || ''),
  prompt: sanitizePrompt(props.data?.prompt || '')
})

// Real-time sanitization watchers
watch(() => form.name, (newValue) => {
  if (newValue !== sanitizeText(newValue)) {
    form.name = sanitizeText(newValue)
  }
})

// Validation using library validators
const validateForm = () => {
  const errors = {}
  
  if (!validators.textLength(form.name, 2, 100)) {
    errors.name = 'Name must be between 2 and 100 characters'
  }
  
  if (!validators.textLength(form.prompt, 10, 2000)) {
    errors.prompt = 'Prompt must be between 10 and 2000 characters'
  }
  
  return Object.keys(errors).length === 0 ? null : errors
}

// Form submission with object sanitization
const handleSubmit = async () => {
  const sanitizedData = sanitizeObject(form, schemas.agent)
  await submitData(sanitizedData)
}
```

### URL Input Handling

```javascript
import { sanitizeUrl, validators } from '~/utils/sanitize'

const urlInput = ref('')

// Real-time URL sanitization
watch(() => urlInput.value, (newValue) => {
  const sanitized = sanitizeUrl(newValue)
  if (newValue !== sanitized) {
    urlInput.value = sanitized
  }
})

// URL validation
const isValidUrl = computed(() => {
  return validators.validUrl(urlInput.value)
})

// Safe URL processing
const processUrl = async () => {
  const cleanUrl = sanitizeUrl(urlInput.value)
  if (!cleanUrl) {
    throw new Error('Invalid URL')
  }
  
  // URL is now safe from SSRF and injection attacks
  await fetchContent(cleanUrl)
}
```

### File Upload Handling

```javascript
import { sanitizeFilename } from '~/utils/sanitize'

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // Sanitize filename to prevent path traversal
  const cleanFilename = sanitizeFilename(file.name)
  if (!cleanFilename) {
    throw new Error('Invalid filename')
  }
  
  // Process file with clean filename
  processFile(file, cleanFilename)
}
```

### User Registration/Profile

```javascript
import { sanitizeEmail, sanitizeText, validators } from '~/utils/sanitize'

const userForm = reactive({
  name: '',
  email: ''
})

// Sanitize inputs
const sanitizeUserForm = () => {
  userForm.name = sanitizeText(userForm.name)
  userForm.email = sanitizeEmail(userForm.email)
}

// Validate with sanitization
const validateUser = () => {
  const errors = {}
  
  if (!validators.textLength(userForm.name, 2, 50)) {
    errors.name = 'Name must be between 2 and 50 characters'
  }
  
  if (!validators.validEmail(userForm.email)) {
    errors.email = 'Please enter a valid email address'
  }
  
  return Object.keys(errors).length === 0 ? null : errors
}
```

## Predefined Schemas

The library includes predefined schemas for common use cases:

### Agent Schema
```javascript
schemas.agent = {
  name: 'text',
  description: 'text', 
  prompt: 'prompt',
  temperature: 'number',
  maxTokens: 'number',
  responseDelay: 'number',
  connectionId: 'text',
  modelId: 'text',
  chatwootApiKey: 'text'
}
```

### User Schema
```javascript
schemas.user = {
  name: 'text',
  email: 'email'
}
```

### URL Input Schema
```javascript
schemas.urlInput = {
  url: 'url',
  maxPages: 'number',
  maxDepth: 'number'
}
```

## Custom Schemas

You can create custom schemas for your specific use cases:

```javascript
const customSchema = {
  title: 'text',
  content: 'prompt',
  category: 'text',
  priority: 'number',
  isPublic: (input) => Boolean(input), // Custom function
  tags: (input) => Array.isArray(input) ? input.map(sanitizeText) : []
}

const cleanData = sanitizeObject(formData, customSchema)
```

## Security Best Practices

1. **Always sanitize user input** - Use appropriate sanitization functions for all user data
2. **Use real-time sanitization** - Implement watchers to sanitize input as users type
3. **Validate after sanitization** - Use the validators to ensure data meets requirements
4. **Use schemas for objects** - Leverage `sanitizeObject` with schemas for consistent sanitization
5. **Test edge cases** - Ensure your sanitization handles empty values, null, and undefined
6. **Layer your defense** - Combine frontend sanitization with server-side validation

## Integration with Existing Code

To migrate existing components to use this library:

1. **Replace manual sanitization** with library functions
2. **Update validation logic** to use the validators
3. **Implement real-time sanitization** with watchers
4. **Use schemas for object sanitization** where appropriate
5. **Test thoroughly** to ensure no functionality is broken

## Performance Considerations

- Sanitization functions are lightweight and optimized for performance
- Real-time sanitization has minimal impact on user experience
- Consider debouncing for expensive operations on frequently changing inputs
- The library functions are pure and can be safely called multiple times

## Browser Compatibility

The library uses modern JavaScript features but is compatible with all browsers supported by Nuxt 3:
- ES2020+ features
- Modern regex patterns
- URL API for SSRF prevention
- Standard string methods 