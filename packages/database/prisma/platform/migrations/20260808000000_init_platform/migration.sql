-- CreateEnum
CREATE TYPE "PlatformAdminRole" AS ENUM ('owner', 'support');

-- CreateEnum
CREATE TYPE "DepartmentStatus" AS ENUM ('provisioning', 'active', 'suspended', 'failed');

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

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "trade_name" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "document_number" TEXT,
    "segment" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "status" "DepartmentStatus" NOT NULL DEFAULT 'provisioning',
    "database_name" TEXT NOT NULL,
    "admin_email" TEXT NOT NULL,
    "provision_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_presence" (
    "department_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_presence_pkey" PRIMARY KEY ("department_id","agent_id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "platform_admin_id" TEXT,
    "department_id" TEXT,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "departments_database_name_key" ON "departments"("database_name");

-- CreateIndex
CREATE INDEX "departments_status_idx" ON "departments"("status");

-- CreateIndex
CREATE INDEX "agent_presence_last_seen_at_idx" ON "agent_presence"("last_seen_at");

-- CreateIndex
CREATE INDEX "platform_audit_logs_platform_admin_id_created_at_idx" ON "platform_audit_logs"("platform_admin_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_logs_department_id_created_at_idx" ON "platform_audit_logs"("department_id", "created_at");

-- AddForeignKey
ALTER TABLE "agent_presence" ADD CONSTRAINT "agent_presence_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

