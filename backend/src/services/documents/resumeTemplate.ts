/**
 * ATS-safe resume HTML builder.
 *
 * Adapted from santifer/career-ops (`build-cv-html.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama): the escaping/URL-
 * sanitization helpers and the per-section builder pattern (experience,
 * projects, education, certifications, skills, contact row) are ported
 * close to 1:1. Simplified from their version in one deliberate way: instead
 * of filling a separate `{{PLACEHOLDER}}` template file (their own
 * `templates/cv-template.html`, which carries their own branding/CSS this
 * project has no reason to copy), this assembles the full HTML document
 * directly from `ExtractedEntities` — the shape `GeneratedResumeVersion.content`
 * already uses — so there's one fewer moving part and no "unresolved
 * placeholder" failure mode to guard against.
 *
 * ATS-safety principles preserved from the source: no layout tables, no
 * icon fonts, real semantic headings and text, `class="section-title"` on
 * every section heading (the same convention `generate-pdf.mjs` reads to
 * verify section order).
 */

import { ExtractedEntities, WorkExperience, Education, Skill, Certification, Project } from '../../types'

// Escape user text for HTML text/attribute context — the five characters
// that change meaning in markup, so tailored bullets containing &, <, >,
// quotes (e.g. "R&D", "scaled 10x < budget") render as literal text.
function escapeHtml(text: string | null | undefined): string {
  if (typeof text !== 'string') return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Sanitize a URL for an href attribute: only mailto:/tel:/http:/https:
// schemes are allowed; a bare email or domain is coerced to the right
// scheme; any other explicit scheme (javascript:, data:, ...) is rejected.
function sanitizeUrl(url: string | null | undefined): string {
  if (typeof url !== 'string') return ''
  let u = url.trim()
  if (!u) return ''
  const allowedSchemes = ['mailto:', 'tel:', 'http:', 'https:']
  const lower = u.toLowerCase()
  const hasScheme = allowedSchemes.some((s) => lower.startsWith(s))
  if (!hasScheme) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''
    if (u.includes('@') && !u.includes('/')) {
      u = 'mailto:' + u
    } else {
      u = 'https://' + u
    }
  }
  return escapeHtml(u)
}

function buildContactRow(contact: ExtractedEntities['contact']): string {
  const items: string[] = []
  if (contact.phone) {
    const tel = sanitizeUrl('tel:' + contact.phone.replace(/\s+/g, ''))
    items.push(`<a href="${tel}">${escapeHtml(contact.phone)}</a>`)
  }
  if (contact.email) {
    items.push(`<a href="${sanitizeUrl('mailto:' + contact.email)}">${escapeHtml(contact.email)}</a>`)
  }
  if (contact.linkedin) {
    items.push(`<a href="${sanitizeUrl(contact.linkedin)}">${escapeHtml(contact.linkedin)}</a>`)
  }
  if (contact.website) {
    items.push(`<a href="${sanitizeUrl(contact.website)}">${escapeHtml(contact.website)}</a>`)
  }
  if (contact.location) {
    items.push(`<span>${escapeHtml(contact.location)}</span>`)
  }
  return `<div class="contact-row">${items.join('\n      <span class="separator">|</span>\n      ')}</div>`
}

function buildExperience(entries: WorkExperience[]): string {
  if (!entries?.length) return ''
  return entries
    .map((e) => {
      const bullets = (e.bullets ?? []).filter(Boolean).map((b) => `        <li>${escapeHtml(b)}</li>`).join('\n')
      const location = e.location ? `\n    <div class="job-location">${escapeHtml(e.location)}</div>` : ''
      const period = `${e.startDate ?? ''} – ${e.current ? 'Present' : (e.endDate ?? '')}`
      return `<div class="job">
    <div class="job-header">
      <span class="job-company">${escapeHtml(e.company)}</span>
      <span class="job-period">${escapeHtml(period)}</span>
    </div>
    <div class="job-role">${escapeHtml(e.title)}</div>${location}
    <ul>
${bullets}
    </ul>
  </div>`
    })
    .join('\n  ')
}

