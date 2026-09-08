import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * simple-array -> native text[] (2026-09-07 architecture hardening, Phase
 * 4). Hand-edited from the auto-generated version: TypeORM's generator
 * produces a naive DROP COLUMN + ADD COLUMN for a type change, which
 * silently discards every existing value. `simple-array` stores as a plain
 * `text` column with values comma-joined (`"React,Node.js"`) and an empty
 * array as `''` (not NULL) — `ALTER COLUMN ... TYPE text[] USING
 * string_to_array(...)` converts in place instead, and the empty-string
 * case is handled explicitly since `string_to_array('', ',')` would
 * otherwise produce `{''}` (one empty-string element), not `{}`.
 *
 * Known, unavoidable one-time caveat: `simple-array`'s comma-join has no
 * escaping, so any EXISTING value that itself contains a comma (real
 * example found in this DB's seeded data: an AI-extracted skill literally
 * named "data quality, consistency, and integrity") gets incorrectly split
 * into multiple array elements by this conversion — there's no way to
 * recover the original boundary after the fact. This is exactly the
 * corruption risk the architecture review flagged `simple-array` for; this
 * migration fixes the schema going forward (nothing written after this
 * point can have the problem), it can't retroactively repair a value
 * that was already ambiguous on disk.
 */
export class TextArrayColumns1788722004864 implements MigrationInterface {
    name = 'TextArrayColumns1788722004864'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of [
            { table: 'job_listings', column: 'skills' },
            { table: 'candidate_profiles', column: 'targetRoles' },
            { table: 'candidate_profiles', column: 'industries' },
            { table: 'candidate_profiles', column: 'locations' },
        ]) {
            // The old text default ('') can't auto-cast to text[] — drop it
            // before the type change, not after.
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
            await queryRunner.query(`
                ALTER TABLE "${table}"
                ALTER COLUMN "${column}" TYPE text[]
                USING CASE WHEN "${column}" IS NULL OR "${column}" = '' THEN '{}'::text[] ELSE string_to_array("${column}", ',') END
            `);
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT '{}'`);
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET NOT NULL`);
        }

        // GIN index for future containment queries (`skills @> ARRAY['React']`)
        // — the whole point of this migration per the architecture review.
        await queryRunner.query(`CREATE INDEX "IDX_job_listings_skills_gin" ON "job_listings" USING GIN ("skills")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_job_listings_skills_gin"`);

        for (const { table, column } of [
            { table: 'job_listings', column: 'skills' },
            { table: 'candidate_profiles', column: 'targetRoles' },
            { table: 'candidate_profiles', column: 'industries' },
            { table: 'candidate_profiles', column: 'locations' },
        ]) {
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
            await queryRunner.query(`
                ALTER TABLE "${table}"
                ALTER COLUMN "${column}" TYPE text
                USING array_to_string("${column}", ',')
            `);
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT ''`);
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET NOT NULL`);
        }
    }

}
