import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds Google sign-in support to `users` (2026-09-07 — see
 * routes/auth.routes.ts's POST /google): a nullable, unique `firebaseUid`
 * to link a row to its Firebase Auth identity, an `authProvider` enum, and
 * `passwordHash` becomes nullable (a Google-only account never sets one).
 *
 * Hand-edited from the auto-generated version: the generator also wanted to
 * DROP `IDX_job_listings_skills_gin` (the Phase 4 GIN index from
 * `TextArrayColumns`) because that index was created with raw SQL rather
 * than an entity-level `@Index` decorator, so TypeORM's schema diff doesn't
 * recognize it as "expected" — and its `down()` would have recreated it as
 * a plain btree index, silently losing the GIN method on a rollback.
 * Removed both — this migration has nothing to do with that index.
 */
export class AddGoogleAuthToUsers1788775819815 implements MigrationInterface {
    name = 'AddGoogleAuthToUsers1788775819815'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "firebaseUid" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_e621f267079194e5428e19af2f3" UNIQUE ("firebaseUid")`);
        await queryRunner.query(`CREATE TYPE "public"."users_authprovider_enum" AS ENUM('PASSWORD', 'GOOGLE')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "authProvider" "public"."users_authprovider_enum" NOT NULL DEFAULT 'PASSWORD'`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "authProvider"`);
        await queryRunner.query(`DROP TYPE "public"."users_authprovider_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_e621f267079194e5428e19af2f3"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "firebaseUid"`);
    }

}
