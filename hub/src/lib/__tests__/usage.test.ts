import { describe, expect, it } from 'vitest'
import { parseUsageDay } from '../usage-types'
import { byModel, keysOf, priceLabel, sum } from '../usage'

const day = (rows: unknown[]) => JSON.stringify({ date: '2026-09-29', tz: 'Europe/Berlin', rows })
const row = (over: Record<string, unknown> = {}) => ({
  tool: 'opencode', provider: 'opencode-go', model: 'm', calls: 2, errors: 1,
  input: 10, output: 5, cacheRead: 100, cacheWrite: 0, cost: 0.5, pricing: 'reported', ...over,
})

describe('parseUsageDay', () => {
  it('reads the collector format, errors and reported pricing included', () => {
    const d = parseUsageDay(day([row(), row({ tool: 'router', pricing: 'free', cost: 0 })]))!
    expect(d.rows.map((r) => [r.tool, r.errors, r.pricing])).toEqual([
      ['opencode', 1, 'reported'],
      ['router', 1, 'free'],
    ])
  })

  it('drops unknown tools and malformed files instead of drawing them', () => {
    expect(parseUsageDay(day([row({ tool: 'mystery' })]))!.rows).toEqual([])
    expect(parseUsageDay('{"date":"yesterday","rows":[]}')).toBeNull()
    expect(parseUsageDay('not json')).toBeNull()
  })

  it('treats an unknown pricing label as list', () => {
    expect(parseUsageDay(day([row({ pricing: 'guess' })]))!.rows[0]!.pricing).toBe('list')
  })
})

describe('byModel', () => {
  it('keeps one model apart per tool, since free models run under several', () => {
    const rows = parseUsageDay(day([row({ tool: 'opencode' }), row({ tool: 'hermes' }), row({ tool: 'hermes' })]))!.rows
    const models = byModel(rows)
    expect(models.map((m) => [m.tool, m.calls, m.errors])).toEqual([
      ['hermes', 4, 2],
      ['opencode', 2, 1],
    ])
    expect(new Set(models.map((m) => m.key)).size).toBe(2)
  })
})

describe('priceLabel and sum', () => {
  it('labels free and unpriced rows and leaves dollars to the caller', () => {
    expect(priceLabel({ cost: 0, pricing: 'free' })).toBe('free')
    expect(priceLabel({ cost: 0, pricing: 'unpriced' })).toBe('no price')
    expect(priceLabel({ cost: 1.2, pricing: 'reported' })).toBeNull()
  })

  it('sums errors with the rest', () => {
    const rows = parseUsageDay(day([row(), row()]))!.rows
    expect(sum(rows)).toMatchObject({ calls: 4, errors: 2, cost: 1 })
  })

  it('gives the router tool a fixed colour slot after the three named tools', () => {
    const rows = parseUsageDay(day([row({ tool: 'router' }), row({ tool: 'claude-code' })]))!.rows
    expect(keysOf('tool', rows)).toEqual(['claude-code', 'router'])
  })
})
