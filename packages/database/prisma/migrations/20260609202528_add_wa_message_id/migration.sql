-- AlterTable
ALTER TABLE "messages" ADD COLUMN "wa_message_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "messages_wa_message_id_key" ON "messages"("wa_message_id");
