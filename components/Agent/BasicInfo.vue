<template>
  <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
    <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Basic Information</h2>
    
    <div class="grid grid-cols-1 gap-6">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Agent Name *
        </label>
        <input
          id="name"
          v-model="form.name"
          type="text"
          required
          class="input-field"
          :class="{ 'border-red-500': errors.name }"
          placeholder="Enter agent name"
        />
        <div class="flex justify-between mt-1">
          <p v-if="errors.name" class="text-sm text-red-600">{{ errors.name }}</p>
          <p class="text-xs text-gray-500">{{ form.name.length }}/100 characters</p>
        </div>
      </div>

      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <textarea
          id="description"
          v-model="form.description"
          rows="3"
          class="input-field"
          :class="{ 'border-red-500': errors.description }"
          placeholder="Brief description of the agent's purpose"
        ></textarea>
        <div class="flex justify-between mt-1">
          <p v-if="errors.description" class="text-sm text-red-600">{{ errors.description }}</p>
          <p class="text-xs text-gray-500">{{ (form.description || '').length }}/500 characters</p>
        </div>
      </div>

      <div>
        <label for="prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          System Prompt *
        </label>
        <textarea
          id="prompt"
          v-model="form.prompt"
          rows="6"
          required
          class="input-field"
          :class="{ 'border-red-500': errors.prompt }"
          placeholder="Define the agent's behavior, personality, and instructions..."
        ></textarea>
        <div class="flex justify-between mt-1">
          <p v-if="errors.prompt" class="text-sm text-red-600">{{ errors.prompt }}</p>
          <p class="text-xs text-gray-500">{{ form.prompt.length }}/2000 characters</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { sanitizeText, sanitizePrompt } from '~/utils/sanitize'

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  errors: {
    type: Object,
    default: () => ({})
  }
})

// Watch for sanitization
watch(() => props.form.name, (newValue) => {
  if (newValue !== sanitizeText(newValue)) {
    props.form.name = sanitizeText(newValue)
  }
})

watch(() => props.form.description, (newValue) => {
  if (newValue !== sanitizeText(newValue)) {
    props.form.description = sanitizeText(newValue)
  }
})

watch(() => props.form.prompt, (newValue) => {
  if (newValue !== sanitizePrompt(newValue)) {
    props.form.prompt = sanitizePrompt(newValue)
  }
})
</script>

 