function buildEducation(entries: Education[]): string {
  if (!entries?.length) return ''
  return entries
    .map((e) => {
      const degreeLine = [e.degree, e.field].filter(Boolean).join(', ')
      const year = [e.startDate, e.endDate].filter(Boolean).join(' – ')
      return `<div class="edu-item">
    <div class="edu-header">
      <div class="edu-title">${escapeHtml(e.institution)}</div>
      <div class="edu-year">${escapeHtml(year)}</div>
    </div>
    <div class="edu-desc">${escapeHtml(degreeLine)}${e.gpa ? ` &middot; GPA ${escapeHtml(e.gpa)}` : ''}</div>
  </div>`
    })
    .join('\n  ')
}

function buildCertifications(entries: Certification[]): string {
  if (!entries?.length) return ''
  return entries
    .map(
      (e) => `<div class="cert-item">
      <span class="cert-title">${escapeHtml(e.name)}</span>
      <span class="cert-org">${escapeHtml(e.issuer ?? '')}</span>
      <span class="cert-year">${escapeHtml(e.date ?? '')}</span>
    </div>`
    )
    .join('\n    ')
}

function buildSkills(entries: Skill[]): string {
  if (!entries?.length) return ''
  const byCategory = new Map<string, string[]>()
  for (const s of entries) {
    const cat = s.category?.trim() || 'Skills'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(s.name)
  }
  const items = [...byCategory.entries()]
    .map(([cat, names]) => `    <div class="skill-item"><span class="skill-category">${escapeHtml(cat)}:</span> ${escapeHtml(names.join(', '))}</div>`)
    .join('\n')
  return `<div class="skills-grid">\n${items}\n  </div>`
}

function buildProjects(entries: Project[]): string {
  if (!entries?.length) return ''
  return entries
    .map((e) => {
      const desc = e.description ? `\n    <div class="project-desc">${escapeHtml(e.description)}</div>` : ''
      const tech = e.technologies?.length
        ? `\n    <div class="project-tech">${escapeHtml(e.technologies.join(', '))}</div>`
        : ''
      return `<div class="project">
    <div class="project-title">${escapeHtml(e.name)}</div>${desc}${tech}
  </div>`
    })
    .join('\n  ')
}

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.4; color: #1a1a1a; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  .contact-row { font-size: 9.5pt; color: #333; margin-bottom: 14px; }
  .contact-row a { color: #333; text-decoration: none; }
  .separator { margin: 0 6px; color: #999; }
  .section-title { font-size: 11.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #999; margin: 16px 0 8px; padding-bottom: 2px; }
  .job, .edu-item, .project { margin-bottom: 10px; }
  .job-header, .edu-header { display: flex; justify-content: space-between; font-weight: bold; }
  .job-role { font-style: italic; margin: 1px 0 4px; }
  .job-location, .edu-desc, .project-desc { color: #333; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  .skills-grid .skill-item, .cert-item { margin-bottom: 3px; }
  .skill-category { font-weight: bold; }
`

/** Builds a complete, self-contained ATS-safe HTML resume document. */
export function buildResumeHtml(entities: ExtractedEntities): string {
  const name = escapeHtml(entities.contact?.name || 'Resume')
  const summarySection = entities.summary
    ? `<div class="section-title">Summary</div>\n  <p>${escapeHtml(entities.summary)}</p>`
    : ''
  const experienceSection = entities.experience?.length
    ? `<div class="section-title">Experience</div>\n  ${buildExperience(entities.experience)}`
    : ''
  const projectsSection = entities.projects?.length
    ? `<div class="section-title">Projects</div>\n  ${buildProjects(entities.projects)}`
    : ''
  const educationSection = entities.education?.length
    ? `<div class="section-title">Education</div>\n  ${buildEducation(entities.education)}`
    : ''
  const certificationsSection = entities.certifications?.length
    ? `<div class="section-title">Certifications</div>\n  ${buildCertifications(entities.certifications)}`
    : ''
  const skillsSection = entities.skills?.length
    ? `<div class="section-title">Skills</div>\n  ${buildSkills(entities.skills)}`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${name}</title>
<style>${BASE_STYLES}</style>
</head>
<body>
  <h1>${name}</h1>
  ${buildContactRow(entities.contact ?? {})}
  ${summarySection}
  ${experienceSection}
  ${projectsSection}
  ${educationSection}
  ${certificationsSection}
  ${skillsSection}
</body>
</html>`
}
