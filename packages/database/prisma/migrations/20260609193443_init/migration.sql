-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('active', 'trial', 'paused', 'churn');

-- CreateEnum
CREATE TYPE "ClientClassification" AS ENUM ('strategic', 'growth', 'standard', 'at_risk');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('whatsapp', 'instagram', 'email', 'site', 'manual');

-- CreateEnum
CREATE TYPE "CustomerLifecycleStage" AS ENUM ('new', 'qualified', 'proposal', 'won', 'lost', 'support');

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('hot', 'warm', 'cold');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "LabelCategory" AS ENUM ('profile', 'behavior', 'deal', 'risk', 'channel');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('open', 'waiting_customer', 'waiting_agent', 'closed');

-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('on_time', 'warning', 'late');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('agent', 'end_customer', 'system');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'done', 'canceled');

-- CreateTable
CREATE TABLE "crm_clients" (
    "id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT NOT NULL,
    "document_number" TEXT,
    "segment" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL,
    "classification" "ClientClassification" NOT NULL,
    "owner_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_channels" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "channel_type" "ChannelType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "external_reference" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "client_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "end_customers" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "company_name" TEXT,
    "phone" TEXT,
    "instagram_handle" TEXT,
    "email" TEXT,
    "document_number" TEXT,
    "origin_channel" "ChannelType" NOT NULL,
    "lifecycle_stage" "CustomerLifecycleStage" NOT NULL,
    "lead_temperature" "LeadTemperature" NOT NULL,
    "priority" "Priority" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "estimated_value_cents" INTEGER NOT NULL DEFAULT 0,
    "assigned_to" TEXT,
    "last_contact_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "end_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" "LabelCategory" NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "end_customer_labels" (
    "end_customer_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    CONSTRAINT "end_customer_labels_pkey" PRIMARY KEY ("end_customer_id","label_id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "end_customer_id" TEXT NOT NULL,
    "channel_type" "ChannelType" NOT NULL,
    "status" "ConversationStatus" NOT NULL,
    "stage" TEXT NOT NULL,
    "sla_status" "SlaStatus" NOT NULL,
    "last_message_preview" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_type" "SenderType" NOT NULL,
    "sender_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "end_customer_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "due_at" TIMESTAMP(3),
    "owner_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_clients_status_idx" ON "crm_clients"("status");

-- CreateIndex
CREATE INDEX "client_channels_crm_client_id_idx" ON "client_channels"("crm_client_id");

-- CreateIndex
CREATE INDEX "end_customers_crm_client_id_idx" ON "end_customers"("crm_client_id");

-- CreateIndex
CREATE INDEX "end_customers_lifecycle_stage_idx" ON "end_customers"("lifecycle_stage");

-- CreateIndex
CREATE INDEX "labels_crm_client_id_idx" ON "labels"("crm_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_crm_client_id_name_key" ON "labels"("crm_client_id", "name");

-- CreateIndex
CREATE INDEX "conversations_channel_type_status_idx" ON "conversations"("channel_type", "status");

-- CreateIndex
CREATE INDEX "conversations_end_customer_id_idx" ON "conversations"("end_customer_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_sent_at_idx" ON "messages"("conversation_id", "sent_at");

-- CreateIndex
CREATE INDEX "tasks_crm_client_id_idx" ON "tasks"("crm_client_id");

-- CreateIndex
CREATE INDEX "tasks_end_customer_id_idx" ON "tasks"("end_customer_id");

-- AddForeignKey
ALTER TABLE "client_channels" ADD CONSTRAINT "client_channels_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "end_customers" ADD CONSTRAINT "end_customers_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "end_customer_labels" ADD CONSTRAINT "end_customer_labels_end_customer_id_fkey" FOREIGN KEY ("end_customer_id") REFERENCES "end_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "end_customer_labels" ADD CONSTRAINT "end_customer_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_end_customer_id_fkey" FOREIGN KEY ("end_customer_id") REFERENCES "end_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_end_customer_id_fkey" FOREIGN KEY ("end_customer_id") REFERENCES "end_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
