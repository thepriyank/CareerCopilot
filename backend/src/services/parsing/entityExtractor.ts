import { v4 as uuidv4 } from 'uuid'
import { generateJson } from '../ai/anthropicClient'
import {
  ExtractedEntities,
  ConfidenceScores,
  WorkExperience,
  Education,
  Skill,
  Certification,
  Project,
} from '../../types'
import { logger } from '../../utils/logger'

const MAX_TEXT_LENGTH = 50_000

interface RawClaudeEntities {
  contact?: {
    name?: string
    email?: string
    phone?: string
    location?: string
    linkedin?: string
    website?: string
  }
  summary?: string
  experience?: Array<{
    company?: string
    title?: string
    location?: string
    startDate?: string
    endDate?: string
    current?: boolean
    bullets?: string[]
  }>
  education?: Array<{
    institution?: string
    degree?: string
    field?: string
    startDate?: string
    endDate?: string
    gpa?: string
  }>
  skills?: Array<{ name?: string; category?: string } | string>
  certifications?: Array<{ name?: string; issuer?: string; date?: string } | string>
  projects?: Array<{
    name?: string
    description?: string
    technologies?: string[]
    url?: string
  }>
}

const EXTRACTION_PROMPT = `You are a professional resume parser. Extract structured information from this resume text.

CRITICAL RULES:
- Only extract information explicitly stated in the resume text.
- Do NOT invent, infer, or add any information that is not present.
- If a field is absent, omit it or use null.
- Preserve the exact wording of bullet points.
- For dates, preserve original format (e.g., "Jan 2020", "2018–2021", "Present").

Return valid JSON with this exact structure:
{
  "contact": {
    "name": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "linkedin": "string or null",
    "website": "string or null"
  },
  "summary": "string or null",
  "experience": [
    {
      "company": "string",
      "title": "string",
      "location": "string or null",
      "startDate": "string or null",
      "endDate": "string or null",
      "current": false,
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string or null",
      "field": "string or null",
      "startDate": "string or null",
      "endDate": "string or null",
      "gpa": "string or null"
    }
  ],
  "skills": [
    { "name": "string", "category": "string or null" }
  ],
  "certifications": [
    { "name": "string", "issuer": "string or null", "date": "string or null" }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"],
      "url": "string or null"
    }
  ]
}

RESUME TEXT:
{RESUME_TEXT}`

export async function extractEntities(
  rawText: string,
  options: { userId?: string; userApiKey?: string } = {}
): Promise<ExtractedEntities> {
  const truncated = rawText.slice(0, MAX_TEXT_LENGTH)
  const prompt = EXTRACTION_PROMPT.replace('{RESUME_TEXT}', truncated)

  let raw: RawClaudeEntities = {}
  try {
    raw = await generateJson<RawClaudeEntities>(prompt, {
      userId: options.userId,
      userApiKey: options.userApiKey,
      feature: 'resume_parsing',
    })
  } catch (err) {
    logger.warn('Claude entity extraction failed, returning empty entities', {
      err: (err as Error).message,
    })
  }

  const experience: WorkExperience[] = (raw.experience ?? []).map((e) => ({
    id: uuidv4(),
    company: e.company ?? 'Unknown Company',
    title: e.title ?? 'Unknown Title',
    location: e.location,
    startDate: e.startDate,
    endDate: e.endDate,
    current: e.current ?? (e.endDate?.toLowerCase().includes('present') ?? false),
    bullets: e.bullets ?? [],
  }))

  const education: Education[] = (raw.education ?? []).map((e) => ({
    id: uuidv4(),
    institution: e.institution ?? 'Unknown Institution',
    degree: e.degree,
    field: e.field,
    startDate: e.startDate,
    endDate: e.endDate,
    gpa: e.gpa,
  }))

  const skills: Skill[] = (raw.skills ?? []).map((s) => ({
    id: uuidv4(),
    name: typeof s === 'string' ? s : (s.name ?? ''),
    category: typeof s === 'string' ? undefined : s.category ?? undefined,
  }))

  const certifications: Certification[] = (raw.certifications ?? []).map((c) => ({
    id: uuidv4(),
    name: typeof c === 'string' ? c : (c.name ?? ''),
    issuer: typeof c === 'string' ? undefined : c.issuer ?? undefined,
    date: typeof c === 'string' ? undefined : c.date ?? undefined,
  }))

  const projects: Project[] = (raw.projects ?? []).map((p) => ({
    id: uuidv4(),
    name: p.name ?? 'Unnamed Project',
    description: p.description ?? '',
    technologies: p.technologies,
    url: p.url,
  }))

  return {
    contact: {
      name: raw.contact?.name ?? undefined,
      email: raw.contact?.email ?? undefined,
      phone: raw.contact?.phone ?? undefined,
      location: raw.contact?.location ?? undefined,
      linkedin: raw.contact?.linkedin ?? undefined,
      website: raw.contact?.website ?? undefined,
    },
    summary: raw.summary ?? undefined,
    experience,
    education,
    skills,
    certifications,
    projects,
  }
}

export function computeConfidenceScores(entities: ExtractedEntities): ConfidenceScores {
  const { contact, experience, education, skills } = entities

  const nameScore = contact.name ? 1.0 : 0.0
  const emailScore = contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? 1.0 : 0.0
  const phoneScore = contact.phone ? 1.0 : 0.0

  const expScore =
    experience.length === 0
      ? 0.0
      : experience.some((e) => e.bullets.length > 0)
        ? 1.0
        : 0.7

  const eduScore = education.length > 0 ? 1.0 : 0.0

  const skillScore =
    skills.length >= 5 ? 1.0 : skills.length >= 1 ? 0.5 : 0.0

  const overall =
    (nameScore * 0.15 +
      emailScore * 0.15 +
      phoneScore * 0.05 +
      expScore * 0.35 +
      eduScore * 0.15 +
      skillScore * 0.15)

  return {
    overall: Math.round(overall * 100) / 100,
    name: nameScore,
    email: emailScore,
    phone: phoneScore,
    experience: expScore,
    education: eduScore,
    skills: skillScore,
  }
}
