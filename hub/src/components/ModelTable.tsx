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
import { TOOL_LABEL } from '../lib/usage-types'
import { priceLabel, slotOf, totalTokens, type ModelTotals } from '../lib/usage'
import { count, tokens, usd } from '../lib/format'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})
const col = createColumnHelper<typeof features, ModelTotals>()
const NUM = 'num text-right'
const PAGE_SIZES = [10, 25, 50]

export default function ModelTable({ models, colourKeys }: { models: ModelTotals[]; colourKeys: string[] }) {
  const [filter, setFilter] = useState('')
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? models.filter((m) => `${m.model} ${m.provider} ${TOOL_LABEL[m.tool]}`.toLowerCase().includes(q)) : models
  }, [models, filter])

  // A model where every call failed has no token counts; a dash says so without a wide note.
  const tok = (pick: (m: ModelTotals) => number) => (m: ModelTotals) => (m.calls === 0 ? null : pick(m))
  const cell = (v: number | null) => (v === null ? <span className="text-dim">–</span> : tokens(v))

  // Stable across renders, so the table keeps its page and sort; only the colours depend on props.
  const columns = useMemo(() => col.columns([
    col.accessor('model', {
      header: 'Model',
      cell: (c) => (
        <span className="flex items-center gap-2 font-medium">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: `var(${slotOf(colourKeys, c.getValue())})` }} />
          {c.getValue()}
        </span>
      ),
    }),
    col.accessor((m) => TOOL_LABEL[m.tool], { id: 'tool', header: 'Tool', meta: { dim: true } }),
    col.accessor('provider', { header: 'Provider', meta: { dim: true } }),
    col.accessor('calls', {
      header: 'Calls',
      meta: { num: true },
      cell: (c) => (
        <>
          {count(c.getValue())}
          {c.row.original.errors > 0 && <span className="block text-xs text-dim">{count(c.row.original.errors)} failed</span>}
        </>
      ),
    }),
    col.accessor(tok(totalTokens), { id: 'total', header: 'Tokens', meta: { num: true }, cell: (c) => cell(c.getValue()), sortUndefined: 'last' }),
    col.accessor(tok((m) => m.input), { id: 'input', header: 'Input', meta: { num: true }, cell: (c) => cell(c.getValue()) }),
    col.accessor(tok((m) => m.output), { id: 'output', header: 'Output', meta: { num: true }, cell: (c) => cell(c.getValue()) }),
    col.accessor(tok((m) => m.cacheRead), { id: 'cacheRead', header: 'Cache read', meta: { num: true }, cell: (c) => cell(c.getValue()) }),
    col.accessor(tok((m) => m.cacheWrite), { id: 'cacheWrite', header: 'Cache write', meta: { num: true }, cell: (c) => cell(c.getValue()) }),
    col.accessor('cost', {
      header: 'API value',
      meta: { num: true },
      cell: (c) => {
        const m = c.row.original
        const label = priceLabel(m)
        return label ? <span className="text-dim">{label}</span> : <span title={m.pricing === 'reported' ? 'As the tool reports it' : 'At list price'}>{usd(m.cost)}</span>
      },
    }),
  ]), [colourKeys])

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
        <h2 className="font-display text-lg font-semibold">By model</h2>
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            table.setPageIndex(0)
          }}
          placeholder="Filter model, tool or provider"
          aria-label="Filter models"
          className="w-64 max-w-full rounded-lg border border-border bg-panel px-2.5 py-1.5 text-sm"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="mt-3 w-full min-w-[48rem] text-sm">
          <thead className="text-left text-xs text-dim">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((h) => {
                  const num = (h.column.columnDef.meta as { num?: boolean } | undefined)?.num
                  const dir = h.column.getIsSorted()
                  return (
                    <th key={h.id} className={`py-2 font-medium first:pl-5 last:pr-5 ${num ? 'text-right' : ''}`} aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
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
              <tr key={row.original.key} className="border-b border-border last:border-0 hover:bg-hover">
                {row.getAllCells().map((c) => {
                  const meta = c.column.columnDef.meta as { num?: boolean; dim?: boolean } | undefined
                  return (
                    <td key={c.id} className={`py-2.5 first:pl-5 last:pr-5 ${meta?.num ? NUM : ''} ${meta?.dim ? 'text-muted' : ''}`}>
                      <table.FlexRender cell={c} />
                    </td>
                  )
                })}
              </tr>
            ))}
            {shown === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-6 text-center text-dim">No model matches “{filter}”.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-dim">
        <span>
          {shown === 0 ? 0 : pageIndex * pageSize + 1}–{Math.min(shown, (pageIndex + 1) * pageSize)} of {shown} models
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
