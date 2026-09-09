import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { CandidateProfile } from '../entities/CandidateProfile'
import { RemotePreference, SearchUrgency } from '../entities/enums'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { generateJson } from '../services/ai/anthropicClient'
import { parseSalaryRange } from '../services/matching/matchScore'
import { AuthRequest, OnboardingState, OnboardingTurn } from '../types'
import { logger } from '../utils/logger'

const router = Router()
router.use(requireAuth)

// ─── Onboarding chat ──────────────────────────────────────────────────────────

const ONBOARDING_QUESTIONS: Record<OnboardingState, string> = {
  WELCOME:
    "Welcome to Jobmagnate! I'm going to ask you a few quick questions to build your career profile. Let's start: what job titles or roles are you targeting? (e.g., \"Senior Product Manager\", \"Data Scientist\", \"Full-Stack Engineer\")",
  TARGET_ROLES:
    'Great! Which industries are you interested in? You can list multiple (e.g., "Fintech, Healthcare, SaaS").',
  INDUSTRIES:
    'Which cities or regions are you open to? You can say "Remote only" if that applies.',
  LOCATIONS:
    'Do you prefer Remote, Hybrid, or On-site work? Or are you open to all options?',
  REMOTE_PREFERENCE:
    "What's your expected salary range? Include currency if outside USD (e.g., \"80k–120k USD\", \"£50k–70k\"). Type \"skip\" if you'd prefer not to share.",
  SALARY:
    'How urgently are you looking? Options: Actively looking and applying, Open to opportunities but not urgently, or Not looking right now.',
  URGENCY:
    'What is your notice period at your current role (if any)? E.g., "2 weeks", "1 month", "Immediately available", or "N/A".',
  NOTICE_PERIOD:
    'Do you have any visa or work-authorisation constraints? E.g., "US citizen", "UK work visa", "Require sponsorship", or "No constraints".',
  VISA_STATUS:
    "Last one: are there any technologies, frameworks, or tools you'd rather not work with — from older experience you're moving away from, or just a preference? List them, or say \"none\".",
  AVOID_TECH: '',
  DONE: '',
}

const STATE_TRANSITIONS: Record<OnboardingState, OnboardingState> = {
  WELCOME: 'TARGET_ROLES',
  TARGET_ROLES: 'INDUSTRIES',
  INDUSTRIES: 'LOCATIONS',
  LOCATIONS: 'REMOTE_PREFERENCE',
  REMOTE_PREFERENCE: 'SALARY',
  SALARY: 'URGENCY',
  URGENCY: 'NOTICE_PERIOD',
  NOTICE_PERIOD: 'VISA_STATUS',
  VISA_STATUS: 'AVOID_TECH',
  AVOID_TECH: 'DONE',
  DONE: 'DONE',
}

const COMPLETION_SCORES: Partial<Record<OnboardingState, number>> = {
  TARGET_ROLES: 15,
  INDUSTRIES: 25,
  LOCATIONS: 35,
  REMOTE_PREFERENCE: 45,
  SALARY: 60,
  URGENCY: 75,
  NOTICE_PERIOD: 85,
  VISA_STATUS: 95,
  AVOID_TECH: 100,
  DONE: 100,
}

const NLU_PROMPT = `You are extracting structured career preference data from a candidate's answer to the question: "{QUESTION}"

Their answer: "{ANSWER}"

Extract the following fields if present. Return JSON only.
{SCHEMA}

Rules:
- Only extract what is explicitly stated.
- Return {} if nothing can be extracted.
- For arrays, return an empty array [] if nothing found.
- For salary: extract min/max as integers (no currency symbols). Currency defaults to "USD".`

interface NluResult {
  targetRoles?: string[]
  industries?: string[]
  locations?: string[]
  remotePreference?: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  urgency?: string
  noticePeriod?: string
  visaStatus?: string
  avoidTechnologies?: string[]
}

