-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "hint" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "end_customers" ADD COLUMN "pipeline_stage_id" TEXT;

-- CreateIndex
CREATE INDEX "pipeline_stages_crm_client_id_idx" ON "pipeline_stages"("crm_client_id");
CREATE UNIQUE INDEX "pipeline_stages_crm_client_id_name_key" ON "pipeline_stages"("crm_client_id", "name");
CREATE INDEX "end_customers_pipeline_stage_id_idx" ON "end_customers"("pipeline_stage_id");

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "end_customers" ADD CONSTRAINT "end_customers_pipeline_stage_id_fkey" FOREIGN KEY ("pipeline_stage_id") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Give each existing CRM a usable initial pipeline.
INSERT INTO "pipeline_stages" ("id", "crm_client_id", "name", "color", "hint", "order", "is_active", "created_at", "updated_at")
SELECT 'pipeline-' || "id" || '-novo', "id", 'Novo', '#3B82F6', 'Novos contatos', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "crm_clients";

INSERT INTO "pipeline_stages" ("id", "crm_client_id", "name", "color", "hint", "order", "is_active", "created_at", "updated_at")
SELECT 'pipeline-' || "id" || '-andamento', "id", 'Em andamento', '#F59E0B', 'Em negociação', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "crm_clients";

INSERT INTO "pipeline_stages" ("id", "crm_client_id", "name", "color", "hint", "order", "is_active", "created_at", "updated_at")
SELECT 'pipeline-' || "id" || '-concluido', "id", 'Concluído', '#10B981', 'Atendimento concluído', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "crm_clients";
