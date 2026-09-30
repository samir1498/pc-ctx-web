import { useMemo, useState } from 'react'
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { HOST_LABEL, TOOL_LABEL, type UsageSession } from '../lib/usage-types'
import { totalTokens } from '../lib/usage'
import { count, dayLabel, tokens, usd } from '../lib/format'

/** A session over the whole range: the day rows of one session id, summed. */
export interface SessionTotal extends Omit<UsageSession, 'date'> {
  first: string
  last: string
  total: number
}

export function sessionTotals(sessions: UsageSession[]): SessionTotal[] {
  const map = new Map<string, SessionTotal>()
  for (const s of sessions) {
    const t = map.get(s.id)
    if (!t) {
      map.set(s.id, { ...s, models: [...s.models], first: s.date, last: s.date, total: totalTokens(s) })
      continue
    }
    t.calls += s.calls
    t.input += s.input
    t.output += s.output
    t.cacheRead += s.cacheRead
    t.cacheWrite += s.cacheWrite
    t.cost += s.cost
    t.total += totalTokens(s)
    t.models = [...new Set([...t.models, ...s.models])]
    if (s.date < t.first) t.first = s.date
    if (s.date > t.last) t.last = s.date
  }
  return [...map.values()]
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})
const col = createColumnHelper<typeof features, SessionTotal>()
const PAGE_SIZES = [10, 25, 50]
const nameOf = (s: SessionTotal) => s.title ?? s.task ?? s.project ?? s.id.slice(0, 8)

const columns = col.columns([
  col.accessor(nameOf, {
    id: 'session',
    header: 'Session',
    cell: (c) => {
      const s = c.row.original
      return (
        <span className="block max-w-[26rem]">
          <span className="block truncate font-medium" title={nameOf(s)}>{nameOf(s)}</span>
          <span className="block truncate text-xs text-dim">
            {[s.task && `task ${s.task}`, s.project, s.models.join(', ')].filter(Boolean).join(' · ')}
            {s.pr && (
              <>
                {' · '}
                <a href={s.pr} className="underline hover:text-fg" target="_blank" rel="noreferrer">PR</a>
              </>
            )}
          </span>
        </span>
      )
    },
  }),
  col.accessor((s) => `${HOST_LABEL[s.host]} · ${TOOL_LABEL[s.tool]}`, { id: 'where', header: 'Where', meta: { dim: true } }),
  col.accessor('last', { header: 'Day', meta: { dim: true }, cell: (c) => { const s = c.row.original; return s.first === s.last ? dayLabel(s.last) : `${dayLabel(s.first)} – ${dayLabel(s.last)}` } }),
  col.accessor('calls', { header: 'Calls', meta: { num: true }, cell: (c) => count(c.getValue()) }),
  col.accessor('total', { header: 'Tokens', meta: { num: true }, cell: (c) => tokens(c.getValue()) }),
  col.accessor('output', { header: 'Output', meta: { num: true }, cell: (c) => tokens(c.getValue()) }),
  col.accessor('cost', { header: 'API value', meta: { num: true }, cell: (c) => usd(c.getValue()) }),
])

export default function SessionTable({ sessions }: { sessions: UsageSession[] }) {
  const [filter, setFilter] = useState('')
  const all = useMemo(() => sessionTotals(sessions), [sessions])
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return all
    return all.filter((s) => [s.title, s.task, s.project, s.id, HOST_LABEL[s.host], TOOL_LABEL[s.tool], ...s.models].some((v) => v?.toLowerCase().includes(q)))
  }, [all, filter])

  const table = useTable(
    {
      features,
      columns,
      data: rows,
      initialState: { sorting: [{ id: 'total', desc: true }], pagination: { pageIndex: 0, pageSize: 10 } },
    },
    (state) => ({ sorting: state.sorting, pagination: state.pagination }),
  )

  const { pageIndex, pageSize } = table.state.pagination
  const shown = rows.length
  const btn = 'rounded-md border border-border px-2.5 py-1 hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="font-display text-lg font-semibold">By session</h2>
          <p className="text-xs text-dim">Claude Code, desktop and Cowork sessions. Titles come from the desktop app; terminal sessions show their folder.</p>
        </div>
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            table.setPageIndex(0)
          }}
          placeholder="Filter title, task, folder, model"
          aria-label="Filter sessions"
          className="w-64 max-w-full rounded-lg border border-border bg-panel px-2.5 py-1.5 text-sm"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="mt-3 w-full min-w-[52rem] text-sm">
          <thead className="text-left text-xs text-dim">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((h) => {
                  const num = (h.column.columnDef.meta as { num?: boolean } | undefined)?.num
                  const dir = h.column.getIsSorted()
                  return (
                    <th key={h.id} className={`py-2 pr-3 font-medium first:pl-5 last:pr-5 ${num ? 'text-right' : ''}`} aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-fg">
                        <table.FlexRender header={h} />
                        <span className="w-2">{dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : ''}</span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.original.id} className="border-b border-border last:border-0 hover:bg-hover">
                {row.getAllCells().map((c) => {
                  const meta = c.column.columnDef.meta as { num?: boolean; dim?: boolean } | undefined
                  return (
                    <td key={c.id} className={`py-2.5 pr-3 align-top first:pl-5 last:pr-5 ${meta?.num ? 'num text-right' : ''} ${meta?.dim ? 'whitespace-nowrap text-muted' : ''}`}>
                      <table.FlexRender cell={c} />
                    </td>
                  )
                })}
              </tr>
            ))}
            {shown === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-6 text-center text-dim">{all.length ? `No session matches “${filter}”.` : 'No session data in this range yet.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-dim">
        <span>
          {shown === 0 ? 0 : pageIndex * pageSize + 1}–{Math.min(shown, (pageIndex + 1) * pageSize)} of {shown} sessions
        </span>
        <div className="flex items-center gap-2">
          <select value={pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))} aria-label="Rows per page" className="rounded-md border border-border bg-panel px-1.5 py-1">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <button className={btn} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</button>
          <span className="num">{pageIndex + 1} / {Math.max(1, table.getPageCount())}</span>
          <button className={btn} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</button>
        </div>
      </div>
    </section>
  )
}
