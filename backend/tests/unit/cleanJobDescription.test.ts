import { cleanMarkdownArtifacts } from '../../src/services/jobs/cleanJobDescription'

describe('cleanMarkdownArtifacts', () => {
  it('unescapes markdownify-style backslash-escaped punctuation', () => {
    expect(cleanMarkdownArtifacts('AI\\-native start\\-up (18,000\\+ experts)')).toBe('AI-native start-up (18,000+ experts)')
  })

  it('strips bold markers', () => {
    expect(cleanMarkdownArtifacts('**Company Description**')).toBe('Company Description')
  })

  it('strips heading markers, including a heading that wraps bold text', () => {
    expect(cleanMarkdownArtifacts('### **About Hupo**')).toBe('About Hupo')
  })

  it('strips italic markers without eating unrelated single asterisks', () => {
    expect(cleanMarkdownArtifacts('*remote-first*')).toBe('remote-first')
  })

  it('converts asterisk/plus bullets to a consistent dash, and leaves existing dash bullets alone', () => {
    const input = '* First point\n+ Second point\n- Third point'
    expect(cleanMarkdownArtifacts(input)).toBe('- First point\n- Second point\n- Third point')
  })

  it('does not misread a bullet-list asterisk as an italic marker', () => {
    // A realistic multi-item list — the old naive "strip *...*" approach
    // would treat "* Build things" through "* Ship things*" as one giant
    // italic span and eat the bullets in between.
    const input = '* Build things\n* Ship things\n* Review things'
    expect(cleanMarkdownArtifacts(input)).toBe('- Build things\n- Ship things\n- Review things')
  })

  it('converts a markdown link to "text (url)"', () => {
    expect(cleanMarkdownArtifacts('[Apply here](https://example.com/apply)')).toBe('Apply here (https://example.com/apply)')
  })

  it('strips inline code spans', () => {
    expect(cleanMarkdownArtifacts('Experience with `kubectl` required')).toBe('Experience with kubectl required')
  })

  it('collapses a markdown hard line break (trailing double-space) to a plain newline', () => {
    expect(cleanMarkdownArtifacts('Title: Staff Engineer  \n\nTeam: Platform')).toBe('Title: Staff Engineer\n\nTeam: Platform')
  })

  it('collapses 3+ consecutive blank lines to exactly one', () => {
    expect(cleanMarkdownArtifacts('First\n\n\n\n\nSecond')).toBe('First\n\nSecond')
  })

  it('trims leading and trailing whitespace overall', () => {
    expect(cleanMarkdownArtifacts('  \nHello\n  ')).toBe('Hello')
  })

  it('leaves already-clean plain text completely unchanged', () => {
    const clean = 'We are hiring a Software Engineer.\n\nRequirements:\n- 3+ years of experience\n- Strong communication skills'
    expect(cleanMarkdownArtifacts(clean)).toBe(clean)
  })

  it('cleans a real JobSpy/Indeed sample end to end (pulled from the live staging pool)', () => {
    const raw = [
      '**Company Description**  ',
      '',
      '  ',
      '',
      "We're Nagarro. We are a digital product engineering company that is scaling in a big way! ",
      '(18,000\\+ experts across 33 countries, to be exact). Our work culture is dynamic and non\\-hierarchical.',
      '',
      '**Job Description**  ',
      '',
      '  ',
      '',
      'By this point in your career, it is not just about the tech you know.',
    ].join('\n')

    const cleaned = cleanMarkdownArtifacts(raw)

    expect(cleaned).not.toMatch(/[*#\\]/)
    expect(cleaned).toContain('Company Description')
    expect(cleaned).toContain('18,000+ experts across 33 countries')
    expect(cleaned).toContain('non-hierarchical')
    expect(cleaned).toContain('Job Description')
    expect(cleaned).toContain('By this point in your career')
    // No run of 3+ blank lines survives.
    expect(cleaned).not.toMatch(/\n{3,}/)
  })

  it('preserves paragraph structure from a real multi-section JobSpy sample (headers + bold labels + bullets)', () => {
    const raw = [
      '### **Role at a Glance**',
      '',
      '**Title:** Staff Platform Engineer  ',
      '',
      '**Employment Type:** Full\\-time  ',
      '',
      '### **What you would actually do**',
      '',
      '* Build the shared pieces our products use \\- configuration, identity.',
      '* Extract them from the existing products without stopping delivery.',
    ].join('\n')

    const cleaned = cleanMarkdownArtifacts(raw)

    expect(cleaned).toBe(
      [
        'Role at a Glance',
        '',
        'Title: Staff Platform Engineer',
        '',
        'Employment Type: Full-time',
        '',
        'What you would actually do',
        '',
        '- Build the shared pieces our products use - configuration, identity.',
        '- Extract them from the existing products without stopping delivery.',
      ].join('\n')
    )
  })
})
