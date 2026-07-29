CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT,
    "actor_id" TEXT,
    "actor_role" TEXT,
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

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_crm_client_id_created_at_idx" ON "audit_logs"("crm_client_id", "created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_crm_client_id_fkey"
  FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
