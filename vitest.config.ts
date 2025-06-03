import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    // Run tests in series to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    // Alternative method - you can use either approach
    // threads: false,
    // fileParallelism: false
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './')
    }
  }
}) 