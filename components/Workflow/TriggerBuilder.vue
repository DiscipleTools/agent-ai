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

    <!-- Conditions Section -->
    <div v-if="localTrigger.type" class="mb-4">
      <div class="flex justify-between items-center mb-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Additional Conditions (optional)
        </label>
        <button
          type="button"
          @click="addCondition"
          class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
        >
          Add Condition
        </button>
      </div>

      <div v-if="localTrigger.conditions.length === 0" class="text-sm text-gray-500 dark:text-gray-400 italic">
        No additional conditions - trigger will fire for all {{ selectedTriggerMeta?.name }} events
      </div>

      <div v-else class="space-y-3">
        <ConditionBuilder
          v-for="(condition, condIndex) in localTrigger.conditions"
          :key="`condition-${condIndex}`"
          :condition="condition"
          :metadata="metadata"
          :index="condIndex"
          :show-logical-operator="condIndex > 0"
          @update="updateCondition(condIndex, $event)"
          @remove="removeCondition(condIndex)"
        />
      </div>
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
import ConditionBuilder from './ConditionBuilder.vue'

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
  // Clear conditions when trigger type changes
  localTrigger.conditions = []
  updateTrigger(localTrigger)
}

// Condition management
const addCondition = () => {
  localTrigger.conditions.push({
    type: '',
    operator: 'equals',
    value: '',
    logicalOperator: 'AND'
  })
  updateTrigger(localTrigger)
}

const updateCondition = (index, updatedCondition) => {
  localTrigger.conditions[index] = updatedCondition
  updateTrigger(localTrigger)
}

const removeCondition = (index) => {
  localTrigger.conditions.splice(index, 1)
  updateTrigger(localTrigger)
}
</script>