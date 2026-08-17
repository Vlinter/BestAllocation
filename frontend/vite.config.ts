/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.tsx',
    // Components only; the engine is tested in Python. Excluding node_modules
    // keeps `vitest` fast enough to run on every save.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
