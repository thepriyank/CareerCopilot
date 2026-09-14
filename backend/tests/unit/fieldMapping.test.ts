import { createFakeRepo } from './testUtils/fakeRepo'

const cacheRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { FieldMappingCache } = require('../../src/entities/FieldMappingCache')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === FieldMappingCache) return cacheRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(),
}))

import { generateJson } from '../../src/services/ai/anthropicClient'
import { mapFormSchema, hashSchema } from '../../src/services/extension/fieldMapping'
import type { FormFieldSchema } from '../../src/services/extension/fieldSchema'

const mockGenerateJson = generateJson as jest.Mock

const schema: FormFieldSchema[] = [
  { fieldKey: 'first_name', type: 'text', label: 'First name', placeholder: null },
  { fieldKey: 'email_address', type: 'email', label: 'Email', placeholder: null },
  { fieldKey: 'why_us', type: 'textarea', label: 'Why do you want to work here?', placeholder: null },
]

beforeEach(() => {
  cacheRepo.rows.length = 0
  mockGenerateJson.mockReset()
})

describe('hashSchema', () => {
  it('is order-independent', () => {
    const a = hashSchema(schema)
    const b = hashSchema([...schema].reverse())
    expect(a).toBe(b)
  })

  it('changes when a field materially differs', () => {
    const a = hashSchema(schema)
    const changed = schema.map((f) => (f.fieldKey === 'email_address' ? { ...f, label: 'Your email' } : f))
    expect(hashSchema(changed)).not.toBe(a)
  })
})

describe('mapFormSchema', () => {
  it('calls the LLM and caches the result on a cache miss', async () => {
    mockGenerateJson.mockResolvedValue([
      { fieldKey: 'first_name', profileKey: 'firstName' },
      { fieldKey: 'email_address', profileKey: 'email' },
      { fieldKey: 'why_us', profileKey: null },
    ])

    const mapping = await mapFormSchema('boards.greenhouse.io', schema)

    expect(mockGenerateJson).toHaveBeenCalledTimes(1)
    expect(mapping).toEqual([
      { fieldKey: 'first_name', profileKey: 'firstName' },
      { fieldKey: 'email_address', profileKey: 'email' },
      { fieldKey: 'why_us', profileKey: null },
    ])
    expect(cacheRepo.rows).toHaveLength(1)
  })

  it('never leaves a screening question mapped — LLM-hallucinated unknown keys are dropped to null', async () => {
    mockGenerateJson.mockResolvedValue([
      { fieldKey: 'first_name', profileKey: 'firstName' },
      { fieldKey: 'email_address', profileKey: 'email' },
      { fieldKey: 'why_us', profileKey: 'motivationEssay' }, // not in the allowed vocabulary
    ])

    const mapping = await mapFormSchema('boards.greenhouse.io', schema)
    expect(mapping.find((m) => m.fieldKey === 'why_us')?.profileKey).toBeNull()
  })

  it('drops a mapping entry for a field key that was never in the input schema', async () => {
    mockGenerateJson.mockResolvedValue([
      { fieldKey: 'first_name', profileKey: 'firstName' },
      { fieldKey: 'ssn', profileKey: 'email' }, // hallucinated field
    ])

    const mapping = await mapFormSchema('boards.greenhouse.io', schema)
    expect(mapping.map((m) => m.fieldKey)).toEqual(['first_name', 'email_address', 'why_us'])
  })

  it('reuses a cached mapping without calling the LLM again', async () => {
    cacheRepo.rows.push({
      id: 'c1', hostname: 'boards.greenhouse.io', schemaHash: hashSchema(schema),
      mapping: [{ fieldKey: 'first_name', profileKey: 'firstName' }, { fieldKey: 'email_address', profileKey: 'email' }, { fieldKey: 'why_us', profileKey: null }],
      hitCount: 1,
    } as never)

    const mapping = await mapFormSchema('boards.greenhouse.io', schema)

    expect(mockGenerateJson).not.toHaveBeenCalled()
    expect(mapping[0]).toEqual({ fieldKey: 'first_name', profileKey: 'firstName' })
  })

  it('degrades to an all-null mapping (and does not cache) when the LLM call fails', async () => {
    mockGenerateJson.mockRejectedValue(new Error('provider down'))

    const mapping = await mapFormSchema('boards.greenhouse.io', schema)

    expect(mapping.every((m) => m.profileKey === null)).toBe(true)
    expect(cacheRepo.rows).toHaveLength(0)
  })

  it('a different hostname with the identical schema is a separate cache entry', async () => {
    mockGenerateJson.mockResolvedValue([
      { fieldKey: 'first_name', profileKey: 'firstName' },
      { fieldKey: 'email_address', profileKey: 'email' },
      { fieldKey: 'why_us', profileKey: null },
    ])

    await mapFormSchema('boards.greenhouse.io', schema)
    await mapFormSchema('jobs.lever.co', schema)

    expect(mockGenerateJson).toHaveBeenCalledTimes(2)
    expect(cacheRepo.rows).toHaveLength(2)
  })
})
