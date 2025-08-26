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
        <label for="agentType" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Agent Type
        </label>
        <div class="relative">
          <input
            id="agentType"
            v-model="form.agentType"
            type="text"
            readonly
            class="input-field bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
            value="response"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
        <p class="text-xs text-gray-500 mt-1">All agents are currently response agents. Only one response agent per inbox is allowed.</p>
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
import { sanitizeText, sanitizeContent } from '~/utils/sanitize'

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
</script>

 