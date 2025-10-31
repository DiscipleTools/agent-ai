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
      <div class="flex items-center">
        <input
          :id="`trigger-type-${index}`"
          type="radio"
          :checked="localTrigger.type === 'message_created'"
          @change="updateTriggerType('message_created')"
          class="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
        />
        <label :for="`trigger-type-${index}`" class="ml-2 text-sm text-gray-900 dark:text-white">
          New message received
        </label>
      </div>
    </div>

    <!-- Trigger Description -->
    <div class="mb-4">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Triggered when a new message is received in a conversation
      </p>
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

// Auto-set trigger type to message_created if not set
onMounted(() => {
  if (!localTrigger.type) {
    updateTriggerType('message_created')
  }
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