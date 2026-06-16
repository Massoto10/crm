-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'agent');

-- CreateEnum
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('pending', 'sent', 'failed', 'canceled');

-- AlterEnum
ALTER TYPE "ConversationStatus" ADD VALUE 'pending';

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "assigned_agent_id" TEXT,
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "department_id" TEXT;

-- AlterTable
ALTER TABLE "end_customers" ADD COLUMN     "lead_status_id" TEXT;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "department_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'agent',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_statuses" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_messages" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "department_id" TEXT,
    "shortcut" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_messages" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "end_customer_id" TEXT,
    "agent_id" TEXT,
    "body" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_crm_client_id_idx" ON "departments"("crm_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_crm_client_id_name_key" ON "departments"("crm_client_id", "name");

-- CreateIndex
CREATE INDEX "agents_crm_client_id_idx" ON "agents"("crm_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_crm_client_id_email_key" ON "agents"("crm_client_id", "email");

-- CreateIndex
CREATE INDEX "lead_statuses_crm_client_id_idx" ON "lead_statuses"("crm_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_statuses_crm_client_id_name_key" ON "lead_statuses"("crm_client_id", "name");

-- CreateIndex
CREATE INDEX "quick_messages_crm_client_id_idx" ON "quick_messages"("crm_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "quick_messages_crm_client_id_shortcut_key" ON "quick_messages"("crm_client_id", "shortcut");

-- CreateIndex
CREATE INDEX "scheduled_messages_scheduled_at_status_idx" ON "scheduled_messages"("scheduled_at", "status");

-- CreateIndex
CREATE INDEX "scheduled_messages_crm_client_id_idx" ON "scheduled_messages"("crm_client_id");

-- CreateIndex
CREATE INDEX "settings_crm_client_id_idx" ON "settings"("crm_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_crm_client_id_key_key" ON "settings"("crm_client_id", "key");

-- CreateIndex
CREATE INDEX "conversations_department_id_idx" ON "conversations"("department_id");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "end_customers_lead_status_id_idx" ON "end_customers"("lead_status_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_statuses" ADD CONSTRAINT "lead_statuses_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "end_customers" ADD CONSTRAINT "end_customers_lead_status_id_fkey" FOREIGN KEY ("lead_status_id") REFERENCES "lead_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_messages" ADD CONSTRAINT "quick_messages_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_end_customer_id_fkey" FOREIGN KEY ("end_customer_id") REFERENCES "end_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
