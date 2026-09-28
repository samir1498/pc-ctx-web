import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { execSync } from 'child_process'
import pkg from './package.json'

const gitHash = (() => {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim() }
  catch { return 'dev' }
})()

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  define: {
    __GIT_HASH__: JSON.stringify(gitHash),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: { outDir: 'dist' },
  // `npm run hub:local` serves the API on 4780; the Vite dev server forwards
  // /api there so the client hot-reloads against real stores.
  server: { proxy: { '/api': 'http://127.0.0.1:4780' } },
})
