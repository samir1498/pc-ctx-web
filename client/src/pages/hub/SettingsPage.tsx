import { useEffect, useState } from 'react'
import {
  useConfig,
  useGithubBranches,
  useGithubRepos,
  useGithubTree,
  useFsListing,
  useRemoveToken,
  useSaveProjects,
  useSaveToken,
} from '../../hooks/useContext'
import type { Audience, ProjectConfigEntry } from '../../types'

interface ProjectDraft {
  id: string
  name: string
  source: 'disk' | 'github'
  audience: Audience
  dir: string
  owner: string
  repo: string
  branch: string
  folder: string
}

function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-project'
}

function toDraft(p: ProjectConfigEntry): ProjectDraft {
  const base = { id: p.id, name: p.name, audience: p.audience ?? 'engineering', dir: '', owner: '', repo: '', branch: '', folder: '' }
  if (p.source === 'disk') return { ...base, source: 'disk', dir: p.dir }
  return { ...base, source: 'github', owner: p.owner, repo: p.repo, branch: p.branch, folder: p.folder }
}

function toEntry(d: ProjectDraft): ProjectConfigEntry {
  if (d.source === 'disk') return { id: d.id, name: d.name, source: 'disk', dir: d.dir, audience: d.audience }
  return { id: d.id, name: d.name, source: 'github', owner: d.owner, repo: d.repo, branch: d.branch, folder: d.folder, audience: d.audience }
}

