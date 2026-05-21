import { ResumeSection, SectionType } from '../../types'

// Regex patterns for each known section type
const SECTION_PATTERNS: Record<SectionType, RegExp[]> = {
  summary: [
    /^(professional\s+)?summary$/i,
    /^profile$/i,
    /^objective(s)?$/i,
    /^(career\s+)?overview$/i,
    /^about(\s+(me|myself))?$/i,
    /^executive\s+summary$/i,
    /^professional\s+profile$/i,
  ],
  experience: [
    /^(work\s+)?experience$/i,
    /^professional\s+experience$/i,
    /^employment(\s+(history|background))?$/i,
    /^career(\s+(history|background))?$/i,
    /^work\s+history$/i,
    /^positions?(\s+held)?$/i,
    /^job\s+history$/i,
    /^relevant\s+experience$/i,
  ],
  education: [
    /^education(al(\s+background)?)?$/i,
    /^academic(\s+background)?$/i,
    /^degrees?$/i,
    /^qualifications?$/i,
    /^academic\s+qualifications?$/i,
  ],
  skills: [
    /^(technical\s+)?skills?$/i,
    /^core\s+competenc(ies|y)$/i,
    /^key\s+skills?$/i,
    /^expertise$/i,
    /^technologies?$/i,
    /^areas?\s+of\s+expertise$/i,
    /^competenc(ies|y)$/i,
    /^proficienc(ies|y)$/i,
    /^tools?\s+(&|and)\s+technologies?$/i,
    /^technical\s+proficienc(ies|y)$/i,
  ],
  projects: [
    /^(personal\s+|side\s+|key\s+)?projects?$/i,
    /^portfolio$/i,
    /^notable\s+projects?$/i,
  ],
  certifications: [
    /^certifications?$/i,
    /^licenses?\s+(&|and)\s+certifications?$/i,
    /^awards?\s+(&|and)\s+certifications?$/i,
    /^credentials?$/i,
    /^accreditations?$/i,
    /^licenses?$/i,
  ],
  publications: [
    /^publications?$/i,
    /^research(\s+papers?)?$/i,
    /^papers?$/i,
    /^articles?$/i,
  ],
  volunteering: [
    /^volunteer(ing)?(\s+(work|experience|activities))?$/i,
    /^community(\s+(service|involvement|engagement))?$/i,
  ],
  languages: [
    /^languages?(\s+spoken)?$/i,
    /^linguistic\s+skills?$/i,
  ],
  other: [],
}

function detectSectionType(line: string): SectionType | null {
  const trimmed = line.trim()
  for (const [type, patterns] of Object.entries(SECTION_PATTERNS) as [SectionType, RegExp[]][]) {
    if (type === 'other') continue
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return type
    }
  }
  return null
}

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 60) return false

  // ALL CAPS line (common in resumes)
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
    const type = detectSectionType(trimmed)
    if (type) return true
  }

  return detectSectionType(trimmed) !== null
}

export function detectSections(rawText: string): ResumeSection[] {
  const lines = rawText.split('\n')
  const sections: ResumeSection[] = []
  let currentType: SectionType | null = null
  let currentTitle = ''
  let currentLines: string[] = []

  const flushSection = (): void => {
    if (!currentType) return
    const content = currentLines.join('\n').trim()
    if (content || currentType !== 'other') {
      sections.push({
        type: currentType,
        title: currentTitle,
        content,
        confidence: content.length > 20 ? 0.9 : 0.5,
      })
    }
    currentLines = []
  }

  for (const line of lines) {
    if (isSectionHeader(line)) {
      flushSection()
      currentType = detectSectionType(line.trim()) ?? 'other'
      currentTitle = line.trim()
    } else {
      if (currentType) {
        currentLines.push(line)
      }
    }
  }
  flushSection()

  // If nothing detected, treat the whole text as a single unknown block
  if (sections.length === 0 && rawText.trim()) {
    sections.push({
      type: 'other',
      title: 'Resume Content',
      content: rawText.trim(),
      confidence: 0.3,
    })
  }

  return sections
}
