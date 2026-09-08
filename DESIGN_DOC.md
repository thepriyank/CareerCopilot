# Jobmagnate – Design Document

This document guides UX/UI design, especially when using Claude Design.

## 1. Design goals

- Communicate trust, clarity, and control in a space where users share personal career data.
- Make complex information (resumes, job matches, skill gaps) easy to scan and act on.
- Support deep reading (resume diffs, cover letters) without overwhelming users.
- Scale across responsive web and mobile, with shared components.

## 2. Brand attributes

- Trustworthy
- Intelligent
- Career-focused
- Calm
- Modern and precise (editorial, not flashy)

## 3. Visual direction

- Clean, document-centric interface.
- Generous whitespace with clear typographic hierarchy.
- Minimal but meaningful use of color for emphasis and status.
- Support split views (e.g., original vs AI-enhanced resume).
- UI feels like a professional workspace rather than a marketing site.

## 4. Design system foundations

### 4.1 Color

- Primary: deep blue/indigo (trust, professionalism).
- Secondary: muted teal/green (guidance, success).
- Accent: warm amber/violet for highlights and call-to-actions.
- Neutrals: grayscale for backgrounds and text hierarchy.
- Semantic colors:
  - Success (green)
  - Warning (amber)
  - Error (red)
  - Info (blue)

Requirements:
- Ensure sufficient contrast for accessibility.
- Don’t rely solely on color to convey status – use icons/labels too.

### 4.2 Typography

- Headings: modern sans-serif (e.g., Inter, SF Pro, etc.).
- Body: a highly readable sans-serif.
- Resume/code-like content: optional monospaced or tabular alignment for alignment.
- Use weight and size, not decorative styles, to create hierarchy.

### 4.3 Layout and grids

- Desktop: 12-column grid, with side navigation + main content.
- Mobile: single-column layout with bottom navigation or tabs.
- Key patterns:
  - Dashboard style for overview.
  - Workspace mode for focused tasks (editing resume, viewing job match).
  - Split-screen diff view where space permits.

## 5. Core UX principles

- Always show what the AI changed (diffs, highlights).
- Always show why the AI recommended something (match explanations, skill gap reasons).
- Keep users in control of approvals and submissions.
- Minimize friction while maintaining transparency.
- Provide clear progress indicators during multi-step flows.

## 6. Primary user flows & screens

### 6.1 Landing and onboarding

- Landing page:
  - Clear value proposition.
  - Easy “Upload resume” primary CTA.
  - Brief visual of workflow (upload → match → tailor → apply → upskill).

- Onboarding flow:
  - Resume upload.
  - Career goals and preferences chat.
  - Short summary screen showing detected profile and preferences.

### 6.2 Master resume workspace

- Contains:
  - Resume card with status (Original, Master v1, etc.).
  - Parse confidence indicator.
  - “Improve resume” call to action.
- Resume editor:
  - Document view on right.
  - Outline or section list on left.
  - Highlighted suggestions and inline edit controls.

### 6.3 Job match board

- Board/list of job cards:
  - Title, company, location, high-level requirements.
  - Match score with small visual indicator (e.g., bar or circle).
  - Chips/tags for matched vs missing skills.
- Filters:
  - Role type, location, remote/hybrid, seniority.
- Interaction:
  - Open job details panel to see JD, match explanation, and “Tailor & apply” CTA.

### 6.4 Job detail & tailoring workspace

- Split layout:
  - Left panel: Job description and match explanation.
  - Right panel: Tabs for:
    - Tailored Resume
    - Cover Letter
- Each tab:
  - Shows AI-generated content.
  - Allows inline editing.
  - Shows what changed compared with master resume.

- Clear “Approve for this job” button and status.

### 6.5 Review & approval center

- List of artifacts grouped by job:
  - Tailored resume, cover letter with statuses.
- Filters: pending approval, approved, drafts.
- Clicking opens detailed diff and edit view.

### 6.6 Skill roadmap

- High-level overview:
  - Top skill gaps (e.g., “SQL”, “System design”).
  - Each skill: explanation of why it matters based on target jobs.
- For each skill:
  - Course cards with provider logo, title, level, duration, link.
- Optional view: timeline or “learning path” sequence.

### 6.7 LinkedIn review screen

- Layout:
  - Left: input or parsed LinkedIn sections.
  - Right: feedback per section.
- For each section (headline, about, experience, skills):
  - Score indicator.
  - Short narrative feedback.
  - Example rewriting suggestions.

## 7. Components inventory

- Navigation:
  - Sidebar nav (desktop).
  - Top/bottom nav (mobile).

- Cards:
  - Job card.
  - Resume status card.
  - Skill gap card.
  - Course recommendation card.

- Data display:
  - Tables or lists for artifacts.
  - Tags and chips for skills, statuses.

- Interactive:
  - File upload drag-and-drop zone.
  - Chat interface for onboarding.
  - Rich text editor for resumes and cover letters.
  - Diff viewer with color-coded insertions/deletions.

- Feedback:
  - Toast notifications for save/regenerate/errors.
  - Inline validation messages.

## 8. States, empty states, and errors

- Empty states:
  - No resume uploaded.
  - No jobs matched yet.
  - No skill gaps detected yet.
  - No LinkedIn data yet.

- Loading states:
  - Skeleton screens for resume parsing, job matching, generation.

- Error states:
  - Failed upload, parsing, or generation.
  - Clear retry buttons and contact support option.

## 9. Responsive design notes

- On mobile:
  - Use vertical stacking with tabs instead of split-screen.
  - Show core actions (e.g., Approve, Apply) in sticky bottom bars.
  - Ensure chat and editors are optimized for smaller screens.

- On tablet:
  - Use a simplified split view for diffs and job details.

## 10. Accessibility

- WCAG-compliant color contrast.
- Keyboard navigable main flows.
- Screen reader labels for navigation and major actions.
- Descriptive labels for AI-generated content and statuses (e.g., “AI suggestion”, “User-edited”).

## 11. Design deliverables for Claude Design

Claude Design should output:

- A reusable design system:
  - Color, typography, spacing, component library.
  - Variants for states (hover, disabled, error).

- Screen-level designs:
  - Landing and onboarding.
  - Master resume workspace.
  - Job match board.
  - Job detail & tailoring workspace.
  - Review & approval center.
  - Skill roadmap screen.
  - LinkedIn review screen.

- Responsive variants (desktop, tablet, mobile).

- A short design rationale describing how the visual language supports trust, clarity, and user control.