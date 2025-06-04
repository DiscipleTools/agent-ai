<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Configure your Agent AI Server settings
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="settingsStore.loading && !settingsStore.settings" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="settingsStore.error && !settingsStore.settings" class="card">
      <div class="text-center py-8">
        <div class="text-red-600 dark:text-red-400 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Failed to load settings
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {{ settingsStore.error }}
        </p>
        <button @click="fetchSettings" class="btn-primary">
          Try Again
        </button>
      </div>
    </div>

    <!-- Settings Form -->
    <div v-else class="space-y-6">
      <!-- AI Connections Configuration -->
      <div class="card">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              AI Connections
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mt-1">
              Manage your AI service connections. All connections use the OpenAI API standard.
            </p>
          </div>
          <button @click="showAddConnection = true" class="btn-primary">
            <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Connection
          </button>
        </div>

        <!-- Default Connection Display -->
        <div v-if="settingsStore.defaultConnection" class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div class="flex items-center">
            <svg class="h-5 w-5 text-green-600 dark:text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <h4 class="font-medium text-green-800 dark:text-green-200">Default AI Connection</h4>
              <p class="text-sm text-green-600 dark:text-green-300">
                {{ settingsStore.defaultConnection.connection.name }} - {{ settingsStore.defaultConnection.model?.name || settingsStore.defaultConnection.model?.id }}
              </p>
            </div>
          </div>
        </div>

        <!-- AI Connections List -->
        <div v-if="settingsStore.aiConnections?.length" class="space-y-4">
          <div v-for="connection in settingsStore.aiConnections" :key="connection._id" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative">
            <!-- Loading overlay -->
            <div v-if="updatingConnections.has(connection._id)" class="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
              <div class="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span class="text-sm">Updating...</span>
              </div>
            </div>
            
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center">
                <div :class="[
                  'h-3 w-3 rounded-full mr-3',
                  connection.isActive ? 'bg-green-500' : 'bg-gray-400'
                ]"></div>
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">{{ connection.name || 'Loading...' }}</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ connection.endpoint || 'Loading...' }}</p>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <button 
                  v-if="connection.availableModels?.length"
                  @click="toggleConnectionModels(connection._id)" 
                  class="btn-secondary text-sm"
                  title="Show/hide models for this connection"
                >
                  <svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                  {{ expandedConnections.has(connection._id) ? 'Hide Models' : 'Manage Models' }}
                </button>
                <button @click="editConnection(connection)" class="btn-secondary text-sm">
                  Edit
                </button>
                <button @click="deleteConnection(connection)" class="btn-danger text-sm">
                  Delete
                </button>
              </div>
            </div>
            
            <!-- Models List -->
            <div v-if="connection.availableModels?.length" class="mt-3">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Available Models:</p>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ connection.availableModels.filter(m => m.enabled).length }} / {{ connection.availableModels.length }} enabled
                </span>
              </div>
              
              <!-- Collapsed view - just show model names -->
              <div v-if="!expandedConnections.has(connection._id)" class="flex flex-wrap gap-2">
                <span v-for="model in connection.availableModels" :key="model.id" :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  model.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                ]">
                  {{ model.name || model.id }}
                  <button 
                    v-if="!isDefaultModel(connection._id, model.id)"
                    @click="setAsDefault(connection._id, model.id)" 
                    class="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title="Set as default"
                  >
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  <span v-else class="ml-1 text-yellow-500" title="Default model">
                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </span>
                </span>
              </div>
              
              <!-- Expanded view - model management -->
              <div v-else class="space-y-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Click to enable/disable models for use by agents. At least one model must be enabled.
                </p>
                <div class="space-y-2 max-h-40 overflow-y-auto">
                  <div 
                    v-for="(model, index) in connection.availableModels" 
                    :key="model.id"
                    class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                  >
                    <div class="flex items-center flex-1">
                      <input
                        :id="`main-model-${connection._id}-${index}`"
                        type="checkbox"
                        :checked="model.enabled"
                        @change="toggleModelEnabledInMain(connection, index)"
                        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label 
                        :for="`main-model-${connection._id}-${index}`"
                        class="ml-2 text-sm text-gray-900 dark:text-white font-medium cursor-pointer"
                      >
                        {{ model.name || model.id }}
                      </label>
                    </div>
                    <div class="flex items-center space-x-2">
                      <button 
                        v-if="!isDefaultModel(connection._id, model.id) && model.enabled"
                        @click="setAsDefault(connection._id, model.id)" 
                        class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                        title="Set as default"
                      >
                        Set Default
                      </button>
                      <span 
                        v-if="isDefaultModel(connection._id, model.id)"
                        class="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded-full"
                      >
                        Default
                      </span>
                    </div>
                  </div>
                </div>
                <p v-if="connection.availableModels.every(m => !m.enabled)" class="text-xs text-red-500 dark:text-red-400 mt-2">
                  ⚠️ At least one model must be enabled for this connection to be usable.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- No Connections State -->
        <div v-else class="text-center py-8">
          <div class="text-gray-400 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No AI connections configured
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            Add your first AI connection to get started with Agent AI.
          </p>
          <button @click="showAddConnection = true" class="btn-primary">
            Add AI Connection
          </button>
        </div>
      </div>

      <!-- Email Configuration -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              Email Configuration
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mt-1">
              Configure email settings for user invitations and notifications.
            </p>
          </div>
          <div v-if="isEmailConfigured" class="flex items-center text-green-600 dark:text-green-400">
            <svg class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-medium">Configured</span>
          </div>
        </div>

        <div class="space-y-6">
          <!-- Enable Email Toggle -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Email Service
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Turn on email functionality for user invitations and notifications
              </p>
            </div>
            <button
              type="button"
              @click="emailForm.enabled = !emailForm.enabled"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                emailForm.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  emailForm.enabled ? 'translate-x-5' : 'translate-x-0'
                ]"
              />
            </button>
          </div>

          <div v-if="emailForm.enabled" class="space-y-4">
            <!-- Email Provider Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Provider
              </label>
              <div class="input-field bg-gray-100 dark:bg-gray-600">
                SMTP (Email Server)
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Configure your SMTP server settings below
              </p>
            </div>

            <!-- From Email Settings -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Email *
                </label>
                <input
                  v-model="emailForm.fromEmail"
                  type="email"
                  class="input-field"
                  placeholder="noreply@yourdomain.com"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Name
                </label>
                <input
                  v-model="emailForm.fromName"
                  type="text"
                  class="input-field"
                  placeholder="Agent AI Server"
                />
              </div>
            </div>

            <!-- SMTP Settings -->
            <div v-if="emailForm.enabled" class="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">SMTP Configuration</h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SMTP Host *
                  </label>
                  <input
                    v-model="emailForm.smtp.host"
                    type="text"
                    class="input-field"
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Port *
                  </label>
                  <input
                    v-model.number="emailForm.smtp.port"
                    type="number"
                    class="input-field"
                    placeholder="587"
                    required
                  />
                </div>
              </div>

              <div class="flex items-center">
                <input
                  v-model="emailForm.smtp.secure"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Use SSL/TLS (typically for port 465)
                </label>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username *
                  </label>
                  <input
                    v-model="emailForm.smtp.user"
                    type="text"
                    class="input-field"
                    placeholder="your-email@gmail.com"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password *
                  </label>
                  <div class="relative">
                    <input
                      v-model="emailForm.smtp.pass"
                      :type="showSmtpPassword ? 'text' : 'password'"
                      class="input-field pr-10"
                      :placeholder="hasSmtpPassword ? 'Leave empty to keep current password' : 'Enter SMTP password'"
                      :required="!hasSmtpPassword"
                    />
                    <button
                      type="button"
                      @click="showSmtpPassword = !showSmtpPassword"
                      class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg v-if="showSmtpPassword" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                      <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Email Actions -->
            <div class="flex items-center space-x-4 pt-4">
              <button
                type="button"
                @click="handleEmailSubmit"
                :disabled="settingsStore.loading || !isEmailFormValid"
                class="btn-primary"
              >
                <span v-if="settingsStore.loading" class="flex items-center">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </span>
                <span v-else>Save Email Settings</span>
              </button>
              
              <button
                type="button"
                @click="testEmailConfiguration"
                :disabled="testingEmail || !isEmailConfigured"
                class="btn-secondary"
              >
                <span v-if="testingEmail" class="flex items-center">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Testing...
                </span>
                <span v-else>Test Email</span>
              </button>
              
              <button
                type="button"
                @click="resetEmailForm"
                :disabled="settingsStore.loading"
                class="btn-secondary"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Info -->
      <div v-if="settingsStore.settings?.updatedBy" class="card">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Settings Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-600 dark:text-gray-400">Last updated by:</span>
            <span class="ml-2 font-medium text-gray-900 dark:text-white">
              {{ settingsStore.settings.updatedBy.name }}
            </span>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">Last updated:</span>
            <span class="ml-2 font-medium text-gray-900 dark:text-white">
              {{ formatDate(settingsStore.settings.updatedAt) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit AI Connection Modal -->
    <div v-if="showAddConnection || editingConnection" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" @click="closeConnectionModal">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {{ editingConnection ? 'Edit' : 'Add' }} AI Connection
            </h3>
            
            <form @submit.prevent="saveConnection" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Connection Name *
                </label>
                <input
                  v-model="connectionForm.name"
                  type="text"
                  class="input-field"
                  placeholder="e.g., OpenAI GPT-4, Anthropic Claude"
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider
                </label>
                <select v-model="connectionForm.provider" class="input-field">
                  <option value="openai">OpenAI</option>
                  <option value="prediction-guard">Prediction Guard</option>
                  <option value="custom">Custom OpenAI Compatible</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Endpoint *
                </label>
                <input
                  v-model="connectionForm.endpoint"
                  type="url"
                  class="input-field"
                  :placeholder="getEndpointPlaceholder()"
                  required
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The base URL for the API (e.g., https://api.openai.com/v1)
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key *
                </label>
                <div class="relative">
                  <input
                    v-model="connectionForm.apiKey"
                    :type="showConnectionApiKey ? 'text' : 'password'"
                    class="input-field pr-10"
                    :placeholder="editingConnection ? 'Leave empty to keep current API key' : 'Enter your API key'"
                    :required="!editingConnection"
                  />
                  <button
                    type="button"
                    @click="showConnectionApiKey = !showConnectionApiKey"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg v-if="showConnectionApiKey" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                    <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="flex items-center">
                <input
                  v-model="connectionForm.isActive"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Active (enable this connection for use)
                </label>
              </div>
            </form>
          </div>
          
          <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="saveConnection"
              :disabled="settingsStore.loading || !isConnectionFormValid"
              class="btn-primary w-full sm:ml-3 sm:w-auto"
            >
              <span v-if="settingsStore.loading" class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {{ editingConnection ? 'Updating...' : 'Creating...' }}
              </span>
              <span v-else>
                {{ editingConnection ? 'Update' : 'Create' }} Connection
              </span>
            </button>
            <button
              @click="closeConnectionModal"
              :disabled="settingsStore.loading"
              class="btn-secondary w-full mt-3 sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'admin']
})

const settingsStore = useSettingsStore()
const { $api } = useApi()
const showApiKey = ref(false)

// AI Connection state
const showAddConnection = ref(false)
const editingConnection = ref(null)
const showConnectionApiKey = ref(false)
const expandedConnections = ref(new Set())
const updatingConnections = ref(new Set())

// AI Connection form data
const connectionForm = reactive({
  name: '',
  provider: 'custom',
  endpoint: '',
  apiKey: '',
  isActive: true
})

// Email form data
const emailForm = reactive({
  enabled: false,
  fromEmail: '',
  fromName: 'Agent AI Server',
  smtp: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: ''
  }
})

