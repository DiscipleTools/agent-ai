<template>
  <div class="space-y-6">
    <!-- Response Agent Section -->
    <div class="bg-white p-6 rounded-lg border border-gray-200">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-medium text-gray-900">Response Agent</h3>
          <p class="text-sm text-gray-600">The agent that will generate and send responses to customers</p>
        </div>
        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
          Maximum: 1 agent
        </span>
      </div>

      <div v-if="responseAgent" class="bg-gray-50 p-4 rounded-md">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <UserIcon class="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 class="font-medium text-gray-900">{{ responseAgent.name }}</h4>
              <p class="text-sm text-gray-600">{{ responseAgent.description || 'No description' }}</p>
              <p class="text-xs text-gray-500 mt-1">
                Assigned {{ formatDate(responseAgent.assignedAt) }}
              </p>
            </div>
          </div>
          
          <div class="flex items-center space-x-2">
            <button
              @click="editResponseAgentConfig"
              class="text-sm text-blue-600 hover:text-blue-800"
            >
              Configure
            </button>
            <button
              @click="removeResponseAgent"
              class="text-sm text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <div v-else class="bg-gray-50 p-4 rounded-md border-2 border-dashed border-gray-300">
        <div class="text-center">
          <UserIcon class="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p class="text-sm text-gray-600 mb-3">No response agent assigned</p>
          
          <select
            v-model="selectedResponseAgent"
            class="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
          >
            <option value="">Select a response agent</option>
            <option 
              v-for="agent in availableResponseAgents" 
              :key="agent._id" 
              :value="agent._id"
            >
              {{ agent.name }}
            </option>
          </select>
          
          <button
            @click="assignResponseAgent"
            :disabled="!selectedResponseAgent"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Assign Response Agent
          </button>
        </div>
      </div>
    </div>

    <!-- Processing Pipeline Section -->
    <div class="bg-white p-6 rounded-lg border border-gray-200">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-medium text-gray-900">Processing Pipeline</h3>
          <p class="text-sm text-gray-600">Additional agents that process messages (analytics, moderation, etc.)</p>
        </div>
        <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
          Multiple agents allowed
        </span>
      </div>

      <!-- Existing Pipeline Agents -->
      <div v-if="pipelineAgents.length > 0" class="space-y-3 mb-6">
        <div class="space-y-3">
          <div v-for="agent in pipelineAgents" :key="agent._id" class="bg-gray-50 p-4 rounded-md border">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="flex items-center space-x-2">
                  <div 
                    :class="[
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
                      getAgentTypeColor(agent.agentType)
                    ]"
                  >
                    {{ agent.priority }}
                  </div>
                </div>
                
                <div>
                  <div class="flex items-center space-x-2">
                    <h4 class="font-medium text-gray-900">{{ agent.name }}</h4>
                    <span 
                      :class="[
                        'px-2 py-1 text-xs rounded-full font-medium',
                        getAgentTypeColor(agent.agentType, 'badge')
                      ]"
                    >
                      {{ agent.agentType }}
                    </span>
                    <input
                      type="checkbox" 
                      v-model="agent.isActive" 
                      @change="updateAgentStatus(agent)"
                      class="rounded border-gray-300"
                    />
                  </div>
                  <p class="text-sm text-gray-600">{{ agent.description || 'No description' }}</p>
                  <p class="text-xs text-gray-500">
                    Priority: {{ agent.priority }} • 
                    Assigned {{ formatDate(agent.assignedAt) }}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <button
                  @click="editAgentConfig(agent)"
                  class="text-sm text-blue-600 hover:text-blue-800"
                >
                  Configure
                </button>
                <button
                  @click="removeAgent(agent)"
                  class="text-sm text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add New Agent -->
      <div class="bg-gray-50 p-4 rounded-md border-2 border-dashed border-gray-300">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Agent</label>
            <select
              v-model="newAgent.agentId"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Select an agent</option>
              <option 
                v-for="agent in availablePipelineAgents" 
                :key="agent._id" 
                :value="agent._id"
              >
                {{ agent.name }} ({{ agent.agentType }})
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input
              v-model.number="newAgent.priority"
              type="number"
              min="1"
              max="999"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="100"
            />
            <p class="text-xs text-gray-500 mt-1">
              Lower = earlier execution
            </p>
          </div>
          
          <div class="md:col-span-2">
            <button
              @click="addAgent"
              :disabled="!newAgent.agentId"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add to Pipeline
            </button>
          </div>
        </div>
      </div>

      <!-- Priority Legend -->
      <div class="mt-6 p-4 bg-blue-50 rounded-md">
        <h4 class="text-sm font-medium text-gray-900 mb-2">Processing Order</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span class="font-medium">Pre-process (1-99)</span>
            <p class="text-gray-600">Sequential, before response</p>
          </div>
          <div>
            <span class="font-medium">Main (100-199)</span>
            <p class="text-gray-600">Parallel processing</p>
          </div>
          <div>
            <span class="font-medium">Post-process (200+)</span>
            <p class="text-gray-600">Sequential, after response</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration Modal -->
    <div v-if="configModal.show" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            Configure {{ configModal.agent.name }}
          </h3>
          
          <div class="space-y-4">
            <div v-if="configModal.type === 'pipeline'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <input
                v-model.number="configModal.config.priority"
                type="number"
                min="1"
                max="999"
                class="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Custom Configuration (JSON)</label>
              <textarea
                v-model="configModal.configJson"
                rows="6"
                class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                placeholder='{"key": "value"}'
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">
                Optional configuration overrides for this inbox
              </p>
            </div>
          </div>
          
          <div class="flex items-center justify-end space-x-3 mt-6">
            <button
              @click="closeConfigModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              @click="saveAgentConfig"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { UserIcon, Bars3Icon } from '@heroicons/vue/24/outline'

