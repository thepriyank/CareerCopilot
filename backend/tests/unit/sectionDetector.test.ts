import { detectSections } from '../../src/services/parsing/sectionDetector'

describe('detectSections', () => {
  it('detects standard section headers', () => {
    const text = `John Doe
john@example.com

WORK EXPERIENCE
Software Engineer at Acme Corp
- Built features

EDUCATION
BSc Computer Science, MIT

SKILLS
JavaScript, TypeScript, React`

    const sections = detectSections(text)
    const types = sections.map((s) => s.type)
    expect(types).toContain('experience')
    expect(types).toContain('education')
    expect(types).toContain('skills')
  })

  it('detects mixed-case headers', () => {
    const text = `Work Experience
Engineer at Foo

Education
BSc at Bar`
    const sections = detectSections(text)
    expect(sections.find((s) => s.type === 'experience')).toBeDefined()
    expect(sections.find((s) => s.type === 'education')).toBeDefined()
  })

  it('detects Summary section', () => {
    const text = `Summary
Experienced engineer with 5 years.

Experience
Role at Company`
    const sections = detectSections(text)
    expect(sections[0].type).toBe('summary')
  })

  it('detects Professional Experience header', () => {
    const text = `Professional Experience
Senior Engineer at Corp
- Did stuff`
    const sections = detectSections(text)
    expect(sections[0].type).toBe('experience')
  })

  it('detects Skills / Technical Skills headers', () => {
    const skillHeaders = ['Skills', 'Technical Skills', 'Core Competencies', 'Technologies']
    for (const header of skillHeaders) {
      const text = `${header}\nJavaScript, Python`
      const sections = detectSections(text)
      expect(sections.find((s) => s.type === 'skills')).toBeDefined()
    }
  })

  it('detects Projects section', () => {
    const text = `Projects
My App - A cool app using React`
    const sections = detectSections(text)
    expect(sections[0].type).toBe('projects')
  })

  it('detects Certifications section', () => {
    const text = `Certifications
AWS Certified Solutions Architect`
    const sections = detectSections(text)
    expect(sections[0].type).toBe('certifications')
  })

  it('returns single other section when no headers found', () => {
    const text = 'John Doe, engineer, worked at places, knows stuff'
    const sections = detectSections(text)
    expect(sections).toHaveLength(1)
    expect(sections[0].type).toBe('other')
  })

  it('returns empty array for empty text', () => {
    const sections = detectSections('')
    expect(sections).toHaveLength(0)
  })

  it('handles headers with only whitespace around them', () => {
    const text = `  EDUCATION
BSc at MIT`
    const sections = detectSections(text)
    expect(sections.find((s) => s.type === 'education')).toBeDefined()
  })

  it('captures content under each section', () => {
    const text = `Experience
Software Engineer at Acme – 2020 to 2023
- Built API

Education
BSc CS at MIT`

    const sections = detectSections(text)
    const exp = sections.find((s) => s.type === 'experience')
    expect(exp?.content).toContain('Acme')
    const edu = sections.find((s) => s.type === 'education')
    expect(edu?.content).toContain('MIT')
  })

  it('assigns confidence based on content length', () => {
    const text = `Skills\nJavaScript, TypeScript, React, Node.js, PostgreSQL, Docker`
    const sections = detectSections(text)
    expect(sections[0].confidence).toBeGreaterThanOrEqual(0.9)
  })
})
