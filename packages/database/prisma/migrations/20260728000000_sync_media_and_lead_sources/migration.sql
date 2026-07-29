-- Fecha o drift entre schema.prisma e o histórico de migrations.
--
-- Estas colunas e a tabela lead_sources existiam no schema e em produção,
-- mas nenhuma migration as criava: o banco de produção foi evoluindo por
-- `db push`. Um ambiente novo montado com `migrate deploy` saía sem elas e
-- quebrava em qualquer query de mídia ou de origem de lead.
--
-- Gerado com `prisma migrate diff --from-migrations --to-schema-datamodel`,
-- então reproduz exatamente o schema.prisma.

-- DropIndex
DROP INDEX "end_customers_pipeline_stage_id_idx";

-- AlterTable
ALTER TABLE "end_customers" ADD COLUMN     "lead_source_id" TEXT,
ADD COLUMN     "source_ref" TEXT,
ADD COLUMN     "source_url" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "media_type" TEXT,
ADD COLUMN     "media_url" TEXT;

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" TEXT NOT NULL,
    "crm_client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "code" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_sources_crm_client_id_idx" ON "lead_sources"("crm_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_crm_client_id_name_key" ON "lead_sources"("crm_client_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_crm_client_id_code_key" ON "lead_sources"("crm_client_id", "code");

-- CreateIndex
CREATE INDEX "end_customers_lead_source_id_idx" ON "end_customers"("lead_source_id");

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_crm_client_id_fkey" FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "end_customers" ADD CONSTRAINT "end_customers_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

