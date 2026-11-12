BEGIN;

-- Record who removed the relationship and when. Both columns are nullable so
-- existing rows remain valid without a rewrite.
ALTER TABLE "chat"."contact_relationships"
ADD COLUMN "removed_by_user_id" TEXT,
ADD COLUMN "removed_at" TIMESTAMPTZ;

-- Establish the widened status constraint before removing the previous one.
ALTER TABLE "chat"."contact_relationships"
ADD CONSTRAINT "contact_relationships_status_check_next"
CHECK ("status" IN ('pending', 'accepted', 'rejected', 'removed'));

ALTER TABLE "chat"."contact_relationships"
DROP CONSTRAINT "contact_relationships_status_check";

ALTER TABLE "chat"."contact_relationships"
RENAME CONSTRAINT "contact_relationships_status_check_next"
TO "contact_relationships_status_check";

-- A removed relationship records its remover, who must be one of its two
-- users, and its removal time. No other status carries either field. Existing
-- rows are never removed and have both columns NULL, so they satisfy this.
ALTER TABLE "chat"."contact_relationships"
ADD CONSTRAINT "contact_relationships_removal_check"
CHECK (
    (
        "status" = 'removed'
        AND "removed_by_user_id" IS NOT NULL
        AND "removed_at" IS NOT NULL
        AND "removed_by_user_id" IN ("requester_id", "recipient_id")
    )
    OR (
        "status" <> 'removed'
        AND "removed_by_user_id" IS NULL
        AND "removed_at" IS NULL
    )
);

COMMIT;
