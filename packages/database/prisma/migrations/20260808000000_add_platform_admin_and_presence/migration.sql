-- CreateEnum
CREATE TYPE "PlatformAdminRole" AS ENUM ('owner', 'support');

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "last_seen_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "platform_admin_id" TEXT;

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "auth_version" INTEGER NOT NULL DEFAULT 0,
    "role" "PlatformAdminRole" NOT NULL DEFAULT 'owner',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE INDEX "agents_crm_client_id_last_seen_at_idx" ON "agents"("crm_client_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "audit_logs_platform_admin_id_created_at_idx" ON "audit_logs"("platform_admin_id", "created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

