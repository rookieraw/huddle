BEGIN;

-- Establish the widened status constraint before removing the previous one.
ALTER TABLE "chat"."contact_relationships"
ADD CONSTRAINT "contact_relationships_status_check_next"
CHECK ("status" IN ('pending', 'accepted', 'rejected'));

ALTER TABLE "chat"."contact_relationships"
DROP CONSTRAINT "contact_relationships_status_check";

ALTER TABLE "chat"."contact_relationships"
RENAME CONSTRAINT "contact_relationships_status_check_next"
TO "contact_relationships_status_check";

COMMIT;
