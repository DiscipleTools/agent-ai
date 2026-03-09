<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
    <div class="flex justify-between items-start mb-4">
      <div class="flex items-center space-x-2">
        <span class="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs font-medium px-2 py-1 rounded">
          {{ index + 1 }}
        </span>
        <h4 class="text-md font-medium text-gray-900 dark:text-white">
          Action
        </h4>
      </div>
      <div class="flex space-x-1">
        <!-- Move buttons -->
        <button
          v-if="index > 0"
          type="button"
          @click="$emit('move-up')"
          class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          title="Move up"
        >
          <ChevronUpIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          @click="$emit('move-down')"
          class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          title="Move down"
        >
          <ChevronDownIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          @click="$emit('remove')"
          class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
          title="Remove"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Action Type Selection -->
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Action Type *
      </label>
      <select
        :value="localAction.type"
        @change="updateActionType($event.target.value)"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
      >
        <option value="">Select an action...</option>
        <optgroup v-for="category in actionCategories" :key="category.name" :label="category.name">
          <option 
            v-for="action in category.actions" 
            :key="action.type" 
            :value="action.type"
            :disabled="action.disabled"
            :title="action.disabled ? action.disabledReason : action.description"
            :class="{ 'text-gray-400': action.disabled }"
          >
            {{ action.name }}{{ action.disabled ? ' (Not Functional)' : '' }}
          </option>
        </optgroup>
      </select>
    </div>

    <!-- Action Description -->
    <div v-if="selectedActionMeta" class="mb-4">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ selectedActionMeta.description }}
      </p>
    </div>

    <!-- Action Parameters -->
    <div v-if="selectedActionMeta && selectedActionMeta.parameters.length > 0" class="space-y-4 mb-4">
      <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">Parameters</h5>
      
      <div
        v-for="parameter in selectedActionMeta.parameters"
        :key="parameter.name"
        class="space-y-2"
      >
        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400">
          {{ parameter.label }}
          <span v-if="parameter.required" class="text-red-500">*</span>
        </label>

        <!-- Text input -->
        <input
          v-if="parameter.type === 'text' || parameter.type === 'email' || parameter.type === 'url'"
          :type="parameter.type"
          :value="(localAction.parameters || {})[parameter.name] || ''"
          @input="updateParameter(parameter.name, $event.target.value)"
          :placeholder="parameter.placeholder"
          :required="parameter.required"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        />

        <!-- Textarea -->
        <textarea
          v-else-if="parameter.type === 'textarea'"
          :value="(localAction.parameters || {})[parameter.name] || ''"
          @input="updateParameter(parameter.name, $event.target.value)"
          :placeholder="parameter.placeholder"
          :required="parameter.required"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        ></textarea>

        <!-- Number input -->
        <input
          v-else-if="parameter.type === 'number'"
          type="number"
          :value="(localAction.parameters || {})[parameter.name] || parameter.default || ''"
          @input="updateParameter(parameter.name, Number($event.target.value))"
          :min="parameter.min"
          :max="parameter.max"
          :step="parameter.step"
          :required="parameter.required"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        />

        <!-- Select dropdown -->
        <select
          v-else-if="parameter.type === 'select'"
          :value="(localAction.parameters || {})[parameter.name] || parameter.default || ''"
          @change="updateParameter(parameter.name, $event.target.value)"
          :required="parameter.required"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select option...</option>
          <option 
            v-for="option in parameter.options" 
            :key="option.value" 
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <!-- Checkbox -->
        <div v-else-if="parameter.type === 'checkbox'" class="flex items-center">
          <input
            :id="`param-${parameter.name}-${index}`"
            type="checkbox"
            :checked="(localAction.parameters || {})[parameter.name] || parameter.default || false"
            @change="updateParameter(parameter.name, $event.target.checked)"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
          />
          <label :for="`param-${parameter.name}-${index}`" class="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {{ parameter.label }}
          </label>
        </div>

        <!-- Label Select (multi-select dropdown) -->
        <div v-else-if="parameter.type === 'label-select'" class="space-y-2">
          <!-- Selected labels as tags -->
          <div v-if="getLabelArray(parameter.name).length > 0" class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="(labelTitle, labelIndex) in getLabelArray(parameter.name)"
              :key="labelIndex"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200"
            >
              {{ labelTitle }}
              <button
                type="button"
                @click="removeLabel(parameter.name, labelIndex)"
                class="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700"
              >
                <XMarkIcon class="w-3 h-3" />
              </button>
            </span>
          </div>

          <!-- Dropdown to add labels (requires inbox context) -->
          <div v-if="inboxId">
            <div v-if="labelsLoading" class="text-sm text-gray-500 dark:text-gray-400">
              Loading labels...
            </div>
            <div v-else-if="labelsError" class="text-sm text-red-600 dark:text-red-400">
              {{ labelsError }}
            </div>
            <div v-else-if="availableLabels.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
              No labels found in this inbox. Create labels in Chatwoot first.
            </div>
            <select
              v-else
              @change="addLabelFromDropdown(parameter.name, $event.target)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a label to add...</option>
              <option
                v-for="label in getUnselectedLabels(parameter.name)"
                :key="label.id"
                :value="label.title"
              >
                {{ label.title }}
              </option>
            </select>
          </div>

          <!-- No inbox context -->
          <div v-else class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              Label selection requires inbox context. Please create or edit this agent from an inbox page.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Settings -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-600">
      <!-- Continue on Failure -->
      <!-- Continue on failure - Hidden as requested -->
      <!-- <div class="flex items-center">
        <input
          :id="`action-continue-${index}`"
          type="checkbox"
          :checked="localAction.continueOnFailure"
          @change="updateAction({ ...localAction, continueOnFailure: $event.target.checked })"
          class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
        />
        <label :for="`action-continue-${index}`" class="ml-2 text-sm text-gray-600 dark:text-gray-400">
          Continue on failure
        </label>
      </div> -->

      <!-- Delay -->
      <div>
        <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">
          Delay (seconds)
        </label>
        <input
          type="number"
          :value="localAction.delay || 0"
          @input="updateAction({ ...localAction, delay: Math.max(0, Number($event.target.value)) })"
          min="0"
          max="300"
          class="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { XMarkIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  action: {
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
  inboxId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update', 'remove', 'move-up', 'move-down'])