// Keyed by `currentState` — the state we're IN while processing an answer,
// which is the state whose ONBOARDING_QUESTIONS text was actually just shown
// (e.g. ONBOARDING_QUESTIONS.TARGET_ROLES is the industries question, so the
// schema used when currentState === TARGET_ROLES must be the industries
// schema, not a target-roles one). Each entry here extracts the topic asked
// by ONBOARDING_QUESTIONS[same key] — schemas are intentionally one topic
// "ahead" of what the state's own name suggests, matching that pairing.
// AVOID_TECH has no entry: its own displayed question is blank (the last
// real question — technologies to avoid — is asked while currentState is
// VISA_STATUS).
const STATE_SCHEMAS: Partial<Record<OnboardingState, string>> = {
  WELCOME: '{"targetRoles": ["array of job title strings"]}',
  TARGET_ROLES: '{"industries": ["array of industry strings"]}',
  INDUSTRIES: '{"locations": ["array of location strings, empty if remote only"]}',
  LOCATIONS:
    '{"remotePreference": "one of: REMOTE, HYBRID, ONSITE, OPEN"}',
  REMOTE_PREFERENCE:
    '{"salaryMin": integer, "salaryMax": integer, "salaryCurrency": "3-letter code e.g. USD"}',
  SALARY:
    '{"urgency": "one of: ACTIVELY_LOOKING, OPEN_TO_OPPORTUNITIES, NOT_LOOKING"}',
  URGENCY: '{"noticePeriod": "string describing notice period or null"}',
  NOTICE_PERIOD: '{"visaStatus": "string describing visa/work auth status or null"}',
  VISA_STATUS: '{"avoidTechnologies": ["array of technology/framework/tool name strings, empty if none mentioned"]}',
}

async function extractProfileUpdate(
  state: OnboardingState,
  answer: string,
  userId: string
): Promise<NluResult> {
  const schema = STATE_SCHEMAS[state]
  if (!schema) return {}

  const prompt = NLU_PROMPT.replace('{QUESTION}', ONBOARDING_QUESTIONS[state] ?? '')
    .replace('{ANSWER}', answer)
    .replace('{SCHEMA}', schema)

  try {
    return await generateJson<NluResult>(prompt, { userId, feature: 'onboarding_nlu' })
  } catch (err) {
    logger.warn('NLU extraction failed', { state, err: (err as Error).message })
    return {}
  }
}

function normaliseRemotePreference(value?: string): RemotePreference {
  if (!value) return RemotePreference.OPEN
  const v = value.toUpperCase()
  if (v === 'REMOTE') return RemotePreference.REMOTE
  if (v === 'HYBRID') return RemotePreference.HYBRID
  if (v === 'ONSITE' || v === 'ON-SITE' || v === 'ON_SITE') return RemotePreference.ONSITE
  return RemotePreference.OPEN
}

function normaliseUrgency(
  value?: string
): SearchUrgency {
  if (!value) return SearchUrgency.ACTIVELY_LOOKING
  const v = value.toUpperCase().replace(/[\s-]/g, '_')
  if (v === 'ACTIVELY_LOOKING') return SearchUrgency.ACTIVELY_LOOKING
  if (v === 'OPEN_TO_OPPORTUNITIES') return SearchUrgency.OPEN_TO_OPPORTUNITIES
  if (v === 'NOT_LOOKING') return SearchUrgency.NOT_LOOKING
  return SearchUrgency.ACTIVELY_LOOKING
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/profile
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profileRepo = AppDataSource.getRepository(CandidateProfile)
    const profile = await profileRepo.findOneBy({ userId: req.userId! })
    res.json({ profile })
  } catch (err) {
    next(err)
  }
})

// The frontend's onboarding review screen (ProfileCompletion.tsx) fetches the
// profile via GET, lets the user edit a few fields, then POSTs the *whole*
// object back — so every field the entity allows to be null (salaryMin/Max,
// noticePeriod, visaStatus, summary) must accept null here too, not just
// undefined, or that round-trip 400s on every profile that hasn't set them yet.
const upsertProfileSchema = z.object({
  targetRoles: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  avoidTechnologies: z.array(z.string()).optional(),
  remotePreference: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'OPEN']).optional(),
  salaryMin: z.number().int().positive().nullable().optional(),
  salaryMax: z.number().int().positive().nullable().optional(),
  salaryCurrency: z.string().length(3).optional(),
  urgency: z.enum(['ACTIVELY_LOOKING', 'OPEN_TO_OPPORTUNITIES', 'NOT_LOOKING']).optional(),
  noticePeriod: z.string().nullable().optional(),
  visaStatus: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
})

// POST /api/profile
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = upsertProfileSchema.parse(req.body)
    const profileRepo = AppDataSource.getRepository(CandidateProfile)
    
    let profile = await profileRepo.findOneBy({ userId: req.userId! })
    const updateData: Partial<CandidateProfile> = {
      ...data,
      remotePreference: data.remotePreference as RemotePreference | undefined,
      urgency: data.urgency as SearchUrgency | undefined,
    }
    if (profile) {
      Object.assign(profile, updateData)
      profile = await profileRepo.save(profile)
    } else {
      profile = profileRepo.create({ userId: req.userId!, ...updateData })
      profile = await profileRepo.save(profile)
    }
    
    res.json({ profile })
  } catch (err) {
    next(err)
  }
})

