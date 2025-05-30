import { defineRule, configure } from 'vee-validate'
import { required, email, min, max, min_value, max_value } from '@vee-validate/rules'

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
      const messages = {
        required: `The ${ctx.field} field is required.`,
        email: `The ${ctx.field} field must be a valid email.`,
        min: `The ${ctx.field} field must be at least ${ctx.rule.params[0]} characters.`,
        max: `The ${ctx.field} field must not exceed ${ctx.rule.params[0]} characters.`,
        min_value: `The ${ctx.field} field must be at least ${ctx.rule.params[0]}.`,
        max_value: `The ${ctx.field} field must not exceed ${ctx.rule.params[0]}.`
      }

      return messages[ctx.rule.name] || `The ${ctx.field} field is invalid.`
    }
  })
}) 