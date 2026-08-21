-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "chat";

-- CreateTable
CREATE TABLE "chat"."contact_relationships" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "contact_relationships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contact_relationships_status_check" CHECK ("status" = 'pending')
);

-- Enforce one current relationship for an unordered user pair.
CREATE UNIQUE INDEX "contact_relationships_current_user_pair_key"
ON "chat"."contact_relationships" (
    LEAST("requester_id", "recipient_id"),
    GREATEST("requester_id", "recipient_id")
)
WHERE "status" = 'pending';
