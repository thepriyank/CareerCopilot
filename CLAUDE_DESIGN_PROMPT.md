# Claude Design Prompt – Jobmagnate

You are Claude Design. Your task is to design a web + mobile product called **Jobmagnate**, using `DESIGN_DOC.md` as the primary reference for UX and visuals.

## Context

Jobmagnate is a candidate-first AI platform that:
- Ingests resumes.
- Interviews users about their career goals.
- Enhances a master resume.
- Matches jobs and explains the matches.
- Generates job-specific resumes and cover letters.
- Guides users through review and approval.
- Surfaces skill gaps and course recommendations.
- Reviews LinkedIn profiles (feedback only in MVP).

The core values are trust, transparency, and user control over AI outputs.

## Your objectives

1. Create a **design system**:
   - Color palette aligned with trustful, calm, professional brand.
   - Typography stack for headings, body, and document content.
   - Base components (buttons, inputs, cards, chips, tags, tables, navigation, modals).
   - Variants for states (default, hover, active, disabled, success, error, info).
   - Diff viewer component to compare original vs AI-enhanced content.

2. Design **core flows and screens**:
   - Landing page (with CTA to upload resume).
   - Resume upload + parsing review.
   - Onboarding chat for goals and preferences.
   - Master resume workspace.
   - Job match board (cards, filters).
   - Job detail & tailoring workspace (job on one side, tailored resume + cover letter on the other).
   - Review & approval center.
   - Skill roadmap page (skill gaps and course recommendations).
   - LinkedIn review page.

3. Provide **responsive layouts** for:
   - Desktop (primary).
   - Mobile (prioritize clarity and key actions).

4. For each primary screen:
   - Show layout with component placement.
   - Show example content (e.g., job card, skill gap).
   - Indicate key interactions (buttons, clickable areas).
   - Highlight where AI-generated content appears and how it is labeled.

## Constraints and principles

- Follow the UX principles and layout structures from `DESIGN_DOC.md`.
- Prioritize readability and document-centric layouts for resumes and cover letters.
- Always make AI changes visible (e.g., highlighted text, diff view).
- Always show why a job is a good match (skills matched, skills missing, preference alignment).
- Provide clear states for:
  - Draft vs Approved.
  - AI-generated vs user-edited content.

## Output format

1. Start by summarizing the design system:
   - Colors (with names and hex codes).
   - Typography (font choices, sizes, scale).
   - Spacing and radius tokens (e.g., small, medium, large).
   - Component list with brief descriptions.

2. Then, for each screen:
   - Name the screen.
   - Describe the layout (sections, panels).
   - List key components used.
   - Explain interaction patterns and states.

3. Finally, describe:
   - How the design adapts to mobile.
   - How users understand when AI is acting and what it changed.
   - How the visual language supports trust and control.

Aim for output that a designer or engineer can directly translate into Figma components and implementation.