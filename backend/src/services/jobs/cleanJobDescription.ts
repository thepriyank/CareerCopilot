/**
 * JobSpy's Indeed scraper converts each posting's HTML description to
 * Markdown internally (Python's `markdownify`), which backslash-escapes
 * markdown-special characters found in the original text (`AI\-native`,
 * `Full\-time`, `18,000\+`) and emits real markdown syntax (`### headers`,
 * `**bold**`, `* bullets`) that this app has never rendered — the job
 * detail page prints `description` as plain text (`white-space: pre-wrap`
 * — see frontend/src/app/(dashboard)/jobs/[id]/page.tsx), so every one of
 * those markers showed up literally to the candidate.
 *
 * This converts that Markdown into clean plain text that reads correctly
 * under that same plain-text renderer, rather than teaching the frontend
 * to render Markdown — every other source's description is already plain
 * text, and this same field is also the input to skill extraction
 * (extractJobSkills), so cleaner text helps there too. Applied once, in
 * upsertJobListing, scoped to `source` starting with "jobspy:" — see that
 * function.
 */
export function cleanMarkdownArtifacts(text: string): string {
  let out = text

  // Un-escape markdownify's backslash-escaped punctuation first — by far
  // the biggest source of visible clutter ("AI\-native", "18,000\+",
  // "SecOps \& Pipeline Engineering"). The full CommonMark ASCII-punctuation
  // escape set, not a hand-picked subset — an earlier, narrower version of
  // this list missed "&" and left it in the live description (caught during
  // the 2026-09-14 staging backfill).
  out = out.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~\\])/g, '$1')

  // Heading markers ("### **Role at a Glance**" -> "**Role at a Glance**",
  // stripped further below).
  out = out.replace(/^#{1,6}[ \t]+/gm, '')

  // Setext-style headings — a line of only "=" or "-" directly underlining
  // the heading text above it ("Software Engineer\n=======") is a second,
  // distinct Markdown heading syntax from the "#"-style one above (caught
  // during the 2026-09-14 staging backfill). Just remove the underline
  // line; the heading text above is left as its own paragraph line, same
  // as the ATX case.
  out = out.replace(/^[ \t]*={3,}[ \t]*$/gm, '')
  out = out.replace(/^[ \t]*-{3,}[ \t]*$/gm, '')

  // Bullet markers ("* item" / "+ item") -> a consistent "- item", done
  // before emphasis-stripping so a leading "*" can never be misread as the
  // start of an italic span by the rule below.
  out = out.replace(/^[ \t]*[*+][ \t]+/gm, '- ')

  // Emphasis markers — inner-line only (never crosses a newline, so a
  // stray unmatched marker in body text can't accidentally eat a whole
  // section). Bold (**/__) before italic (*/_): once bold markers are
  // gone, any remaining single marker is unambiguously italic.
  out = out.replace(/\*\*([^\n*]+?)\*\*/g, '$1')
  out = out.replace(/__([^\n_]+?)__/g, '$1')
  out = out.replace(/(?<!\*)\*([^\n*]+?)\*(?!\*)/g, '$1')
  out = out.replace(/(?<!_)_([^\n_]+?)_(?!_)/g, '$1')

  // Inline code spans.
  out = out.replace(/`([^`\n]+?)`/g, '$1')

  // Markdown links -> "text (url)", so the URL isn't silently dropped.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')

  // Markdown's "two-trailing-spaces = hard line break" -> a plain newline.
  out = out.replace(/[ \t]{2,}\n/g, '\n')

  // Trailing whitespace per line, then collapse 3+ blank lines to exactly one.
  out = out.replace(/[ \t]+$/gm, '')
  out = out.replace(/\n{3,}/g, '\n\n')

  return out.trim()
}
