/**
 * Minimal in-memory stand-in for a TypeORM repository, used to unit-test
 * routes without a live Postgres connection. Supports exactly the repository
 * methods this codebase's routes actually call (create/save/find/findOneBy/
 * findOne/delete) with simple shallow-equality `where` matching — not a
 * TypeORM re-implementation, just enough to exercise route logic.
 */

import { FindOperator } from 'typeorm'

type Row = Record<string, unknown> & { id?: string }

/** Handles TypeORM `FindOperator`s (e.g. `MoreThanOrEqual(x)`) the small subset this fake repo actually needs. */
function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected instanceof FindOperator) {
    const opValue = expected.value as unknown
    switch (expected.type) {
      case 'moreThanOrEqual':
        return (actual as any) >= (opValue as any)
      case 'moreThan':
        return (actual as any) > (opValue as any)
      case 'lessThanOrEqual':
        return (actual as any) <= (opValue as any)
      case 'lessThan':
        return (actual as any) < (opValue as any)
      case 'between': {
        const [lo, hi] = opValue as [unknown, unknown]
        return (actual as any) >= (lo as any) && (actual as any) <= (hi as any)
      }
      case 'isNull':
        return actual === null || actual === undefined
      default:
        throw new Error(`fakeRepo: unsupported FindOperator type "${expected.type}"`)
    }
  }
  return actual === expected
}

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, value]) => matchesValue(row[key], value))
}

export function createFakeRepo<T extends Row>(seed: T[] = []) {
  const rows: T[] = [...seed]
  let counter = 0

  return {
    rows,
    // Mimics `@CreateDateColumn` well enough for tests that filter/sort on
    // `createdAt` (e.g. a rolling-window quota query) — real TypeORM sets
    // it at insert time; a fixture row that explicitly sets its own
    // `createdAt` (to control ordering/windowing) is left alone.
    create: (partial: Partial<T>): T => ({ createdAt: new Date(), ...partial }) as unknown as T,
    save: jest.fn(async (entity: T): Promise<T> => {
      if (!entity.id) {
        entity.id = `fake-id-${++counter}`
      }
      const idx = rows.findIndex((r) => r.id === entity.id)
      if (idx >= 0) rows[idx] = entity
      else rows.push(entity)
      return entity
    }),
    find: jest.fn(async (options?: {
      where?: Record<string, unknown>
      order?: Record<string, 'ASC' | 'DESC'>
      take?: number
    }): Promise<T[]> => {
      let result = rows.filter((r) => matches(r, options?.where))
      const orderEntry = options?.order && Object.entries(options.order)[0]
      if (orderEntry) {
        const [key, dir] = orderEntry
        result = [...result].sort((a, b) => {
          const av = a[key] as any
          const bv = b[key] as any
          const cmp = av > bv ? 1 : av < bv ? -1 : 0
          return dir === 'DESC' ? -cmp : cmp
        })
      }
      if (typeof options?.take === 'number') result = result.slice(0, options.take)
      return result
    }),
    count: jest.fn(async (options?: { where?: Record<string, unknown> }): Promise<number> => {
      return rows.filter((r) => matches(r, options?.where)).length
    }),
    findOneBy: jest.fn(async (where: Record<string, unknown>): Promise<T | null> => {
      return rows.find((r) => matches(r, where)) ?? null
    }),
    findOne: jest.fn(async (options: {
      where?: Record<string, unknown>
      order?: Record<string, 'ASC' | 'DESC'>
    }): Promise<T | null> => {
      const matched = rows.filter((r) => matches(r, options?.where))
      const orderEntry = options?.order && Object.entries(options.order)[0]
      if (!orderEntry) return matched[0] ?? null
      const [key, dir] = orderEntry
      const sorted = [...matched].sort((a, b) => {
        const av = a[key] as any
        const bv = b[key] as any
        const cmp = av > bv ? 1 : av < bv ? -1 : 0
        return dir === 'DESC' ? -cmp : cmp
      })
      return sorted[0] ?? null
    }),
    // Bulk-matching, like real TypeORM's criteria-object delete/update — an
    // id string still narrows to exactly one row (the common case), but a
    // where-object now removes/updates every match, not just the first.
    // Returns `{ affected }` like TypeORM's DeleteResult/UpdateResult, for
    // callers (e.g. jobCleanup.ts) that check how many rows were touched.
    delete: jest.fn(async (where: Record<string, unknown>): Promise<{ affected: number }> => {
      let affected = 0
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], where)) {
          rows.splice(i, 1)
          affected++
        }
      }
      return { affected }
    }),
    update: jest.fn(async (criteria: string | Record<string, unknown>, partial: Partial<T>): Promise<{ affected: number }> => {
      const where = typeof criteria === 'string' ? { id: criteria } : criteria
      const matched = rows.filter((r) => matches(r, where))
      matched.forEach((r) => Object.assign(r, partial))
      return { affected: matched.length }
    }),
  }
}

export type FakeRepo<T extends Row> = ReturnType<typeof createFakeRepo<T>>
