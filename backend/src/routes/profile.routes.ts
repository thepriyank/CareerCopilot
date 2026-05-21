import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { generateJson } from '../services/ai/anthropicClient'
import { AuthRequest, OnboardingState, OnboardingTurn } from '../types'
import { logger } from '../utils/logger'

const router = Router()
router.use(requireAuth)

// ─── Onboarding chat ──────────────────────────────────────────────────────────

const ONBOARDING_QUESTIONS: Record<OnboardingState, string> = {
  WELCOME:
    "Welcome to AI Career Copilot! I'm going to ask you a few quick questions to build your career profile. Let's start: what job titles or roles are you targeting? (e.g., \"Senior Product Manager\", \"Data Scientist\", \"Full-Stack Engineer\")",
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
  VISA_STATUS: '',
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
  VISA_STATUS: 'DONE',
  DONE: 'DONE',
}

const COMPLETION_SCORES: Partial<Record<OnboardingState, number>> = {
  TARGET_ROLES: 15,
  INDUSTRIES: 25,
  LOCATIONS: 35,
  REMOTE_PREFERENCE: 45,
  SALARY: 60,
  URGENCY: 75,
  NOTICE_PERIOD: 90,
  VISA_STATUS: 100,
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
}

const STATE_SCHEMAS: Partial<Record<OnboardingState, string>> = {
  TARGET_ROLES: '{"targetRoles": ["array of job title strings"]}',
  INDUSTRIES: '{"industries": ["array of industry strings"]}',
  LOCATIONS: '{"locations": ["array of location strings, empty if remote only"]}',
  REMOTE_PREFERENCE:
    '{"remotePreference": "one of: REMOTE, HYBRID, ONSITE, OPEN"}',
  SALARY:
    '{"salaryMin": integer, "salaryMax": integer, "salaryCurrency": "3-letter code e.g. USD"}',
  URGENCY:
    '{"urgency": "one of: ACTIVELY_LOOKING, OPEN_TO_OPPORTUNITIES, NOT_LOOKING"}',
  NOTICE_PERIOD: '{"noticePeriod": "string describing notice period or null"}',
  VISA_STATUS: '{"visaStatus": "string describing visa/work auth status or null"}',
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

function normaliseRemotePreference(value?: string): 'REMOTE' | 'HYBRID' | 'ONSITE' | 'OPEN' {
  if (!value) return 'OPEN'
  const v = value.toUpperCase()
  if (v === 'REMOTE') return 'REMOTE'
  if (v === 'HYBRID') return 'HYBRID'
  if (v === 'ONSITE' || v === 'ON-SITE' || v === 'ON_SITE') return 'ONSITE'
  return 'OPEN'
}

function normaliseUrgency(
  value?: string
): 'ACTIVELY_LOOKING' | 'OPEN_TO_OPPORTUNITIES' | 'NOT_LOOKING' {
  if (!value) return 'ACTIVELY_LOOKING'
  const v = value.toUpperCase().replace(/[\s-]/g, '_')
  if (v === 'ACTIVELY_LOOKING') return 'ACTIVELY_LOOKING'
  if (v === 'OPEN_TO_OPPORTUNITIES') return 'OPEN_TO_OPPORTUNITIES'
  if (v === 'NOT_LOOKING') return 'NOT_LOOKING'
  return 'ACTIVELY_LOOKING'
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/profile
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: req.userId! },
    })
    res.json({ profile })
  } catch (err) {
    next(err)
  }
})

const upsertProfileSchema = z.object({
  targetRoles: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  remotePreference: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'OPEN']).optional(),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  salaryCurrency: z.string().length(3).optional(),
  urgency: z.enum(['ACTIVELY_LOOKING', 'OPEN_TO_OPPORTUNITIES', 'NOT_LOOKING']).optional(),
  noticePeriod: z.string().optional(),
  visaStatus: z.string().optional(),
  summary: z.string().optional(),
})

// POST /api/profile
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = upsertProfileSchema.parse(req.body)
    const profile = await prisma.candidateProfile.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...data },
      update: data,
    })
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
      'DONE',
    ])
    .optional(),
})

// POST /api/profile/onboarding
router.post('/onboarding', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { message, state: clientState } = onboardingSchema.parse(req.body)
    const userId = req.userId!

    // Resolve current state from DB or client
    let profile = await prisma.candidateProfile.findUnique({ where: { userId } })

    const currentState: OnboardingState =
      (clientState as OnboardingState | undefined) ??
      (profile?.onboardingState as OnboardingState | undefined) ??
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
    const updateData: Record<string, unknown> = {}
    if (extracted.targetRoles?.length) updateData.targetRoles = extracted.targetRoles
    if (extracted.industries?.length) updateData.industries = extracted.industries
    if (extracted.locations?.length) updateData.locations = extracted.locations
    if (extracted.remotePreference)
      updateData.remotePreference = normaliseRemotePreference(extracted.remotePreference)
    if (extracted.salaryMin) updateData.salaryMin = extracted.salaryMin
    if (extracted.salaryMax) updateData.salaryMax = extracted.salaryMax
    if (extracted.salaryCurrency) updateData.salaryCurrency = extracted.salaryCurrency
    if (extracted.urgency) updateData.urgency = normaliseUrgency(extracted.urgency)
    if (extracted.noticePeriod) updateData.noticePeriod = extracted.noticePeriod
    if (extracted.visaStatus) updateData.visaStatus = extracted.visaStatus

    // Advance to next state
    const nextState = STATE_TRANSITIONS[currentState]
    const completionScore = COMPLETION_SCORES[nextState] ?? 0
    updateData.onboardingState = nextState
    updateData.completionScore = completionScore

    profile = await prisma.candidateProfile.upsert({
      where: { userId },
      create: { userId, onboardingState: nextState, completionScore, ...updateData },
      update: updateData,
    })

    const isComplete = nextState === 'DONE'
    const nextQuestion = isComplete
      ? "All done! Your profile is set up. Ready to upload your resume and start matching jobs?"
      : ONBOARDING_QUESTIONS[nextState]

    const result: OnboardingTurn = {
      message: nextQuestion ?? '',
      state: nextState,
      profileUpdates: extracted,
      isComplete,
      completionScore,
    }

    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
