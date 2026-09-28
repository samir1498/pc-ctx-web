import { createFileRoute, Outlet } from '@tanstack/react-router'

// Layout for a document folder (reports, standups, handoffs, ...): the index
// lives in p.$project.$folder.index.tsx and one page in p.$project.$folder.$slug.tsx.
// Static siblings (plans, plan/$slug) rank above this dynamic segment.
export const Route = createFileRoute('/p/$project/$folder')({
  component: Outlet,
})
