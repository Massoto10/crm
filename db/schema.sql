-- Base relacional do STN CRM.
-- Modelo: clientes do CRM possuem seus proprios clientes finais.

CREATE TABLE crm_clients (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  document_number TEXT,
  segment TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'trial', 'paused', 'churn')),
  classification TEXT NOT NULL CHECK (classification IN ('strategic', 'growth', 'standard', 'at_risk')),
  owner_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE client_channels (
  id TEXT PRIMARY KEY,
  crm_client_id TEXT NOT NULL REFERENCES crm_clients (id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp', 'instagram', 'email', 'site')),
  display_name TEXT NOT NULL,
  external_reference TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE end_customers (
  id TEXT PRIMARY KEY,
  crm_client_id TEXT NOT NULL REFERENCES crm_clients (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  instagram_handle TEXT,
  email TEXT,
  document_number TEXT,
  origin_channel TEXT NOT NULL CHECK (origin_channel IN ('whatsapp', 'instagram', 'email', 'site', 'manual')),
  lifecycle_stage TEXT NOT NULL CHECK (lifecycle_stage IN ('new', 'qualified', 'proposal', 'won', 'lost', 'support')),
  lead_temperature TEXT NOT NULL CHECK (lead_temperature IN ('hot', 'warm', 'cold')),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  score INTEGER NOT NULL DEFAULT 0,
  estimated_value_cents INTEGER NOT NULL DEFAULT 0,
  assigned_to TEXT,
  last_contact_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE labels (
  id TEXT PRIMARY KEY,
  crm_client_id TEXT REFERENCES crm_clients (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('profile', 'behavior', 'deal', 'risk', 'channel')),
  UNIQUE (crm_client_id, name)
);

CREATE TABLE end_customer_labels (
  end_customer_id TEXT NOT NULL REFERENCES end_customers (id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
  PRIMARY KEY (end_customer_id, label_id)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  crm_client_id TEXT NOT NULL REFERENCES crm_clients (id) ON DELETE CASCADE,
  end_customer_id TEXT NOT NULL REFERENCES end_customers (id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp', 'instagram')),
  status TEXT NOT NULL CHECK (status IN ('open', 'waiting_customer', 'waiting_agent', 'closed')),
  stage TEXT NOT NULL,
  sla_status TEXT NOT NULL CHECK (sla_status IN ('on_time', 'warning', 'late')),
  last_message_preview TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'end_customer', 'system')),
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  read_at TEXT
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  crm_client_id TEXT NOT NULL REFERENCES crm_clients (id) ON DELETE CASCADE,
  end_customer_id TEXT REFERENCES end_customers (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'done', 'canceled')),
  due_at TEXT,
  owner_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX crm_clients_status_idx ON crm_clients (status);
CREATE INDEX end_customers_client_idx ON end_customers (crm_client_id);
CREATE INDEX end_customers_stage_idx ON end_customers (lifecycle_stage);
CREATE INDEX labels_client_idx ON labels (crm_client_id);
CREATE INDEX conversations_channel_idx ON conversations (channel_type, status);
CREATE INDEX conversations_customer_idx ON conversations (end_customer_id);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, sent_at);
