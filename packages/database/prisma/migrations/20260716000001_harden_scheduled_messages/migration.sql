ALTER TYPE "ScheduledMessageStatus" ADD VALUE IF NOT EXISTS 'processing';
ALTER TABLE "scheduled_messages" ADD COLUMN "processing_at" TIMESTAMP(3);
CREATE INDEX "scheduled_messages_status_processing_at_idx" ON "scheduled_messages"("status", "processing_at");
