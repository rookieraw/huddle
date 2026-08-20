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
