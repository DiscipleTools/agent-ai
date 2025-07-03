import { defineRule, configure } from 'vee-validate'
import { required, email, min, max, min_value, max_value } from '@vee-validate/rules'
import { sanitizeText } from '~/utils/sanitize.js'

export default defineNuxtPlugin(() => {
  // Define the rules
  defineRule('required', required)
  defineRule('email', email)
  defineRule('min', min)
  defineRule('max', max)
  defineRule('min_value', min_value)
  defineRule('max_value', max_value)

  // Configure VeeValidate
  configure({
    generateMessage: (ctx) => {
      // Sanitize field name to prevent XSS
      const safeFieldName = sanitizeText(ctx.field)
      
      const messages = {
        required: `The ${safeFieldName} field is required.`,
        email: `The ${safeFieldName} field must be a valid email.`,
        min: `The ${safeFieldName} field must be at least ${ctx.rule.params[0]} characters.`,
        max: `The ${safeFieldName} field must not exceed ${ctx.rule.params[0]} characters.`,
        min_value: `The ${safeFieldName} field must be at least ${ctx.rule.params[0]}.`,
        max_value: `The ${safeFieldName} field must not exceed ${ctx.rule.params[0]}.`
      }

      return messages[ctx.rule.name] || `The ${safeFieldName} field is invalid.`
    }
  })
}) 