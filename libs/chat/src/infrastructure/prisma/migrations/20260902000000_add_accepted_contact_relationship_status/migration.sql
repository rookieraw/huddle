BEGIN;

-- Establish the widened status constraint before removing the pending-only one.
ALTER TABLE "chat"."contact_relationships"
ADD CONSTRAINT "contact_relationships_status_check_next"
CHECK ("status" IN ('pending', 'accepted'));

-- Establish the widened current-pair invariant while the existing index remains.
CREATE UNIQUE INDEX "contact_relationships_current_user_pair_key_next"
ON "chat"."contact_relationships" (
    LEAST("requester_id", "recipient_id"),
    GREATEST("requester_id", "recipient_id")
)
WHERE "status" IN ('pending', 'accepted');

DROP INDEX "chat"."contact_relationships_current_user_pair_key";

ALTER INDEX "chat"."contact_relationships_current_user_pair_key_next"
RENAME TO "contact_relationships_current_user_pair_key";

ALTER TABLE "chat"."contact_relationships"
DROP CONSTRAINT "contact_relationships_status_check";

ALTER TABLE "chat"."contact_relationships"
RENAME CONSTRAINT "contact_relationships_status_check_next"
TO "contact_relationships_status_check";

COMMIT;