const props = defineProps({
  inbox: {
    type: Object,
    required: true
  }
})

const emit = defineEmits([
  'response-agent-assigned',
  'response-agent-removed', 
  'agent-added',
  'agent-removed',
  'agent-updated'
])

// Data
const availableResponseAgents = ref([])
const availablePipelineAgents = ref([])
const selectedResponseAgent = ref('')
const pipelineAgents = ref([])

const newAgent = ref({
  agentId: '',
  priority: 100
})

const configModal = ref({
  show: false,
  type: '', // 'response' or 'pipeline'
  agent: null,
  config: {},
  configJson: ''
})

// Computed
const responseAgent = computed(() => {
  if (!props.inbox.responseAgent?.agentId) return null
  return {
    ...props.inbox.responseAgent.agentId,
    assignedAt: props.inbox.responseAgent.assignedAt,
    config: props.inbox.responseAgent.config
  }
})

// Methods
const loadAvailableAgents = async () => {
  try {
    // Load available response agents
    const responseAgentsRes = await $fetch('/api/agents', {
      query: { agentType: 'response', available: 'true' }
    })
    availableResponseAgents.value = responseAgentsRes.data || []

    // Load available pipeline agents
    const pipelineAgentsRes = await $fetch('/api/agents', {
      query: { 
        agentType: ['pre-process', 'analytics', 'moderation', 'routing', 'post-process'],
        available: 'true'
      }
    })
    availablePipelineAgents.value = pipelineAgentsRes.data || []
    
  } catch (error) {
    console.error('Error loading available agents:', error)
  }
}

const loadPipelineAgents = () => {
  pipelineAgents.value = props.inbox.agents?.map(agent => ({
    ...agent,
    ...agent.agentId, // Flatten agent details
    _id: agent.agentId._id
  })) || []
}

const assignResponseAgent = async () => {
  try {
    const { csrfRequest } = useCsrf()
    await csrfRequest(`/api/inboxes/${props.inbox._id}/agents/response`, {
      method: 'PUT',
      body: {
        agentId: selectedResponseAgent.value,
        config: {}
      }
    })
    
    selectedResponseAgent.value = ''
    emit('response-agent-assigned')
  } catch (error) {
    console.error('Error assigning response agent:', error)
  }
}

