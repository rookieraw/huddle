-- AlterTable: add nullable display_name column first, since existing rows
-- have no value yet.
ALTER TABLE "identity"."users" ADD COLUMN "display_name" TEXT;

-- Backfill: existing rows get a fallback name derived from their own id,
-- never from the email local part.
UPDATE "identity"."users"
SET "display_name" = 'User-' || substring("id", 1, 8)
WHERE "display_name" IS NULL;

-- Enforce NOT NULL now that every row has a value.
ALTER TABLE "identity"."users" ALTER COLUMN "display_name" SET NOT NULL;