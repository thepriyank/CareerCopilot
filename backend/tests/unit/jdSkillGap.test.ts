import { extractJdSkills, classifySkillGaps } from '../../src/services/skills/jdSkillGap'

describe('extractJdSkills', () => {
  it('extracts skills listed under a Requirements heading', () => {
    const jd = `
# Senior Engineer — Fabrikam Inc.

## Requirements
- Python, FastAPI, PostgreSQL
- Experience with Kubernetes
- Strong communication skills
`
    const skills = extractJdSkills(jd)
    expect(skills).toContain('Python')
    expect(skills).toContain('Kubernetes')
    expect(skills).not.toContain('Strong')
  })

  it('does not misreport generic JD boilerplate as a skill', () => {
    const jd = `
# Role

## Requirements
- Bachelor's degree required
- Experience with cross-functional teams (5+ years)
- Communication skills and Ability to self-organize
`
    const skills = extractJdSkills(jd)
    expect(skills).not.toContain('Bachelor')
    expect(skills).not.toContain('Experience')
    expect(skills).not.toContain('Communication')
    expect(skills).not.toContain('Ability')
  })

  it('stops scanning once the requirements list ends in a plain-text (non-markdown) JD', () => {
    // Real descriptions (post HTML-stripping) have no "#" headings — a naive
    // "only a markdown heading ends the block" rule would keep matching
    // bullets from every later section too, e.g. a per-city compensation
    // table, forever after the first "Requirements" line.
    const jd = `Requirements

- Python and FastAPI experience
- Comfortable with Kubernetes

Compensation by Zone

- Zone 1: San Francisco Bay Area or NYC Metropolitan Area
- Zone 2: Irvine, LA, Monterey, Santa Barbara`
    const skills = extractJdSkills(jd)
    expect(skills).toContain('Python')
    expect(skills).toContain('Kubernetes')
    expect(skills).not.toContain('Zone')
    expect(skills).not.toContain('San')
    expect(skills).not.toContain('Francisco')
  })

  it('recovers a heading glued to the end of the previous sentence with no line break (JSearch/Google-for-Jobs shape)', () => {
    // Real shape seen from a JSearch pull: no HTML, so no <li> to reconstruct
    // from — the API's own plain-text extraction just drops the line break
    // before a new section heading (and often before that section's own
    // first bullet too), while every later bullet stays on its own real line.
    const jd = `We are a great place to work with strong communication skills valued.

Key Responsibilities - Design and govern RESTful APIs, GraphQL services, and microservices architecture
- Drive performance optimization using Kubernetes and Docker
- Lead technical discovery for new AWS integrations Technical Skills - Strong back-end expertise in Node.js
- Experience with PostgreSQL and MongoDB`
    const skills = extractJdSkills(jd)
    expect(skills).toContain('RESTful')
    expect(skills).toContain('Kubernetes')
    expect(skills).toContain('Docker')
    expect(skills).toContain('AWS')
    expect(skills).toContain('Node.js')
    expect(skills).toContain('PostgreSQL')
    expect(skills).toContain('MongoDB')
  })

  it('still captures bullets preceded by an intro sentence under the same heading', () => {
    const jd = `Requirements

We're looking for someone with:
- Experience with Rust
- Experience with Kubernetes`
    const skills = extractJdSkills(jd)
    expect(skills).toContain('Rust')
    expect(skills).toContain('Kubernetes')
  })

  it('extracts symbol-edge tokens (C#, C++, F#) without swallowing sentence punctuation', () => {
    const jd = `
# Role

## Requirements
- C#, C++ or F# for backend services
- Familiarity with Docker.
`
    const skills = extractJdSkills(jd)
    expect(skills).toContain('C#')
    expect(skills).toContain('C++')
    expect(skills).toContain('F#')
    expect(skills).toContain('Docker')
    expect(skills).not.toContain('Docker.')
  })
})

describe('classifySkillGaps', () => {
  const fakeResume = `
# Skills
Python, PostgreSQL, Docker

# Experience
Deployed services onto Kubernetes clusters and wrote FastAPI endpoints for internal tools.
`

  it('classifies a named skill as existing', () => {
    const result = classifySkillGaps(['Python', 'PostgreSQL', 'Kubernetes', 'FastAPI', 'Rust'], fakeResume)
    expect(result.existing).toContain('Python')
  })

  it('classifies a prose-only mention as supportedByResume', () => {
    const result = classifySkillGaps(['Kubernetes', 'FastAPI'], fakeResume)
    expect(result.supportedByResume).toContain('Kubernetes')
    expect(result.supportedByResume).toContain('FastAPI')
  })

  it('classifies an unmentioned skill as a real gap', () => {
    const result = classifySkillGaps(['Rust'], fakeResume)
    expect(result.gap).toContain('Rust')
  })

  it('captures a Skills section that is the last section in the resume (no trailing heading)', () => {
    // Regression: a naive end-of-string regex anchor either fails to match this
    // case at all, or matches a literal "Z" character later in the text — this
    // fixture's shape (Skills last, contains a "Z"-adjacent word) catches both.
    const trailingSkillsResume = `
# Experience
Worked with Rust in a prior role.

# Skills
Python, Docker, Zookeeper
`
    const result = classifySkillGaps(['Python', 'Zookeeper'], trailingSkillsResume)
    expect(result.existing).toContain('Zookeeper')
  })

  it('treats every mention as prose support when there is no Skills heading at all', () => {
    const result = classifySkillGaps(['Kubernetes'], 'I have shipped services on Kubernetes for three years.')
    expect(result.supportedByResume).toContain('Kubernetes')
    expect(result.existing).not.toContain('Kubernetes')
  })
})