// Email form visibility toggles
const showSmtpPassword = ref(false)
const testingEmail = ref(false)

// Computed properties
const isConnectionFormValid = computed(() => {
  const hasName = connectionForm.name.trim().length > 0
  const hasEndpoint = connectionForm.endpoint.trim().length > 0
  const hasApiKey = connectionForm.apiKey.trim().length > 0 || editingConnection.value
  
  return hasName && hasEndpoint && hasApiKey
})

// Email computed properties
const isEmailConfigured = computed(() => {
  const settings = settingsStore.settings?.email
  return settings?.enabled && settings?.from?.email
})

const isEmailFormValid = computed(() => {
  if (!emailForm.enabled) return true
  
  const hasFromEmail = emailForm.fromEmail.trim().length > 0
  
  if (emailForm.enabled) {
    const hasHost = emailForm.smtp.host.trim().length > 0
    const hasUser = emailForm.smtp.user.trim().length > 0
    const hasPass = emailForm.smtp.pass.trim().length > 0 || hasSmtpPassword.value
    return hasFromEmail && hasHost && hasUser && hasPass
  }
  
  return false
})

const hasSmtpPassword = computed(() => {
  return settingsStore.settings?.email?.smtp?.auth?.pass === '***HIDDEN***'
})

// AI Connection methods
const getEndpointPlaceholder = () => {
  switch (connectionForm.provider) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'prediction-guard':
      return 'https://api.predictionguard.com'
    default:
      return 'https://your-api-provider.com/v1'
  }
}