// API composable
const { $api } = useApi()

// Labels state
const availableLabels = ref([])
const labelsLoading = ref(false)
const labelsError = ref(null)

// Fetch labels when component mounts or inboxId changes
onMounted(async () => {
  if (props.inboxId) {
    await fetchLabels()
  }
})

watch(() => props.inboxId, (newInboxId) => {
  if (newInboxId && availableLabels.value.length === 0) {
    fetchLabels()
  }
})

const fetchLabels = async () => {
  if (!props.inboxId || labelsLoading.value) return

  labelsLoading.value = true
  labelsError.value = null

  try {
    const response = await $api(`/api/inboxes/${props.inboxId}/labels`)
    availableLabels.value = response.data?.labels || []
  } catch (error) {
    console.error('Error fetching labels:', error)
    labelsError.value = 'Failed to load labels'
    availableLabels.value = []
  } finally {
    labelsLoading.value = false
  }
}

// Local reactive copy with ensured parameters field
const localAction = reactive({
  ...props.action,
  parameters: props.action.parameters || {}
})

// Watch for external changes
watch(() => props.action, (newAction) => {
  Object.assign(localAction, {
    ...newAction,
    parameters: newAction.parameters || {}
  })
}, { deep: true })

// Computed
const actionCategories = computed(() => {
  if (!props.metadata?.actions) return []

  const categories = {
    ai: { name: 'AI-Powered', actions: [] },
    conversation: { name: 'Conversation Management', actions: [] },
    flow: { name: 'Flow Control', actions: [] }
  }

  props.metadata.actions.forEach(action => {
    if (categories[action.category]) {
      categories[action.category].actions.push(action)
    }
  })

  return Object.values(categories).filter(cat => cat.actions.length > 0)
})

const selectedActionMeta = computed(() => {
  if (!props.metadata?.actions || !localAction.type) return null
  return props.metadata.actions.find(a => a.type === localAction.type)
})

// Methods
const updateAction = (updatedAction) => {
  Object.assign(localAction, updatedAction)
  emit('update', localAction)
}

const updateActionType = (newType) => {
  const newAction = {
    ...localAction,
    type: newType,
    parameters: {}
  }
  
  // Set default parameters based on action metadata
  const actionMeta = props.metadata?.actions?.find(a => a.type === newType)
  if (actionMeta && actionMeta.parameters) {
    actionMeta.parameters.forEach(param => {
      if (param.default !== undefined) {
        newAction.parameters[param.name] = param.default
      }
    })
  }
  
  updateAction(newAction)
}

const updateParameter = (paramName, value) => {
  const newParameters = { ...(localAction.parameters || {}) }
  newParameters[paramName] = value
  updateAction({ ...localAction, parameters: newParameters })
}

// Label selection methods
const getLabelArray = (paramName) => {
  const value = (localAction.parameters || {})[paramName]
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

const removeLabel = (paramName, index) => {
  const currentLabels = getLabelArray(paramName)
  const newLabels = currentLabels.filter((_, i) => i !== index)
  updateParameter(paramName, newLabels)
}

const addLabelFromDropdown = (paramName, selectElement) => {
  const labelTitle = selectElement.value
  if (!labelTitle) return

  const currentLabels = getLabelArray(paramName)
  if (!currentLabels.includes(labelTitle)) {
    updateParameter(paramName, [...currentLabels, labelTitle])
  }

  // Reset dropdown
  selectElement.value = ''
}

const getUnselectedLabels = (paramName) => {
  const selectedLabels = getLabelArray(paramName)
  return availableLabels.value.filter(label => !selectedLabels.includes(label.title))
}
</script>