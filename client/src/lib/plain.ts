import type { Audience } from '../types'

export function isPlainAudience(audience: Audience | undefined): boolean {
  return audience === 'plain'
}

// Parenthetical asides that carry a code marker: a PR number, a 7-40 char
// commit hash, or a T/D-prefixed task id — e.g. "(see PR #42, T4 done)".
const CODE_PAREN_RE = /\s*\((?:[^()]*?(?:#\d+|\b[0-9a-f]{7,40}\b|\b[TD]-?\d+\b)[^()]*)\)/gi
// Bare "(#123)" or "(#12 to #34)" reference lists.
const BARE_REF_RE = /\s*\(#\d+(?:\s*(?:to|,|-)\s*#?\d+)*\)/g
// Standalone PR/issue numbers and task ids outside parentheses.
const BARE_PR_RE = /#\d+\b/g
const TASK_ID_RE = /\b[TD]-?\d+\b/g
// A path-shaped token: word/word(/word)*, at least one slash.
const PATH_RE = /[\w.-]+\/[\w./-]*/
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/

// Drops any sentence that still mentions a file path, then flattens markdown
// inline formatting to plain text. Runs per line so paragraph breaks, list
// markers and headings survive for the markdown renderer downstream.
function stripLine(line: string): string {
  let out = line.replace(CODE_PAREN_RE, '').replace(BARE_REF_RE, '').replace(BARE_PR_RE, '').replace(TASK_ID_RE, '')

  out = out
    .split(SENTENCE_SPLIT_RE)
    .filter((sentence) => !PATH_RE.test(sentence))
    .join(' ')

  return out
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// Stores hard-wrap prose at ~80 columns, so a sentence (and its path) spans lines;
// rejoin plain paragraphs before the per-line pass. Lists and headings keep their breaks.
const STRUCTURED_LINE_RE = /^\s*(?:[-*+]\s|\d+[.)]\s|#|>|\|)/
function unwrapParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n')
      return lines.some((l) => STRUCTURED_LINE_RE.test(l)) ? block : lines.map((l) => l.trim()).join(' ')
    })
    .join('\n\n')
}

/** Strip slugs, task ids, file paths, PR numbers and commit hashes from prose meant for a non-engineer. */
export function stripCodes(text: string): string {
  return unwrapParagraphs(text)
    .split('\n')
    .map((line) => (line.trim() ? stripLine(line) : line))
    .join('\n')
}
