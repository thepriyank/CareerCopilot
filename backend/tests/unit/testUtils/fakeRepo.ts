/**
 * Minimal in-memory stand-in for a TypeORM repository, used to unit-test
 * routes without a live Postgres connection. Supports exactly the repository
 * methods this codebase's routes actually call (create/save/find/findOneBy/
 * findOne/delete) with simple shallow-equality `where` matching — not a
 * TypeORM re-implementation, just enough to exercise route logic.
 */

type Row = Record<string, unknown> & { id?: string }

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, value]) => row[key] === value)
}

export function createFakeRepo<T extends Row>(seed: T[] = []) {
  const rows: T[] = [...seed]
  let counter = 0

  return {
    rows,
    create: (partial: Partial<T>): T => ({ ...partial }) as T,
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
  }
}

export type FakeRepo<T extends Row> = ReturnType<typeof createFakeRepo<T>>
