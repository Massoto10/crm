// A API expõe dois perfis por tenant. `system_admin` fica apenas como tipo
// legado para bloquear as rotas antigas até existir uma API de plataforma.
export type Role = 'system_admin' | 'institution_admin' | 'operator';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  institutionId?: string;
  institutionName?: string;
  department?: string;
  avatar?: string;
};

export type ConversationStatus = 'pending' | 'open' | 'waiting_customer' | 'waiting_agent' | 'closed';
export type PipelineStage = string;

export type PipelineStageOption = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  owner: string;
  status: string;
  stage: string;
  stageId?: string;
  value: number;
  notes: string;
  lastContact: string;
  tags: string[];
};

export type Conversation = {
  id: string;
  contactId: string;
  channel: string;
  name: string;
  phone: string;
  preview: string;
  time: string;
  unread: number;
  status: ConversationStatus;
  stage: string;
  stageId?: string;
  owner: string;
  tags: string[];
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  direction: 'in' | 'out';
  type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker';
  content: string;
  mediaUrl?: string | null;
  time: string;
};

export type ScheduleItem = {
  id: string;
  conversationId?: string;
  contactId?: string;
  title: string;
  contact: string;
  date: string;
  time: string;
  owner: string;
  status: 'Agendado' | 'Confirmado' | 'Pendente' | 'Concluído' | 'Enviado' | 'Falhou' | 'Cancelado';
};

export type Operator = {
  id: string;
  name: string;
  email: string;
  departmentId?: string | null;
  department: string;
  status: 'Ativo' | 'Inativo';
  scope: 'own' | 'all';
  views: string[];
};
