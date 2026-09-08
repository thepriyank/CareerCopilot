/**
 * Cover-letter HTML template builder — infrastructure only.
 *
 * Ported from santifer/career-ops (`generate-cover-letter.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama): the escaping helpers
 * and the block-builder + single-pass token-substitution approach are
 * translated to TypeScript close to 1:1. Two deliberate departures from the
 * source: (1) the base template is an original, minimal ATS-safe markup
 * string embedded below — visually consistent with `resumeTemplate.ts` —
 * rather than career-ops's own branded `templates/cover-letter-template.html`,
 * which this project has no reason to copy; (2) their config-driven
 * `resolveCoverTemplatePath` (template packs, profile defaults) is dropped
 * since there's exactly one template here.
 *
 * This module renders a *content payload the caller already has* to HTML —
 * it does not generate the letter's text. Wiring this to a live
 * `POST /api/jobs/:id/cover-letter` route needs an LLM content-generation
 * step first (the `openai-tailor.mjs`-style work flagged as "algorithm
 * inspiration" and deferred) — see the implementation plan's closing section.
 */

function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export interface CoverLetterCandidate {
  name: string
  location?: string
  email?: string
  phone?: string
  linkedin?: string
  github?: string
  credentials?: string[]
}

export interface CoverLetterAchievement {
  lead: string
  impact: string
}

export type CoverLetterFootnote = string | { marker?: string; text?: string; url?: string }

export interface CoverLetterLetter {
  role_title: string
  company?: string
  city?: string
  date?: string
  greeting?: string
  opening: string
  profile_intro: string
  achievements?: CoverLetterAchievement[]
  problems_section?: string
  closing?: string
  language_closing?: string
  footnotes?: CoverLetterFootnote[]
}

export interface CoverLetterPayload {
  candidate: CoverLetterCandidate
  letter: CoverLetterLetter
}

