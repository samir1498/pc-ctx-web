import { describe, expect, it } from 'vitest'
import { checkPassword, keyFromCookie, parseKeys, parsePasswords, safeNext, whoHasKey } from '../keys'

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

describe('passwords', () => {
  it('refuses a wrong password, another name\'s password, a short password and an off-site next', () => {
    const pw = parsePasswords('anwar:chrome-saves-it-1, samir:other-pass-22, x:short')
    expect(checkPassword('Anwar', 'chrome-saves-it-1', pw)).toBe('anwar')
    expect(checkPassword('anwar', 'chrome-saves-it-2', pw)).toBeNull()
    expect(checkPassword('anwar', 'other-pass-22', pw)).toBeNull()
    expect(checkPassword('x', 'short', pw)).toBeNull()
    expect(checkPassword(null, null, pw)).toBeNull()
    expect(safeNext('//evil.example/p')).toBe('/')
    expect(safeNext('https://evil.example')).toBe('/')
    expect(safeNext('/p/dinar/docs')).toBe('/p/dinar/docs')
  })
})
