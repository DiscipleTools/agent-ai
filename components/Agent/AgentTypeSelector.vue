<template>
  <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
    <div class="text-center mb-8">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        What type of agent do you want to create?
      </h2>
      <p class="text-gray-600 dark:text-gray-400">
        Choose from our pre-configured agent templates to get started quickly
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Response Agent -->
      <div 
        @click="selectType(agentTypes.response)"
        class="group cursor-pointer border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-primary-500 hover:shadow-md transition-all duration-200"
      >
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
              <ChatBubbleLeftRightIcon class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Response Agent
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Automatically responds to incoming messages using AI-generated replies based on conversation context.
            </p>
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                AI Response
              </span>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                Real-time
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Summarize Conversation -->
      <div 
        @click="selectType(agentTypes.summarize)"
        class="group cursor-pointer border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-primary-500 hover:shadow-md transition-all duration-200"
      >
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
              <DocumentTextIcon class="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Summarize Conversation
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Creates intelligent summaries of conversations when they are resolved or reach specific conditions.
            </p>
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">
                AI Summary
              </span>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                Automated
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Assignment Workflow -->
      <div 
        @click="selectType(agentTypes.assignment)"
        class="group cursor-pointer border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-primary-500 hover:shadow-md transition-all duration-200"
      >
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
              <UserGroupIcon class="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Assignment Workflow
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Automatically assigns conversations to specific agents based on conditions like language, topic, or customer attributes.
            </p>
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                Smart Routing
              </span>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                Conditional
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Status Workflow -->
      <div 
        @click="selectType(agentTypes.status)"
        class="group cursor-pointer border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-primary-500 hover:shadow-md transition-all duration-200"
      >
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
              <ClipboardDocumentCheckIcon class="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Status Workflow
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Automatically changes conversation status based on conditions like sentiment analysis, keywords, or time-based rules.
            </p>
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200">
                Status Control
              </span>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                Rule-based
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { 
  ChatBubbleLeftRightIcon, 
  DocumentTextIcon, 
  UserGroupIcon, 
  ClipboardDocumentCheckIcon 
} from '@heroicons/vue/24/outline'

const emit = defineEmits(['select'])

// Agent type definitions
const agentTypes = {
  response: {
    id: 'response',
    name: 'Response Agent',
    description: 'Automatically responds to incoming messages',
    trigger: {
      type: 'message_created'
    },
    actions: [
      {
        type: 'ai_response',
        parameters: {
          useContext: true,
          includeHistory: true
        },
        order: 1,
        continueOnFailure: false,
        delay: 0
      }
    ]
  },
  summarize: {
    id: 'summarize',
    name: 'Summarize Conversation',
    description: 'Creates intelligent summaries of conversations',
    trigger: {
      type: 'conversation_status_changed'
    },
    actions: [
      {
        type: 'ai_summarize',
        parameters: {
          maxLength: 150
        },
        order: 1,
        continueOnFailure: false,
        delay: 0
      }
    ]
  },
  assignment: {
    id: 'assignment',
    name: 'Assignment Workflow',
    description: 'Automatically assigns conversations based on conditions',
    trigger: {
      type: 'conversation_created'
    },
    actions: [
      {
        type: 'assign_agent',
        parameters: {
          agentId: ''
        },
        order: 1,
        continueOnFailure: false,
        delay: 0
      }
    ]
  },
  status: {
    id: 'status',
    name: 'Status Workflow',
    description: 'Changes conversation status based on conditions',
    trigger: {
      type: 'message_created'
    },
    actions: [
      {
        type: 'change_status',
        parameters: {
          status: 'resolved'
        },
        order: 1,
        continueOnFailure: false,
        delay: 0
      }
    ]
  }
}

const selectType = (agentType) => {
  emit('select', agentType)
}
</script>