function FsBrowser({ initialPath, onSelect, onClose }: { initialPath: string; onSelect: (path: string) => void; onClose: () => void }) {
  const [path, setPath] = useState<string | undefined>(initialPath || undefined)
  const { data, isLoading } = useFsListing(path, true)

  return (
    <div className="mt-2 rounded-md border border-line bg-input p-3">
      <div className="mb-2 flex items-center justify-between gap-2 font-mono text-2xs text-dim">
        <span className="truncate">{data?.path ?? path ?? '~'}</span>
        {data?.isContextStore && <span className="border border-green/40 px-1.5 py-0.5 text-green">context store</span>}
      </div>
      {isLoading && <p className="font-mono text-2xs text-faint">loading…</p>}
      <div className="flex flex-wrap gap-1.5">
        {data?.parent && (
          <button onClick={() => setPath(data.parent ?? undefined)} className="border border-line px-2 py-1 font-mono text-2xs">
            ..
          </button>
        )}
        {(data?.dirs ?? []).map((d) => (
          <button
            key={d}
            onClick={() => setPath(`${(data?.path ?? '').replace(/\/$/, '')}/${d}`)}
            className="border border-line px-2 py-1 font-mono text-2xs"
          >
            {d}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={!data}
          onClick={() => data && onSelect(data.path)}
          className="border border-foreground bg-foreground px-2.5 py-1.5 font-mono text-2xs text-page"
        >
          Use this folder
        </button>
        <button onClick={onClose} className="border border-line px-2.5 py-1.5 font-mono text-2xs">
          Cancel
        </button>
      </div>
    </div>
  )
}

function GithubFolderBrowser({
  owner,
  repo,
  branch,
  initialPath,
  onSelect,
  onClose,
}: {
  owner: string
  repo: string
  branch: string
  initialPath: string
  onSelect: (path: string) => void
  onClose: () => void
}) {
  const [path, setPath] = useState(initialPath)
  const enabled = !!owner && !!repo && !!branch
  const { data: dirs, isLoading } = useGithubTree(owner, repo, branch, path, enabled)

  return (
    <div className="mt-2 rounded-md border border-line bg-input p-3">
      <div className="mb-2 font-mono text-2xs text-dim">/{path}</div>
      {isLoading && <p className="font-mono text-2xs text-faint">loading…</p>}
      <div className="flex flex-wrap gap-1.5">
        {path && (
          <button
            onClick={() => setPath(path.split('/').slice(0, -1).join('/'))}
            className="border border-line px-2 py-1 font-mono text-2xs"
          >
            ..
          </button>
        )}
        {(dirs ?? []).map((d) => (
          <button key={d} onClick={() => setPath(path ? `${path}/${d}` : d)} className="border border-line px-2 py-1 font-mono text-2xs">
            {d}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => onSelect(path)} className="border border-foreground bg-foreground px-2.5 py-1.5 font-mono text-2xs text-page">
          Use this folder
        </button>
        <button onClick={onClose} className="border border-line px-2.5 py-1.5 font-mono text-2xs">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ProjectRow({
  draft,
  mode,
  tokenOwners,
  onChange,
  onRemove,
}: {
  draft: ProjectDraft
  mode: 'local' | 'deployed'
  tokenOwners: Set<string>
  onChange: (next: ProjectDraft) => void
  onRemove: () => void
}) {
  const [pickingDisk, setPickingDisk] = useState(false)
  const [pickingFolder, setPickingFolder] = useState(false)
  const hasToken = draft.owner ? tokenOwners.has(draft.owner) : false

  const repos = useGithubRepos(draft.owner, draft.source === 'github' && hasToken)
  const branches = useGithubBranches(draft.owner, draft.repo, draft.source === 'github' && hasToken && !!draft.repo)

  const diskDisabled = mode === 'deployed'

  return (
    <div className="rounded-md border border-border bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Project name"
          className="border border-line bg-input px-2.5 py-1.5 text-sm font-semibold text-foreground"
        />
        <div className="flex items-center gap-2">
          <span className="inline-flex border border-line">
            <button
              disabled={diskDisabled}
              title={diskDisabled ? 'Disk is only available when running the hub locally' : undefined}
              onClick={() => onChange({ ...draft, source: 'disk' })}
              className={`px-2.5 py-1 font-mono text-2xs disabled:cursor-not-allowed disabled:opacity-40 ${draft.source === 'disk' ? 'bg-foreground text-page' : ''}`}
            >
              Disk
            </button>
            <button
              onClick={() => onChange({ ...draft, source: 'github' })}
              className={`px-2.5 py-1 font-mono text-2xs ${draft.source === 'github' ? 'bg-foreground text-page' : ''}`}
            >
              GitHub
            </button>
          </span>
          <button onClick={onRemove} className="font-mono text-2xs text-faint hover:text-red">
            remove
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-y-2.5 gap-x-3 text-sm sm:grid-cols-[130px_1fr]">
        <label className="text-dim">Project id</label>
        <input
          value={draft.id}
          onChange={(e) => onChange({ ...draft, id: e.target.value })}
          className="w-full border border-line bg-input px-2.5 py-1.5 font-mono text-xs sm:w-52"
        />

        <label className="text-dim">Audience</label>
        <select
          value={draft.audience}
          onChange={(e) => onChange({ ...draft, audience: e.target.value === 'plain' ? 'plain' : 'engineering' })}
          className="w-full border border-line bg-input px-2.5 py-1.5 font-mono text-xs sm:w-52"
        >
          <option value="engineering">engineering</option>
          <option value="plain">plain: no codes</option>
        </select>

        {draft.source === 'disk' ? (
          <>
            <label className="text-dim">Folder on disk</label>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap gap-2">
                <span
                  className={`min-w-0 flex-1 truncate border border-line bg-input px-2.5 py-1.5 font-mono text-xs ${diskDisabled ? 'opacity-40' : ''}`}
                >
                  {draft.dir || '—'}
                </span>
                <button
                  disabled={diskDisabled}
                  onClick={() => setPickingDisk((v) => !v)}
                  className="shrink-0 border border-line px-2.5 py-1.5 font-mono text-2xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Browse…
                </button>
              </div>
              {pickingDisk && !diskDisabled && (
                <FsBrowser
                  initialPath={draft.dir}
                  onSelect={(path) => {
                    onChange({ ...draft, dir: path })
                    setPickingDisk(false)
                  }}
                  onClose={() => setPickingDisk(false)}
                />
              )}
            </div>
          </>
        ) : (
          <>
            <label className="text-dim">GitHub owner</label>
            <input
              value={draft.owner}
              onChange={(e) => onChange({ ...draft, owner: e.target.value, repo: '', branch: '', folder: '' })}
              placeholder="owner"
              className="w-full border border-line bg-input px-2.5 py-1.5 font-mono text-xs sm:w-52"
            />

            {!hasToken ? (
              <>
                <span />
                <p className="font-mono text-2xs text-amber">
                  {draft.owner ? `add a token for ${draft.owner} first` : 'enter an owner to continue'}
                </p>
              </>
            ) : (
              <>
                <label className="text-dim">Repository</label>
                <select
                  value={draft.repo}
                  onChange={(e) => onChange({ ...draft, repo: e.target.value, branch: '', folder: '' })}
                  className="w-full border border-line bg-input px-2.5 py-1.5 font-mono text-xs sm:w-52"
                >
                  <option value="">select…</option>
                  {(repos.data ?? []).map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <label className="text-dim">Branch</label>
                <select
                  value={draft.branch}
                  onChange={(e) => onChange({ ...draft, branch: e.target.value })}
                  disabled={!draft.repo}
                  className="w-full border border-line bg-input px-2.5 py-1.5 font-mono text-xs disabled:opacity-40 sm:w-52"
                >
                  <option value="">select…</option>
                  {(branches.data ?? []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                <label className="text-dim">Context folder</label>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <span className="min-w-0 flex-1 truncate border border-line bg-input px-2.5 py-1.5 font-mono text-xs">
                      {draft.folder || '(repo root)'}
                    </span>
                    <button
                      disabled={!draft.repo || !draft.branch}
                      onClick={() => setPickingFolder((v) => !v)}
                      className="shrink-0 border border-line px-2.5 py-1.5 font-mono text-2xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Browse…
                    </button>
                  </div>
                  {pickingFolder && draft.repo && draft.branch && (
                    <GithubFolderBrowser
                      owner={draft.owner}
                      repo={draft.repo}
                      branch={draft.branch}
                      initialPath={draft.folder}
                      onSelect={(path) => {
                        onChange({ ...draft, folder: path })
                        setPickingFolder(false)
                      }}
                      onClose={() => setPickingFolder(false)}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TokenRow({ owner, status }: { owner: string; status: 'set' | 'not set' }) {
  const [value, setValue] = useState('')
  const save = useSaveToken()
  const remove = useRemoveToken()

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-faintline py-2.5 last:border-b-0">
      <span className="w-32 font-mono text-xs text-secondary">{owner}</span>
      <span className={`border px-1.5 py-0.5 font-mono text-2xs ${status === 'set' ? 'border-green/40 text-green' : 'border-red/40 text-red'}`}>
        {status}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="paste a new token to replace"
        className="min-w-0 flex-1 border border-line bg-input px-2.5 py-1.5 font-mono text-xs"
      />
      <button
        disabled={!value || save.isPending}
        onClick={() => save.mutate({ owner, token: value }, { onSuccess: () => setValue('') })}
        className="border border-line px-2.5 py-1.5 font-mono text-2xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save
      </button>
      {status === 'set' && (
        <button disabled={remove.isPending} onClick={() => remove.mutate(owner)} className="font-mono text-2xs text-faint hover:text-red">
          Remove
        </button>
      )}
    </div>
  )
}

function NewTokenRow() {
  const [owner, setOwner] = useState('')
  const [value, setValue] = useState('')
  const save = useSaveToken()

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-2.5">
      <input
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        placeholder="new GitHub owner"
        className="w-40 border border-line bg-input px-2.5 py-1.5 font-mono text-xs"
      />
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="token"
        className="min-w-0 flex-1 border border-line bg-input px-2.5 py-1.5 font-mono text-xs"
      />
      <button
        disabled={!owner || !value || save.isPending}
        onClick={() =>
          save.mutate(
            { owner, token: value },
            {
              onSuccess: () => {
                setOwner('')
                setValue('')
              },
            },
          )
        }
        className="border border-line px-2.5 py-1.5 font-mono text-2xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add token
      </button>
    </div>
  )
}

export function SettingsPage() {
  const { data: config, isLoading, error: configError } = useConfig()
  const [drafts, setDrafts] = useState<ProjectDraft[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const saveProjects = useSaveProjects()

  useEffect(() => {
    // Seed once: a token save refetches config and must not wipe unsaved project edits.
    if (config) setDrafts((cur) => cur ?? config.projects.map(toDraft))
  }, [config])

  if (isLoading) return <div className="pad-x py-6 text-sm text-muted">Loading…</div>
  if (configError) return <div className="pad-x py-6 text-sm text-red">Error: {configError.message}</div>
  if (!drafts || !config) return <div className="pad-x py-6 text-sm text-muted">Loading…</div>

  const tokenOwners = new Set(Object.keys(config.tokens))

  function updateDraft(i: number, next: ProjectDraft) {
    setDrafts((cur) => (cur ? cur.map((d, idx) => (idx === i ? next : d)) : cur))
  }

  function removeDraft(i: number) {
    setDrafts((cur) => (cur ? cur.filter((_, idx) => idx !== i) : cur))
  }

  function addProject() {
    const id = kebab(`new-project-${(drafts?.length ?? 0) + 1}`)
    setDrafts((cur) => [
      ...(cur ?? []),
      { id, name: '', source: 'disk', audience: 'engineering', dir: '', owner: '', repo: '', branch: '', folder: '' },
    ])
  }

  async function handleSave() {
    setError(null)
    setSaved(false)
    try {
      await saveProjects.mutateAsync((drafts ?? []).map(toEntry))
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="reader animate-fade-in">
      <p className="crumb">
        <span>Context hub</span>
        <span aria-hidden="true">/</span>
        <span className="text-muted">Settings</span>
      </p>
      <h1 className="page-title">Settings</h1>
      <p className="lede">
        {config.mode === 'deployed' ? (
          <>
            This is the site <b className="font-semibold text-foreground">deployed</b> on Cloudflare: projects read from GitHub, tokens live in KV, disk is greyed out.
          </>
        ) : (
          <>
            This is the site <b className="font-semibold text-foreground">running locally</b>: disk folders work, tokens live on this machine only.
          </>
        )}
      </p>

      <h2 className="section-title">Projects</h2>
      <div className="flex flex-col gap-3">
        {drafts.map((d, i) => (
          <ProjectRow
            key={i}
            draft={d}
            mode={config.mode}
            tokenOwners={tokenOwners}
            onChange={(next) => updateDraft(i, next)}
            onRemove={() => removeDraft(i)}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={addProject} className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm hover:bg-hover">
          Add a project
        </button>
        <button
          disabled={saveProjects.isPending}
          onClick={handleSave}
          className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-page disabled:opacity-50"
        >
          Save projects
        </button>
        {saved && <span className="font-mono text-xs text-green">Saved.</span>}
        {error && <span className="font-mono text-xs text-red">{error}</span>}
      </div>

      <h2 className="section-title">GitHub tokens</h2>
      <p className="mb-3 text-sm text-muted">One fine-grained, read-only token per owner. Written here, never shown back.</p>
      <div className="rounded-md border border-border bg-panel p-4">
        {[...tokenOwners].map((owner) => (
          <TokenRow key={owner} owner={owner} status={config.tokens[owner] === 'set' ? 'set' : 'not set'} />
        ))}
        <NewTokenRow />
      </div>
    </div>
  )
}