function buildContactLine(candidate: CoverLetterCandidate): string {
  const parts: string[] = []
  if (candidate.location) parts.push(escapeHtml(candidate.location))
  if (candidate.email) {
    const email = escapeHtml(candidate.email)
    parts.push(`<a href="mailto:${email}">${email}</a>`)
  }
  if (candidate.phone) parts.push(escapeHtml(candidate.phone))
  if (candidate.linkedin) {
    parts.push(`<a href="${escapeHtml(asUrl(candidate.linkedin))}">LinkedIn</a>`)
  }
  if (candidate.github) {
    const display = candidate.github.replace(/^https?:\/\//, '')
    parts.push(`<a href="${escapeHtml(asUrl(candidate.github))}">${escapeHtml(display)}</a>`)
  }
  return parts.join(' &nbsp;|&nbsp; ')
}

function buildCredentialsBlock(candidate: CoverLetterCandidate): string {
  const credentials = candidate.credentials || []
  if (!credentials.length) return ''
  return `<div class="credentials">${credentials.map((c) => escapeHtml(c)).join(' &nbsp;|&nbsp; ')}</div>`
}

function buildDateline(letter: CoverLetterLetter): string {
  return [letter.company, letter.city, letter.date].filter(Boolean).map((v) => escapeHtml(v as string)).join(' &nbsp;&nbsp; ')
}

function buildAchievementsBlock(achievements?: CoverLetterAchievement[]): string {
  if (!achievements?.length) return ''
  const items = achievements
    .map((a) => `    <li><b>${escapeHtml(a.lead)},</b> ${escapeHtml(a.impact)}</li>`)
    .join('\n')
  return `<ul class="achievements">\n${items}\n  </ul>`
}

function buildFootnotesBlock(footnotes?: CoverLetterFootnote[]): string {
  if (!footnotes?.length) return ''
  const lines = footnotes
    .map((fn) => {
      if (typeof fn === 'object' && fn !== null) {
        const marker = escapeHtml(fn.marker || '')
        const text = escapeHtml(fn.text || '')
        const url = fn.url ? ` <a href="${escapeHtml(fn.url)}">${escapeHtml(fn.url)}</a>` : ''
        return `    <p>${marker} ${text}${url}</p>`
      }
      return `    <p>${escapeHtml(fn)}</p>`
    })
    .join('\n')
  return `<div class="footnotes">\n${lines}\n  </div>`
}

const BASE_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{NAME}} — Cover Letter</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 2px; }
  .contact-line { font-size: 9.5pt; color: #333; margin-bottom: 4px; }
  .contact-line a { color: #333; text-decoration: none; }
  .credentials { font-size: 9.5pt; color: #333; margin-bottom: 14px; }
  .dateline { font-size: 9.5pt; color: #333; margin: 16px 0 18px; }
  .greeting { margin-bottom: 12px; }
  .achievements { margin: 10px 0; padding-left: 18px; }
  .footnotes { font-size: 8.5pt; color: #555; margin-top: 20px; }
  p { margin: 0 0 12px; }
</style>
</head>
<body>
  <h1>{{NAME}}</h1>
  <div class="contact-line">{{CONTACT_LINE}}</div>
  {{CREDENTIALS_BLOCK}}
  <div class="dateline">{{ROLE_TITLE}} &nbsp;&mdash;&nbsp; {{DATELINE}}</div>
  {{GREETING_BLOCK}}
  <p>{{OPENING}}</p>
  <p>{{PROFILE_INTRO}}</p>
  {{ACHIEVEMENTS_BLOCK}}
  {{PROBLEMS_BLOCK}}
  {{CLOSING_BLOCK}}
  {{LANGUAGE_CLOSING_BLOCK}}
  {{FOOTNOTES_BLOCK}}
</body>
</html>`

/**
 * Fills the base cover-letter template with an already-structured payload.
 * Single-pass substitution: each `{{TOKEN}}` is replaced exactly once
 * against the original template, so a substituted value that itself
 * contains a `{{TOKEN}}`-shaped sequence is left literal instead of being
 * re-interpreted as a placeholder.
 */
export function buildCoverLetterHtml(payload: CoverLetterPayload): string {
  const { candidate, letter } = payload
  if (!candidate?.name) throw new Error('Missing required field: candidate.name')
  if (!letter?.role_title) throw new Error('Missing required field: letter.role_title')
  if (!letter?.opening) throw new Error('Missing required field: letter.opening')
  if (!letter?.profile_intro) throw new Error('Missing required field: letter.profile_intro')

  const greetingBlock = letter.greeting ? `<p class="greeting">${escapeHtml(letter.greeting)}</p>` : ''
  const closingBlock = letter.closing ? `<p>${escapeHtml(letter.closing)}</p>` : ''
  const languageClosingBlock = letter.language_closing
    ? `<p class="language-closing">${escapeHtml(letter.language_closing)}</p>`
    : ''
  const problemsBlock = letter.problems_section ? `<p>${escapeHtml(letter.problems_section)}</p>` : ''

  const replacements: Record<string, string> = {
    '{{NAME}}': escapeHtml(candidate.name),
    '{{CONTACT_LINE}}': buildContactLine(candidate),
    '{{CREDENTIALS_BLOCK}}': buildCredentialsBlock(candidate),
    '{{ROLE_TITLE}}': escapeHtml(letter.role_title),
    '{{DATELINE}}': buildDateline(letter),
    '{{GREETING_BLOCK}}': greetingBlock,
    '{{OPENING}}': escapeHtml(letter.opening),
    '{{PROFILE_INTRO}}': escapeHtml(letter.profile_intro),
    '{{ACHIEVEMENTS_BLOCK}}': buildAchievementsBlock(letter.achievements),
    '{{PROBLEMS_BLOCK}}': problemsBlock,
    '{{CLOSING_BLOCK}}': closingBlock,
    '{{LANGUAGE_CLOSING_BLOCK}}': languageClosingBlock,
    '{{FOOTNOTES_BLOCK}}': buildFootnotesBlock(letter.footnotes),
  }

  return BASE_TEMPLATE.replace(/\{\{[A-Z_]+\}\}/g, (token) => replacements[token] ?? token)
}
