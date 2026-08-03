-- AlterTable
ALTER TABLE "identity"."refresh_tokens" ADD COLUMN     "revoked_at" TIMESTAMP(3);