const editConnection = (connection) => {
  editingConnection.value = connection
  connectionForm.name = connection.name
  connectionForm.provider = connection.provider || 'custom'
  connectionForm.endpoint = connection.endpoint
  connectionForm.apiKey = ''
  connectionForm.isActive = connection.isActive
  showAddConnection.value = true
}

const closeConnectionModal = () => {
  showAddConnection.value = false
  editingConnection.value = null
  showConnectionApiKey.value = false
  
  // Reset form
  connectionForm.name = ''
  connectionForm.provider = 'custom'
  connectionForm.endpoint = ''
  connectionForm.apiKey = ''
  connectionForm.isActive = true
}

const saveConnection = async () => {
  let toast
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    const connectionData = {
      name: connectionForm.name,
      provider: connectionForm.provider,
      endpoint: connectionForm.endpoint,
      isActive: connectionForm.isActive
    }
    
    // Only include API key if provided
    if (connectionForm.apiKey.trim()) {
      connectionData.apiKey = connectionForm.apiKey
    }

    if (editingConnection.value) {
      await settingsStore.updateAIConnection(editingConnection.value._id, connectionData)
      if (toast) toast.success('AI connection updated successfully!')
    } else {
      await settingsStore.createAIConnection(connectionData)
      if (toast) toast.success('AI connection created successfully!')
    }
    
    closeConnectionModal()
  } catch (error) {
    console.error('AI connection save error:', error)
    if (toast) toast.error(error.message)
  }
}

