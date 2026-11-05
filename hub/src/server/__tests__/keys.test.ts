import { describe, expect, it } from 'vitest'
import { keyFromCookie, parseKeys, whoHasKey } from '../keys'

const K1 = 'k1-aaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const K2 = 'k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('key links', () => {
  it('maps each key to its name', () => {
    const keys = parseKeys(`samir:${K1}, anwar:${K2}`)
    expect(whoHasKey(K1, keys)).toBe('samir')
    expect(whoHasKey(K2, keys)).toBe('anwar')
  })
  it('refuses an unknown, empty or missing key', () => {
    const keys = parseKeys(`samir:${K1}`)
    expect(whoHasKey(K2, keys)).toBeNull()
    expect(whoHasKey('', keys)).toBeNull()
    expect(whoHasKey(null, keys)).toBeNull()
  })
  it('drops short keys and malformed pairs', () => {
    const keys = parseKeys('samir:short,nocolon,:nameless-aaaaaaaaaaaaaaaaaaaaaa')
    expect(keys.size).toBe(0)
    expect(parseKeys(undefined).size).toBe(0)
  })
  it('reads the key cookie among others', () => {
    const req = new Request('https://hub.test/', { headers: { cookie: `a=1; hub-key=${K1}; b=2` } })
    expect(keyFromCookie(req)).toBe(K1)
    expect(keyFromCookie(new Request('https://hub.test/'))).toBeNull()
  })
})
