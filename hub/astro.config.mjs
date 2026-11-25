import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import cloudflare from '@astrojs/cloudflare'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'server',
  // HUB_WRANGLER_CONFIG points a local run at a wrangler file with local KV and a local GitHub stand-in (scripts/local-github.mjs).
  adapter: cloudflare({ imageService: 'passthrough', configPath: process.env.HUB_WRANGLER_CONFIG }),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
})
