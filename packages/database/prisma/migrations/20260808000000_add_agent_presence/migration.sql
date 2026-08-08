-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "last_seen_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "agents_crm_client_id_last_seen_at_idx" ON "agents"("crm_client_id", "last_seen_at");