const onboardingSchema = z.object({
  message: z.string().min(1),
  state: z
    .enum([
      'WELCOME',
      'TARGET_ROLES',
      'INDUSTRIES',
      'LOCATIONS',
      'REMOTE_PREFERENCE',
      'SALARY',
      'URGENCY',
      'NOTICE_PERIOD',
      'VISA_STATUS',
      'AVOID_TECH',
      'DONE',
    ])
    .optional(),
})

// POST /api/profile/onboarding
router.post('/onboarding', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { message, state: clientState } = onboardingSchema.parse(req.body)
    const userId = req.userId!

    const profileRepo = AppDataSource.getRepository(CandidateProfile)
    let profile = await profileRepo.findOneBy({ userId })

    // The persisted state is authoritative once a profile row exists — a
    // client-supplied state (e.g. stale after a page refresh) must never be
    // able to rewind or corrupt onboarding progress already saved server-side.
    const currentState: OnboardingState =
      (profile?.onboardingState as OnboardingState | undefined) ??
      (clientState as OnboardingState | undefined) ??
      'WELCOME'

    if (currentState === 'DONE') {
      const result: OnboardingTurn = {
        message: "Your profile is complete! You can update it anytime from your settings.",
        state: 'DONE',
        profileUpdates: {},
        isComplete: true,
        completionScore: 100,
      }
      res.json(result)
      return
    }

    // Extract profile updates from the user's answer
    const extracted = await extractProfileUpdate(currentState, message, userId)

    // Build profile update data
    const updateData: Partial<CandidateProfile> = {}
    if (extracted.targetRoles?.length) updateData.targetRoles = extracted.targetRoles
    if (extracted.industries?.length) updateData.industries = extracted.industries
    if (extracted.locations?.length) updateData.locations = extracted.locations
    if (extracted.remotePreference)
      updateData.remotePreference = normaliseRemotePreference(extracted.remotePreference)
    // The salary question is answered while currentState === REMOTE_PREFERENCE
    // (see STATE_SCHEMAS above). LLMs are unreliable at converting Indian
    // shorthand ("40-55 LPA", "18L") to plain numbers — the regex-based
    // parseSalaryRange already used for job postings handles k/L/lakh/lac
    // suffixes deterministically, so prefer it over the model's raw digits
    // whenever it finds a match in the candidate's own answer text.
    const parsedSalary = currentState === 'REMOTE_PREFERENCE' ? parseSalaryRange(message) : null
    if (parsedSalary) {
      updateData.salaryMin = parsedSalary.min
      updateData.salaryMax = parsedSalary.max
    } else {
      if (extracted.salaryMin) updateData.salaryMin = extracted.salaryMin
      if (extracted.salaryMax) updateData.salaryMax = extracted.salaryMax
    }
    if (extracted.salaryCurrency) updateData.salaryCurrency = extracted.salaryCurrency
    if (extracted.urgency) updateData.urgency = normaliseUrgency(extracted.urgency)
    if (extracted.noticePeriod) updateData.noticePeriod = extracted.noticePeriod
    if (extracted.visaStatus) updateData.visaStatus = extracted.visaStatus
    if (extracted.avoidTechnologies?.length) updateData.avoidTechnologies = extracted.avoidTechnologies

    // Advance to next state
    const nextState = STATE_TRANSITIONS[currentState]
    const completionScore = COMPLETION_SCORES[nextState] ?? 0
    updateData.onboardingState = nextState
    updateData.completionScore = completionScore

    if (profile) {
      Object.assign(profile, updateData)
      profile = await profileRepo.save(profile)
    } else {
      profile = profileRepo.create({ userId, ...updateData })
      profile = await profileRepo.save(profile)
    }

    // VISA_STATUS has no question of its own (the last real question — visa
    // status — is asked while still in NOTICE_PERIOD); treat an empty next
    // question the same as DONE so the chat never shows a blank bot message.
    const nextQuestionText = ONBOARDING_QUESTIONS[nextState]
    const isComplete = nextState === 'DONE' || !nextQuestionText
    const nextQuestion = isComplete
      ? "All done! Your profile is set up. Ready to upload your resume and start matching jobs?"
      : nextQuestionText

    const result: OnboardingTurn = {
      message: nextQuestion ?? '',
      state: nextState,
      profileUpdates: { ...extracted, remotePreference: extracted.remotePreference as RemotePreference | undefined, urgency: extracted.urgency as SearchUrgency | undefined },
      isComplete,
      completionScore,
    }

    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