const deleteConnection = async (connection) => {
  if (!confirm(`Are you sure you want to delete the connection "${connection.name}"?`)) {
    return
  }

  let toast
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    await settingsStore.deleteAIConnection(connection._id)
    if (toast) toast.success('AI connection deleted successfully!')
  } catch (error) {
    console.error('AI connection delete error:', error)
    if (toast) toast.error(error.message)
  }
}

const isDefaultModel = (connectionId, modelId) => {
  const defaultConn = settingsStore.defaultConnection
  return defaultConn?.connection._id === connectionId && defaultConn?.model?.id === modelId
}

const setAsDefault = async (connectionId, modelId) => {
  let toast
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    await settingsStore.setDefaultAI(connectionId, modelId)
    if (toast) toast.success('Default AI connection updated!')
  } catch (error) {
    console.error('Set default AI error:', error)
    if (toast) toast.error(error.message)
  }
}

const toggleConnectionModels = (connectionId) => {
  if (expandedConnections.value.has(connectionId)) {
    expandedConnections.value.delete(connectionId)
  } else {
    expandedConnections.value.add(connectionId)
  }
}

const toggleModelEnabledInMain = async (connection, modelIndex) => {
  let toast
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    // Mark this connection as updating
    updatingConnections.value.add(connection._id)
    
    // Store the expanded state before update
    const wasExpanded = expandedConnections.value.has(connection._id)
    
    // Update the model's enabled state
    const updatedModels = [...connection.availableModels]
    updatedModels[modelIndex].enabled = !updatedModels[modelIndex].enabled
    
    // Update the connection
    await settingsStore.updateAIConnection(connection._id, {
      availableModels: updatedModels
    })
    
    // Restore the expanded state after update
    if (wasExpanded) {
      expandedConnections.value.add(connection._id)
    }
    
  } catch (error) {
    console.error('Toggle model error:', error)
    if (toast) toast.error(error.message)
  } finally {
    // Remove loading state
    updatingConnections.value.delete(connection._id)
  }
}

