<template>
  <div class="border border-gray-300 dark:border-gray-600 rounded-md p-3 bg-white dark:bg-gray-900">
    <!-- Logical Operator (for conditions after the first) -->
    <div v-if="showLogicalOperator" class="mb-3">
      <select
        :value="localCondition.logicalOperator"
        @change="updateCondition({ ...localCondition, logicalOperator: $event.target.value })"
        class="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
      >
        <option value="AND">AND</option>
        <option value="OR">OR</option>
      </select>
    </div>

    <div class="flex items-center space-x-3">
      <!-- Condition Type -->
      <div class="flex-1">
        <select
          :value="localCondition.type"
          @change="updateConditionType($event.target.value)"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select condition...</option>
          <optgroup v-for="category in conditionCategories" :key="category.name" :label="category.name">
            <option 
              v-for="condition in category.conditions" 
              :key="condition.type" 
              :value="condition.type"
              :disabled="condition.disabled"
              :title="condition.disabled ? condition.disabledReason : condition.description"
              :class="{ 'text-gray-400': condition.disabled }"
            >
              {{ condition.name }}{{ condition.disabled ? ' (Not Functional)' : '' }}
            </option>
          </optgroup>
        </select>
      </div>

      <!-- Operator -->
      <div v-if="localCondition.type" class="flex-shrink-0">
        <select
          :value="localCondition.operator"
          @change="updateCondition({ ...localCondition, operator: $event.target.value })"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option 
            v-for="operator in availableOperators" 
            :key="operator.value" 
            :value="operator.value"
          >
            {{ operator.label }}
          </option>
        </select>
      </div>

      <!-- Value -->
      <div v-if="localCondition.type && needsValue" class="flex-1">
        <!-- Text input -->
        <input
          v-if="selectedConditionMeta?.valueType === 'text' || selectedConditionMeta?.valueType === 'email' || selectedConditionMeta?.valueType === 'url'"
          :type="selectedConditionMeta.valueType === 'email' ? 'email' : selectedConditionMeta.valueType === 'url' ? 'url' : 'text'"
          :value="localCondition.value"
          @input="updateCondition({ ...localCondition, value: $event.target.value })"
          :placeholder="getValuePlaceholder()"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        />

        <!-- Number input -->
        <input
          v-else-if="selectedConditionMeta?.valueType === 'number'"
          type="number"
          :value="localCondition.value"
          @input="updateCondition({ ...localCondition, value: Number($event.target.value) })"
          :placeholder="getValuePlaceholder()"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        />

        <!-- Select dropdown -->
        <select
          v-else-if="selectedConditionMeta?.valueType === 'select'"
          :value="localCondition.value"
          @change="updateCondition({ ...localCondition, value: $event.target.value })"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select value...</option>
          <option 
            v-for="option in selectedConditionMeta.options" 
            :key="option.value" 
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <!-- Boolean checkbox -->
        <div v-else-if="selectedConditionMeta?.valueType === 'boolean'" class="flex items-center">
          <input
            :id="`condition-bool-${index}`"
            type="checkbox"
            :checked="localCondition.value"
            @change="updateCondition({ ...localCondition, value: $event.target.checked })"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
          />
          <label :for="`condition-bool-${index}`" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
            True
          </label>
        </div>
      </div>

      <!-- Remove button -->
      <button
        type="button"
        @click="$emit('remove')"
        class="flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
      >
        <XMarkIcon class="w-4 h-4" />
      </button>
    </div>

    <!-- Condition Description -->
    <div v-if="selectedConditionMeta" class="mt-2">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ selectedConditionMeta.description }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  condition: {
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
  },
  showLogicalOperator: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update', 'remove'])

// Local reactive copy
const localCondition = reactive({ ...props.condition })

// Watch for external changes
watch(() => props.condition, (newCondition) => {
  Object.assign(localCondition, newCondition)
}, { deep: true })

// Computed
const conditionCategories = computed(() => {
  if (!props.metadata?.conditions) return []

  const categories = {
    message: { name: 'Message', conditions: [] },
    contact: { name: 'Contact', conditions: [] },
    conversation: { name: 'Conversation', conditions: [] },
    time: { name: 'Time', conditions: [] },
    channel: { name: 'Channel', conditions: [] }
  }

  props.metadata.conditions.forEach(condition => {
    if (categories[condition.category]) {
      categories[condition.category].conditions.push(condition)
    }
  })

  return Object.values(categories).filter(cat => cat.conditions.length > 0)
})

const selectedConditionMeta = computed(() => {
  if (!props.metadata?.conditions || !localCondition.type) return null
  return props.metadata.conditions.find(c => c.type === localCondition.type)
})

const availableOperators = computed(() => {
  if (!selectedConditionMeta.value || !props.metadata?.operators) return []
  
  return props.metadata.operators.filter(op => 
    selectedConditionMeta.value.operators.includes(op.value)
  )
})

const needsValue = computed(() => {
  if (!selectedConditionMeta.value || !localCondition.operator) return false
  
  // Some operators don't need a value (like 'exists', 'not_exists')
  const noValueOperators = ['exists', 'not_exists']
  return !noValueOperators.includes(localCondition.operator)
})

// Methods
const updateCondition = (updatedCondition) => {
  Object.assign(localCondition, updatedCondition)
  emit('update', localCondition)
}

const updateConditionType = (newType) => {
  // Reset operator and value when type changes
  const newCondition = {
    ...localCondition,
    type: newType,
    operator: 'equals',
    value: ''
  }
  
  // Set default operator for the new condition type
  const conditionMeta = props.metadata?.conditions?.find(c => c.type === newType)
  if (conditionMeta && conditionMeta.operators && conditionMeta.operators.length > 0) {
    newCondition.operator = conditionMeta.operators[0]
  }
  
  updateCondition(newCondition)
}

const getValuePlaceholder = () => {
  if (!selectedConditionMeta.value) return 'Enter value...'
  
  const placeholders = {
    message_contains: 'Enter text to search for',
    message_length_greater: 'Enter minimum length',
    message_length_less: 'Enter maximum length',
    contact_attribute_equals: 'Enter attribute value',
    conversation_message_count: 'Enter number of messages'
  }
  
  return placeholders[localCondition.type] || 'Enter value...'
}
</script>