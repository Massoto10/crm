-- Evita clientes duplicados em corrida (dois webhooks do mesmo contato em paralelo).
-- Postgres trata NULLs como distintos, entao telefones/jids nulos nao conflitam.
CREATE UNIQUE INDEX "end_customers_crm_client_id_phone_key" ON "end_customers"("crm_client_id", "phone");
CREATE UNIQUE INDEX "end_customers_crm_client_id_whatsapp_jid_key" ON "end_customers"("crm_client_id", "whatsapp_jid");
