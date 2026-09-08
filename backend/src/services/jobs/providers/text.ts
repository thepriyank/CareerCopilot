/**
 * Small text helpers shared by providers that return HTML-laden fields
 * (aggregator APIs like Adzuna and Jooble embed `<strong>`, `<br>`, and
 * HTML entities inside titles / descriptions / snippets).
 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&#39;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&hellip;': '…',
  '&ndash;': '–',
  '&mdash;': '—',
}

/** Strips HTML tags and decodes the handful of entities these feeds use. */
export function stripHtml(input: string | undefined | null): string {
  if (!input) return ''
  return input
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .replace(/(\()\s+/g, '$1')
    .trim()
}

/**
 * Like `stripHtml`, but for full job-description bodies rather than single-
 * line fields (title/company/location): it keeps paragraph and list-item
 * boundaries as real newlines and prefixes `<li>` items with "- ", instead of
 * collapsing everything to one line. `jdSkillGap.ts`'s requirements/bullet
 * extraction is line-based — a single-line blob has no lines for it to find,
 * silently degrading skill-gap and match quality to "no gaps found" on every
 * job description run through it.
 */
export function htmlToText(input: string | undefined | null): string {
  if (!input) return ''
  const rawLines = input
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())

  // A <li> wrapping a nested block element (e.g. <li><p>text</p></li>) — common
  // in copy-pasted job-posting HTML — leaves the "- " marker stranded alone on
  // its own line once block tags become newlines, with the bullet's actual text
  // starting on the next line. BULLET_LINE_RE (jdSkillGap.ts) requires marker
  // and text on the same line, so an unmerged marker silently drops that whole
  // bullet from skill extraction. Merge a bare marker line into the next one.
  const merged: string[] = []
  for (const line of rawLines) {
    const prev = merged[merged.length - 1]
    if (prev !== undefined && /^[-*•]$/.test(prev) && line !== '') {
      merged[merged.length - 1] = `${prev} ${line}`
    } else {
      merged.push(line)
    }
  }

  return merged
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim()
}
