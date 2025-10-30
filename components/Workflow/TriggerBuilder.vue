<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
    <div class="flex justify-between items-start mb-4">
      <h4 class="text-md font-medium text-gray-900 dark:text-white">
        Trigger {{ index + 1 }}
      </h4>
      <button
        type="button"
        @click="$emit('remove')"
        class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
      >
        <XMarkIcon class="w-5 h-5" />
      </button>
    </div>

    <!-- Trigger Type Selection -->
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        When this happens *
      </label>
      <select
        :value="localTrigger.type"
        @change="updateTriggerType($event.target.value)"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
      >
        <option value="">Select a trigger...</option>
        <optgroup v-for="category in triggerCategories" :key="category.name" :label="category.name">
          <option 
            v-for="trigger in category.triggers" 
            :key="trigger.type" 
            :value="trigger.type"
            :disabled="trigger.disabled"
            :title="trigger.disabled ? trigger.disabledReason : trigger.description"
            :class="{ 'text-gray-400': trigger.disabled }"
          >
            {{ trigger.name }}{{ trigger.disabled ? ' (Not Functional)' : '' }}
          </option>
        </optgroup>
      </select>
    </div>

    <!-- Trigger Description -->
    <div v-if="selectedTriggerMeta" class="mb-4">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ selectedTriggerMeta.description }}
      </p>
    </div>

    <!-- Active Toggle -->
    <div class="flex items-center">
      <input
        :id="`trigger-active-${index}`"
        type="checkbox"
        :checked="localTrigger.isActive"
        @change="updateTrigger({ ...localTrigger, isActive: $event.target.checked })"
        class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
      />
      <label :for="`trigger-active-${index}`" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
        Active
      </label>
    </div>
  </div>
</template>

<script setup>
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  trigger: {
    type: Object,
    required: true
  },
  metadata: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['update', 'remove'])

// Local reactive copy of the trigger
const localTrigger = reactive({ ...props.trigger })

// Watch for external changes
watch(() => props.trigger, (newTrigger) => {
  Object.assign(localTrigger, newTrigger)
}, { deep: true })

// Computed
const triggerCategories = computed(() => {
  if (!props.metadata?.triggers) return []

  const categories = {
    conversation: { name: 'Conversation Events', triggers: [] },
    message: { name: 'Message Events', triggers: [] },
    contact: { name: 'Contact Events', triggers: [] },
    widget: { name: 'Widget Events', triggers: [] }
  }

  props.metadata.triggers.forEach(trigger => {
    if (categories[trigger.category]) {
      categories[trigger.category].triggers.push(trigger)
    }
  })

  return Object.values(categories).filter(cat => cat.triggers.length > 0)
})

const selectedTriggerMeta = computed(() => {
  if (!props.metadata?.triggers || !localTrigger.type) return null
  return props.metadata.triggers.find(t => t.type === localTrigger.type)
})

// Methods
const updateTrigger = (updatedTrigger) => {
  Object.assign(localTrigger, updatedTrigger)
  emit('update', localTrigger)
}

const updateTriggerType = (newType) => {
  localTrigger.type = newType
  updateTrigger(localTrigger)
}
</script>