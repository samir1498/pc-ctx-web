import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

// Mockup build is static; the real hub switches to output: 'server' with @astrojs/cloudflare.
export default defineConfig({
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
})
