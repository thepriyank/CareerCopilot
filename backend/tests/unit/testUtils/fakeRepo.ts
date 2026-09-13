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
    find: jest.fn(async (options?: { where?: Record<string, unknown> }): Promise<T[]> => {
      return rows.filter((r) => matches(r, options?.where))
    }),
    count: jest.fn(async (options?: { where?: Record<string, unknown> }): Promise<number> => {
      return rows.filter((r) => matches(r, options?.where)).length
    }),
    findOneBy: jest.fn(async (where: Record<string, unknown>): Promise<T | null> => {
      return rows.find((r) => matches(r, where)) ?? null
    }),
    findOne: jest.fn(async (options: { where?: Record<string, unknown> }): Promise<T | null> => {
      return rows.find((r) => matches(r, options?.where)) ?? null
    }),
    delete: jest.fn(async (where: Record<string, unknown>): Promise<void> => {
      const idx = rows.findIndex((r) => matches(r, where))
      if (idx >= 0) rows.splice(idx, 1)
    }),
    update: jest.fn(async (id: string, partial: Partial<T>): Promise<void> => {
      const row = rows.find((r) => r.id === id)
      if (row) Object.assign(row, partial)
    }),
  }
}

export type FakeRepo<T extends Row> = ReturnType<typeof createFakeRepo<T>>
