import type { ContextItem, ContextItemDetail } from '../types'

// ── Mock demo data for pc-ctx-web UI preview ────────────────────────
// Used when VITE_DEMO=true or DEMO=true to render without a real API.

export const mockFolders: Record<string, ContextItem[]> = {
  plans: [
    {
      slug: 'auth-email-verification-password-reset-social-login',
      name: 'Auth: Email verification, password reset, social login',
      path: 'plans/auth-email-verification-password-reset-social-login.md',
      frontmatter: {
        title: 'Auth: Email verification, password reset, social login',
        slug: 'auth-email-verification-password-reset-social-login',
        status: 'active',
        category: 'auth',
        created: 20260629,
        priority: 85,
        tldr: 'Production-grade auth: verify emails, reset passwords, Google + GitHub OAuth',
        tags: ['auth', 'security', 'oauth'],
        tasks: '0/16',
      },
    },
    {
      slug: 'infra-move-pg-to-supabase-email-provider',
      name: 'Infra: Move PG to Supabase, email provider',
      path: 'plans/infra-move-pg-to-supabase-email-provider.md',
      frontmatter: {
        title: 'Infra: Move PG to Supabase, email provider',
        slug: 'infra-move-pg-to-supabase-email-provider',
        status: 'active',
        category: 'infrastructure',
        created: 20260629,
        priority: 90,
        tldr: 'Swap Render PostgreSQL for Supabase, choose and wire an email sending provider',
        tags: ['infra', 'postgres', 'supabase', 'email'],
        tasks: '1/6',
      },
    },
    {
      slug: 'zone-ux-filtering-detail-page-gallery',
      name: 'Zone UX: Filtering, detail page, gallery',
      path: 'plans/zone-ux-filtering-detail-page-gallery.md',
      frontmatter: {
        title: 'Zone UX: Filtering, detail page, gallery',
        slug: 'zone-ux-filtering-detail-page-gallery',
        status: 'active',
        category: 'user-experience',
        created: 20260629,
        priority: 65,
        tldr: 'Filter/search zones on map, full-screen detail view, photo gallery',
        tags: ['frontend', 'ux', 'map', 'gallery'],
        tasks: '0/6',
      },
    },
    {
      slug: 'go-backend-parity-with-nestjs',
      name: 'Go backend parity with NestJS',
      path: 'plans/go-backend-parity-with-nestjs.md',
      frontmatter: {
        title: 'Go backend parity with NestJS',
        slug: 'go-backend-parity-with-nestjs',
        status: 'active',
        category: 'backend',
        created: 20260703,
        priority: 80,
        tldr: 'Align Go backend capabilities with existing NestJS endpoint rules and behaviors',
        tags: ['go', 'backend', 'parity'],
        tasks: '—',
      },
    },
    {
      slug: 'monstock-tauri-react-frontend-with-tanstack-shadcn',
      name: 'MonStock Tauri React frontend with TanStack + shadcn',
      path: 'plans/monstock-tauri-react-frontend-with-tanstack-shadcn.md',
      frontmatter: {
        title: 'MonStock Tauri React frontend with TanStack + shadcn',
        slug: 'monstock-tauri-react-frontend-with-tanstack-shadcn',
        status: 'active',
        category: 'feature',
        created: 20260626,
        priority: 75,
        tldr: 'New monstock-tauri workspace crate replacing egui frontend with React',
        tags: ['rust', 'tauri', 'react', 'tanstack', 'shadcn'],
        tasks: '1/8',
      },
    },
    {
      slug: 'dev-tmux-script',
      name: 'Dev Tmux + Backend Switcher Script',
      path: 'plans/dev-tmux-script.md',
      frontmatter: {
        title: 'Dev Tmux + Backend Switcher Script',
        slug: 'dev-tmux-script',
        status: 'done',
        category: 'infra',
        created: 20260616,
        priority: 20,
        tldr: 'Single tmux session + bash script to start and switch between backends',
        tags: ['dev-tools', 'tmux', 'docker'],
        tasks: '4/4',
      },
    },
    {
      slug: 'e2e-real-api-smoke',
      name: 'Real-API E2E Smoke Tests for iNaturalist/GBIF',
      path: 'plans/e2e-real-api-smoke.md',
      frontmatter: {
        title: 'Real-API E2E Smoke Tests for iNaturalist/GBIF',
        slug: 'e2e-real-api-smoke',
        status: 'done',
        category: 'gam',
        created: 20260616,
        priority: 20,
        tldr: 'Non-blocking CI job running tree-species E2E tests against real APIs',
        tags: ['testing', 'e2e', 'ci', 'playwright'],
        tasks: '4/4',
      },
    },
  ],
  roadmaps: [
    {
      slug: '20260629-green-algeria-map-feature-complete',
      name: 'Green Algeria Map — Feature Complete',
      path: 'roadmaps/20260629-green-algeria-map-feature-complete.md',
      frontmatter: {
        title: 'Green Algeria Map — Feature Complete',
        slug: '20260629-green-algeria-map-feature-complete',
        status: 'active',
        period: 'Q3 2026',
        tldr: 'Roadmap to feature-complete Green Algeria Map platform',
        entries: [
          { ref: 'auth-email-verification-password-reset-social-login', status: 'in-progress' },
          { ref: 'infra-move-pg-to-supabase-email-provider', status: 'next' },
        ],
      },
    },
  ],
  progress: [
    {
      slug: '2026-07-03',
      name: '2026-07-03',
      path: 'progress/2026-07-03.md',
      frontmatter: {
        title: '2026-07-03',
        created: 20260703,
      },
      body: '## Done\n- Archived 37 done plans\n- Dev tmux script\n- Real API E2E smoke tests\n- Effort ordering\n## Next\n- Web UI demo video\n- Date range querying\n- MonStock architecture docs',
    },
  ],
  references: [
    {
      slug: 'better-auth-setup',
      name: 'Better Auth Setup Reference',
      path: 'references/better-auth-setup.md',
      frontmatter: {
        title: 'Better Auth Setup Reference',
        created: 20260615,
        tags: ['auth', 'reference'],
      },
    },
  ],
  ideas: [],
  processes: [],
  archive: [],
  handoffs: [],
}