// Email methods
const handleEmailSubmit = async () => {
  let toast
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    const updateData = {
      predictionGuard: {
        endpoint: form.endpoint,
        model: form.model
      },
      email: {
        enabled: emailForm.enabled,
        from: {
          email: emailForm.fromEmail,
          name: emailForm.fromName
        }
      }
    }
    
    if (emailForm.enabled) {
      updateData.email.smtp = {
        host: emailForm.smtp.host,
        port: emailForm.smtp.port,
        secure: emailForm.smtp.secure,
        auth: {
          user: emailForm.smtp.user
        }
      }
      
      if (emailForm.smtp.pass.trim()) {
        updateData.email.smtp.auth.pass = emailForm.smtp.pass
      }
    }
    
    await settingsStore.updateSettings(updateData)
    
    if (toast) {
      toast.success('Email settings saved successfully!')
    }
    
    emailForm.smtp.pass = ''
    showSmtpPassword.value = false
    
  } catch (error) {
    console.error('Email settings save error:', error)
    
    let errorMessage = 'Failed to save email settings'
    
    try {
      if (error && typeof error === 'object') {
        if (typeof error.message === 'string') {
          errorMessage = error.message
        } else if (error.data && typeof error.data.message === 'string') {
          errorMessage = error.data.message
        } else if (typeof error.statusMessage === 'string') {
          errorMessage = error.statusMessage
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
    } catch (parseError) {
      console.error('Error parsing error:', parseError)
      errorMessage = 'Failed to save email settings'
    }
    
    if (toast) {
      try {
        toast.error(errorMessage)
      } catch (toastError) {
        console.error('Could not show toast error:', toastError)
      }
    }
  }
}

const testEmailConfiguration = async () => {
  testingEmail.value = true
  let toast
  
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    const { $api } = useApi()
    const response = await $api('/api/settings/test-email', {
      method: 'POST'
    })
    
    if (toast) {
      toast.success(response.message || 'Email configuration test successful!')
    }
  } catch (error) {
    console.error('Email test error:', error)
    
    let errorMessage = 'Email configuration test failed'
    
    try {
      if (error && typeof error === 'object') {
        if (typeof error.message === 'string') {
          errorMessage = error.message
        } else if (error.data && typeof error.data.message === 'string') {
          errorMessage = error.data.message
        } else if (typeof error.statusMessage === 'string') {
          errorMessage = error.statusMessage
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
    } catch (parseError) {
      console.error('Error parsing error:', parseError)
      errorMessage = 'Email configuration test failed'
    }
    
    if (toast) {
      try {
        toast.error(errorMessage)
      } catch (toastError) {
        console.error('Could not show toast error:', toastError)
      }
    }
  } finally {
    testingEmail.value = false
  }
}

const resetEmailForm = () => {
  emailForm.enabled = false
  emailForm.fromEmail = ''
  emailForm.fromName = 'Agent AI Server'
  emailForm.smtp.host = ''
  emailForm.smtp.port = 587
  emailForm.smtp.secure = false
  emailForm.smtp.user = ''
  emailForm.smtp.pass = ''
  showSmtpPassword.value = false
}

// General methods
const fetchSettings = async () => {
  try {
    await settingsStore.fetchSettings()
    if (settingsStore.settings) {
      // Populate email settings
      if (settingsStore.settings.email) {
        const email = settingsStore.settings.email
        emailForm.enabled = email.enabled || false
        emailForm.fromEmail = email.from?.email || ''
        emailForm.fromName = email.from?.name || 'Agent AI Server'
        
        if (email.smtp) {
          emailForm.smtp.host = email.smtp.host || ''
          emailForm.smtp.port = email.smtp.port || 587
          emailForm.smtp.secure = email.smtp.secure || false
          emailForm.smtp.user = email.smtp.auth?.user || ''
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    if (error && error.message && !error.message.includes('Access token required')) {
      const { $toast } = useNuxtApp()
      
      let errorMessage = 'Failed to load settings'
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message
        } else if (error.data && error.data.message) {
          errorMessage = error.data.message
        } else if (error.statusMessage) {
          errorMessage = error.statusMessage
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      $toast.error(errorMessage)
    }
  }
}

const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

// Fetch settings on mount
onMounted(() => {
  fetchSettings()
})
</script> 