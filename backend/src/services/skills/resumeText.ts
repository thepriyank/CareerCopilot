import { ExtractedEntities } from '../../types'

/**
 * Flattens a parsed/master resume's structured entities into plain text
 * shaped for `classifySkillGaps` — a markdown-style "# Skills" heading
 * (so named skills are distinguished from prose) followed by summary,
 * experience bullets, and project descriptions.
 */
export function flattenResumeText(entities: ExtractedEntities): string {
  const parts: string[] = []

  if (entities.summary) {
    parts.push(entities.summary)
  }

  for (const exp of entities.experience ?? []) {
    if (exp.title || exp.company) {
      parts.push(`${exp.title ?? ''} at ${exp.company ?? ''}`.trim())
    }
    for (const bullet of exp.bullets ?? []) {
      parts.push(bullet)
    }
  }

  for (const project of entities.projects ?? []) {
    if (project.name) parts.push(project.name)
    if (project.description) parts.push(project.description)
    if (project.technologies?.length) parts.push(project.technologies.join(', '))
  }

  const skillNames = (entities.skills ?? []).map((s) => s.name).filter(Boolean)

  const sections: string[] = []
  if (parts.length) sections.push(parts.join('\n'))
  if (skillNames.length) sections.push(`# Skills\n${skillNames.join(', ')}`)

  return sections.join('\n\n')
}
