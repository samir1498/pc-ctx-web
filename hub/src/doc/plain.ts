import type { Audience } from '../source/projects'

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
const PATH_RE_G = new RegExp(PATH_RE.source, 'g')
const TABLE_ROW_RE = /^\s*\|/
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/

// Drops any sentence that still mentions a file path, then flattens markdown
// inline formatting to plain text. Runs per line so paragraph breaks, list
// markers and headings survive for the markdown renderer downstream.
// A markdown picture or link is kept whole: its target is a path by nature,
// and the reader wants the picture, the caption and the link, not a hole.
const MD_LINK_RE = /(!?)\[([^\]]*)\]\(([^)]*)\)/g
const HOLE = '\u0000'
// A link into the code (GitHub, a repo path, a plan by slug) is flattened to
// its words; a picture, a web page or a store page stays a link.
const CODE_LINK_RE = /github\.com|^plan:|\.(ts|tsx|rs|md)#|^(?!https?:|\.\.?\/|media\/)[\w.-]+\/[\w./-]*$/i

function stripLine(line: string): string {
  const kept: string[] = []
  const shielded = line.replace(MD_LINK_RE, (m, bang: string, text: string, href: string) => {
    if (!bang && CODE_LINK_RE.test(href.trim())) return text
    kept.push(m)
    return `${HOLE}${kept.length - 1}${HOLE}`
  })
  const out = stripProse(shielded)
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)] ?? '')
}

function stripProse(line: string): string {
  // Unbold first: "done.** The" would otherwise hide the sentence boundary.
  let out = line.replace(/\*\*([^*]+)\*\*/g, '$1').replace(CODE_PAREN_RE, '').replace(BARE_REF_RE, '').replace(BARE_PR_RE, '').replace(TASK_ID_RE, '')

  // A table row is one line; dropping it would break the table. Blank the path instead.
  out = TABLE_ROW_RE.test(out)
    ? out.replace(PATH_RE_G, '')
    : out
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
const STRUCTURED_LINE_RE = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>|\|)/
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
