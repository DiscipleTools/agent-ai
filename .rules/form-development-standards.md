# Form Development Standards for Nuxt Projects

## Data Flow Architecture
- ALWAYS map out the complete data flow: Backend API → Store → Component → Template
- NEVER assume data structure - verify at each transformation point
- Backend responses must follow consistent structure: `{ success: boolean, message: string, data: object }`
- Store functions must handle both success and error cases with proper structure
- Components must validate received data structure before using

## Required Logging & Debugging
- Add comprehensive logging at each data transformation point
- Include `JSON.stringify` for complex objects in logs
- Add temporary debug output to templates during development: `{{ JSON.stringify(formData) }}`
- Use browser Network tab to verify actual HTTP responses
- Implement proper error boundaries and fallback states

## Form Structure Requirements
- All forms must use `reactive()` for form data
- Implement proper validation with clear error messages
- Loading states for all async operations
- Consistent error handling with toast notifications
- Proper TypeScript types for all data structures

## Store Function Standards
- Always return consistent data structure that matches template expectations
- Handle both wrapped and unwrapped API responses
- Implement proper error handling with meaningful messages
- Update related state (like currentAgent) when operations succeed
- Use try-catch with finally blocks for loading states

## Template Requirements
- Use `v-if/v-else` for conditional rendering based on data state
- Implement proper null checking with optional chaining (`?.`)
- Add loading states and error states for all async operations
- Use consistent CSS classes and component structure
- Include accessibility attributes (aria-labels, etc.)

## Testing & Validation
- Test with actual API responses, not mock data
- Verify error states and edge cases
- Check responsive design on different screen sizes
- Validate form submission and error handling
- Test with slow network conditions

## Before Submitting Code
1. Verify complete data flow with logging
2. Test both success and error scenarios
3. Check browser Network tab for actual responses
4. Validate template renders correctly with real data
5. Ensure proper error handling and user feedback

## Common Pitfalls to Avoid
- Don't assume `$api` response structure - always verify
- Don't skip error handling for "simple" operations
- Don't forget loading states for async operations
- Don't use hardcoded values in templates
- Don't skip validation on form inputs

## Example Form Structure
```vue
<template>
  <div v-if="loading" class="loading-state">
    <div class="animate-spin">Loading...</div>
  </div>
  
  <div v-else-if="error" class="error-state">
    <p class="text-red-600">{{ error }}</p>
    <button @click="retry" class="btn-secondary">Retry</button>
  </div>
  
  <form v-else @submit.prevent="handleSubmit" class="space-y-6">
    <!-- Form fields with proper validation -->
    <div>
      <label for="field" class="block text-sm font-medium">
        Field Name *
      </label>
      <input
        id="field"
        v-model="form.field"
        type="text"
        required
        class="input-field"
        :class="{ 'border-red-500': errors.field }"
      />
      <p v-if="errors.field" class="text-sm text-red-600">
        {{ errors.field }}
      </p>
    </div>
    
    <div class="flex justify-end space-x-4">
      <button type="button" @click="cancel" class="btn-secondary">
        Cancel
      </button>
      <button 
        type="submit" 
        :disabled="isSubmitting" 
        class="btn-primary"
      >
        <span v-if="isSubmitting">Submitting...</span>
        <span v-else>Submit</span>
      </button>
    </div>
  </form>
</template>

<script setup>
// Required setup
const store = useStore()
const toast = useToast()

// Form state
const form = reactive({
  field: ''
})

const errors = reactive({})
const loading = ref(false)
const error = ref(null)
const isSubmitting = ref(false)

// Validation
const validateForm = () => {
  const newErrors = {}
  
  if (!form.field?.trim()) {
    newErrors.field = 'Field is required'
  }
  
  Object.keys(errors).forEach(key => delete errors[key])
  Object.assign(errors, newErrors)
  
  return Object.keys(newErrors).length === 0
}

// Submit handler
const handleSubmit = async () => {
  if (!validateForm()) return
  
  isSubmitting.value = true
  error.value = null
  
  try {
    console.log('Submitting form:', form)
    const result = await store.submitForm(form)
    console.log('Form submission result:', result)
    
    toast('Form submitted successfully', { type: 'success' })
    // Handle success (redirect, reset form, etc.)
  } catch (err) {
    console.error('Form submission error:', err)
    error.value = err.message || 'Failed to submit form'
    toast(error.value, { type: 'error' })
  } finally {
    isSubmitting.value = false
  }
}
</script> 