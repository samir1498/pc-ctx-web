// Anchors on every hub page: a link icon on hover that copies the address of a
// heading, a picture or a roadmap dot, and a jump to #anchor on load (opening
// the closed dot it sits in).
const TARGETS = '.doc-body :is(h1, h2, h3, h4)[id], .doc-body figure[id], article :is(h1, h2)[id], details.dot[id]'
const LINK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.7-1.7"/></svg>'

function addIcons() {
  for (const el of document.querySelectorAll<HTMLElement>(TARGETS)) {
    if (el.querySelector(':scope > .anchor-link, :scope > summary > .anchor-link')) continue
    const a = document.createElement('a')
    a.className = 'anchor-link'
    a.href = `#${el.id}`
    a.innerHTML = LINK_ICON
    a.setAttribute('aria-label', 'Copy link to this section')
    a.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      history.replaceState(null, '', `#${el.id}`)
      navigator.clipboard?.writeText(location.href).catch(() => undefined)
      a.dataset.copied = 'true'
      setTimeout(() => delete a.dataset.copied, 1500)
    })
    ;(el instanceof HTMLDetailsElement ? el.querySelector('summary') : el)?.append(a)
  }
}

function openTarget() {
  const id = decodeURIComponent(location.hash.slice(1))
  const el = id ? document.getElementById(id) : null
  if (!el) return
  for (let node: Element | null = el; node; node = node.parentElement) if (node instanceof HTMLDetailsElement) node.open = true
  el.scrollIntoView({ block: 'start' })
}

addIcons()
openTarget()
addEventListener('hashchange', openTarget)
addEventListener('keydown', (e) => {
  const t = e.target
  const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
    const box = document.querySelector<HTMLInputElement>('[data-hub-search]')
    if (box) {
      e.preventDefault()
      box.focus()
    }
  }
})