export const mockPlansDetail: Record<string, ContextItemDetail> = {
  'auth-email-verification-password-reset-social-login': {
    slug: 'auth-email-verification-password-reset-social-login',
    name: 'Auth: Email verification, password reset, social login',
    path: 'plans/auth-email-verification-password-reset-social-login.md',
    frontmatter: {
      title: 'Auth: Email verification, password reset, social login',
      slug: 'auth-email-verification-password-reset-social-login',
      status: 'active',
      category: 'auth',
      created: 20260629,
      priority: 85,
      tldr: 'Production-grade auth: verify emails, reset passwords, Google + GitHub OAuth',
      tags: ['auth', 'security', 'oauth'],
      tasks: [
        { id: 'T1', title: 'Email verification flow (NestJS)', status: 'pending' },
        { id: 'T2', title: 'Password reset flow (NestJS)', status: 'pending' },
        { id: 'T3', title: 'Google OAuth (NestJS)', status: 'pending' },
        { id: 'T4', title: 'GitHub OAuth (NestJS)', status: 'pending' },
        { id: 'T5', title: 'Email verification flow (Go)', status: 'pending' },
        { id: 'T6', title: 'Password reset flow (Go)', status: 'pending' },
        { id: 'T7', title: 'Social login (Go)', status: 'pending' },
        { id: 'T8', title: 'Email verification flow (Spring Boot)', status: 'pending' },
        { id: 'T9', title: 'Password reset flow (Spring Boot)', status: 'pending' },
        { id: 'T10', title: 'Social login (Spring Boot)', status: 'pending' },
        { id: 'T11', title: 'Frontend: verification pages', status: 'pending' },
        { id: 'T12', title: 'Frontend: reset password pages', status: 'pending' },
        { id: 'T13', title: 'Frontend: social login buttons', status: 'pending' },
        { id: 'T14', title: 'E2E tests for auth flows', status: 'pending' },
        { id: 'T15', title: 'Rate limiting on auth endpoints', status: 'pending' },
        { id: 'T16', title: 'Security audit', status: 'pending' },
      ],
    },
    body: `# Auth: Email verification, password reset, social login

## Goal

Add production-grade authentication flows to Green Algeria Map.

## Scope

### In scope

- Email verification (resend, confirm, rate-limited resend)
- Password reset (request via email, reset with token, expiration)
- Social login (Google, GitHub) via BetterAuth

### Out of scope

- SMS/MFA
- SAML/Enterprise SSO

## Tasks

| Task | Backend | Status |
|------|---------|--------|
| T1 | NestJS | Pending |
| T2 | NestJS | Pending |
| T3 | NestJS | Pending |
| T4 | NestJS | Pending |
| T5-T7 | Go | Pending |
| T8-T10 | Spring Boot | Pending |
| T11-T13 | Frontend | Pending |
| T14 | E2E | Pending |

## Dependencies

- BetterAuth library configured and working (done)
- Email provider selected (see infra plan)`,
  },
  'infra-move-pg-to-supabase-email-provider': {
    slug: 'infra-move-pg-to-supabase-email-provider',
    name: 'Infra: Move PG to Supabase, email provider',
    path: 'plans/infra-move-pg-to-supabase-email-provider.md',
    frontmatter: {
      title: 'Infra: Move PG to Supabase, email provider',
      slug: 'infra-move-pg-to-supabase-email-provider',
      status: 'active',
      category: 'infrastructure',
      created: 20260629,
      priority: 90,
      tldr: 'Swap Render PostgreSQL for Supabase, choose and wire an email sending provider',
      tags: ['infra', 'postgres', 'supabase', 'email'],
      tasks: [
        { id: 'T1', title: 'Research Supabase pricing (free tier)', status: 'done' },
        { id: 'T2', title: 'Create Supabase project and migrate data', status: 'pending' },
        { id: 'T3', title: 'Update connection strings across backends', status: 'pending' },
        { id: 'T4', title: 'Choose email provider (Resend/SendGrid/SES)', status: 'pending' },
        { id: 'T5', title: 'Wire email sending in NestJS, Go, Spring Boot', status: 'pending' },
        { id: 'T6', title: 'Update CI and local dev compose', status: 'pending' },
      ],
    },
    body: `# Infra: Move PG to Supabase, email provider

## Goal

Reduce hosting costs and add email sending capability.

## Progress

T1 complete: Supabase free tier includes 500 MB PostgreSQL, auth, and email.
`,
  },
}

export const mockRoadmapsDetail: Record<string, ContextItemDetail> = {
  '20260629-green-algeria-map-feature-complete': {
    slug: '20260629-green-algeria-map-feature-complete',
    name: 'Green Algeria Map — Feature Complete',
    path: 'roadmaps/20260629-green-algeria-map-feature-complete.md',
    frontmatter: {
      title: 'Green Algeria Map — Feature Complete',
      slug: '20260629-green-algeria-map-feature-complete',
      status: 'active',
      period: 'Q3 2026',
      tldr: 'Roadmap to feature-complete Green Algeria Map platform',
    },
    body: `# Roadmap: Q3 2026

| Phase | Item | Status |
|-------|------|--------|
| **Foundation** | Auth flows | In progress |
| **Foundation** | Email provider | Next |
| **Foundation** | User profiles | Planned |
| **UX** | Zone filtering | Planned |
| **UX** | Photo gallery | Planned |
| **Infra** | Supabase migration | Next |
`,
  },
}