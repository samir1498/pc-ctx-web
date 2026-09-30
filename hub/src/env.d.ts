/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: string
    meter: import('./source/github').Meter
    hub: import('./server/hub').Hub
  }
}

declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>
}