const removeResponseAgent = async () => {
  try {
    const { csrfRequest } = useCsrf()
    await csrfRequest(`/api/inboxes/${props.inbox._id}/agents/response`, {
      method: 'DELETE'
    })
    
    emit('response-agent-removed')
  } catch (error) {
    console.error('Error removing response agent:', error)
  }
}

const addAgent = async () => {
  try {
    const { csrfRequest } = useCsrf()
    await csrfRequest(`/api/inboxes/${props.inbox._id}/agents`, {
      method: 'POST',
      body: {
        agentId: newAgent.value.agentId,
        priority: newAgent.value.priority || 100,
        config: {}
      }
    })
    
    newAgent.value = { agentId: '', priority: 100 }
    emit('agent-added')
  } catch (error) {
    console.error('Error adding agent:', error)
  }
}

const removeAgent = async (agent) => {
  try {
    const { csrfRequest } = useCsrf()
    await csrfRequest(`/api/inboxes/${props.inbox._id}/agents/${agent._id}`, {
      method: 'DELETE'
    })
    
    emit('agent-removed')
  } catch (error) {
    console.error('Error removing agent:', error)
  }
}

const updateAgentStatus = async (agent) => {
  try {
    const { csrfRequest } = useCsrf()
    await csrfRequest(`/api/inboxes/${props.inbox._id}/agents/${agent._id}`, {
      method: 'PUT',
      body: {
        isActive: agent.isActive
      }
    })
    
    emit('agent-updated')
  } catch (error) {
    console.error('Error updating agent status:', error)
  }
}


const editResponseAgentConfig = () => {
  configModal.value = {
    show: true,
    type: 'response',
    agent: responseAgent.value,
    config: { ...responseAgent.value.config },
    configJson: JSON.stringify(responseAgent.value.config || {}, null, 2)
  }
}

const editAgentConfig = (agent) => {
  configModal.value = {
    show: true,
    type: 'pipeline',
    agent,
    config: { 
      priority: agent.priority,
      ...agent.config 
    },
    configJson: JSON.stringify(agent.config || {}, null, 2)
  }
}

const closeConfigModal = () => {
  configModal.value = {
    show: false,
    type: '',
    agent: null,
    config: {},
    configJson: ''
  }
}

const saveAgentConfig = async () => {
  try {
    let parsedConfig = {}
    
    if (configModal.value.configJson.trim()) {
      parsedConfig = JSON.parse(configModal.value.configJson)
    }
    
    const updateData = {
      config: parsedConfig
    }
    
    if (configModal.value.type === 'pipeline') {
      updateData.priority = configModal.value.config.priority
    }
    
    const { csrfRequest } = useCsrf()
    if (configModal.value.type === 'response') {
      await csrfRequest(`/api/inboxes/${props.inbox._id}/agents/response`, {
        method: 'PUT',
        body: {
          agentId: configModal.value.agent._id,
          config: parsedConfig
        }
      })
    } else {
      await csrfRequest(`/api/inboxes/${props.inbox._id}/agents/${configModal.value.agent._id}`, {
        method: 'PUT',
        body: updateData
      })
    }
    
    closeConfigModal()
    emit('agent-updated')
  } catch (error) {
    console.error('Error saving agent configuration:', error)
  }
}

const getAgentTypeColor = (type, variant = 'icon') => {
  const colors = {
    'pre-process': variant === 'badge' ? 'bg-purple-100 text-purple-800' : 'bg-purple-100 text-purple-600',
    'analytics': variant === 'badge' ? 'bg-blue-100 text-blue-800' : 'bg-blue-100 text-blue-600',
    'moderation': variant === 'badge' ? 'bg-red-100 text-red-800' : 'bg-red-100 text-red-600',
    'routing': variant === 'badge' ? 'bg-green-100 text-green-800' : 'bg-green-100 text-green-600',
    'post-process': variant === 'badge' ? 'bg-orange-100 text-orange-800' : 'bg-orange-100 text-orange-600'
  }
  return colors[type] || (variant === 'badge' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-600')
}

const formatDate = (date) => {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Lifecycle
onMounted(() => {
  loadAvailableAgents()
  loadPipelineAgents()
})
</script>