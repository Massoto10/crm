-- Pipeline stages: tabela + coluna no end_customers + seed + backfill (aditivo, idempotente)
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id            text PRIMARY KEY,
  crm_client_id text NOT NULL,
  name          text NOT NULL,
  color         text NOT NULL,
  hint          text NOT NULL DEFAULT '',
  "order"       integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pipeline_stages_crm_fk FOREIGN KEY (crm_client_id) REFERENCES crm_clients(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_crm_client_id_name_key ON pipeline_stages(crm_client_id, name);
CREATE INDEX IF NOT EXISTS pipeline_stages_crm_client_id_idx ON pipeline_stages(crm_client_id);

ALTER TABLE end_customers ADD COLUMN IF NOT EXISTS pipeline_stage_id text;
DO $$ BEGIN
  ALTER TABLE end_customers ADD CONSTRAINT end_customers_pipeline_stage_fk
    FOREIGN KEY (pipeline_stage_id) REFERENCES pipeline_stages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO pipeline_stages (id, crm_client_id, name, color, hint, "order", is_active, created_at, updated_at) VALUES
  ('ps_entrada','cli_stn','Entrada','#206d6f','Novos contatos',0,true,now(),now()),
  ('ps_qualificacao','cli_stn','Qualificacao','#f4b45d','Perfil e necessidade',1,true,now(),now()),
  ('ps_proposta','cli_stn','Proposta','#3b82f6','Negociacao ativa',2,true,now(),now()),
  ('ps_fechados','cli_stn','Fechados','#16a34a','Clientes ganhos',3,true,now(),now())
ON CONFLICT (crm_client_id, name) DO NOTHING;

UPDATE end_customers SET pipeline_stage_id = 'ps_entrada'
  WHERE crm_client_id = 'cli_stn' AND pipeline_stage_id IS NULL;
