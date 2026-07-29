import { ConfiguracoesClientPage } from './configuracoes-client';

export default function ConfiguracoesPage() {
  return <ConfiguracoesClientPage />;
}

/*

import { useEffect, useState } from 'react';
import { Bell, Building2, KeyRound, Laptop, MessageCircleMore, Moon, Palette, Save, ShieldCheck, Sun, Waypoints, Zap } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { RoleGuard } from '@/components/role-guard';
import { applyThemePreference, normalizeThemePreference, type ThemePreference } from '@/lib/theme';

const tabs = [
  { id: 'geral', label: 'Geral', icon: Building2 },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircleMore },
  { id: 'aparencia', label: 'Aparência', icon: Palette },
  { id: 'funil', label: 'Funil de vendas', icon: Waypoints },
  { id: 'atalhos', label: 'Mensagens rápidas', icon: Zap },
  { id: 'seguranca', label: 'Segurança', icon: ShieldCheck },
];

export default function ConfiguracoesPage() {
  const { session, settings, whatsapp, saveSettings, notify } = useCrm();
  const [tab, setTab] = useState('geral');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setValues(settings), [settings]);
  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const setTheme = (theme: ThemePreference) => {
    setValue('appearance_theme', theme);
    applyThemePreference(theme);
  };
  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(values);
      notify('Configurações salvas no banco.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allowed={['institution_admin']}>
      <PageHeader title="Configurações da instituição" subtitle="Preferências persistidas no banco do tenant atual." actions={<Button onClick={() => void save()} disabled={saving}><Save size={17} /> {saving ? 'Salvando...' : 'Salvar alterações'}</Button>} />
      <div className="settings-layout">
        <Card className="settings-nav">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18} /><span>{label}</span></button>)}</Card>
        <div className="settings-content">
          {tab === 'geral' && <Card><div className="card-heading"><div><h2>Informações da instituição</h2><p>Identificação exibida para a equipe.</p></div><Badge tone="blue">Tenant ativo</Badge></div><div className="form-grid settings-form"><label className="full"><span>Nome da instituição</span><input value={session?.institutionName ?? ''} disabled /></label><label><span>E-mail principal</span><input value={values.company_email ?? ''} onChange={(event) => setValue('company_email', event.target.value)} placeholder="contato@empresa.com" /></label><label><span>Telefone</span><input value={values.company_phone ?? ''} onChange={(event) => setValue('company_phone', event.target.value)} placeholder="(11) 99999-9999" /></label><label><span>Fuso horário</span><select value={values.timezone ?? 'America/Sao_Paulo'} onChange={(event) => setValue('timezone', event.target.value)}><option value="America/Sao_Paulo">(GMT-03:00) Brasília</option></select></label><label><span>Idioma</span><select value={values.locale ?? 'pt-BR'} onChange={(event) => setValue('locale', event.target.value)}><option value="pt-BR">Português (Brasil)</option></select></label></div></Card>}
          {tab === 'aparencia' && <Card><div className="card-heading"><div><h2>Aparência</h2><p>Escolha como o CRM será exibido para a equipe desta instituição.</p></div><Palette size={20} /></div><div className="theme-grid"><button type="button" className={`theme-option ${normalizeThemePreference(values.appearance_theme) === 'system' ? 'active' : ''}`} onClick={() => setTheme('system')} aria-pressed={normalizeThemePreference(values.appearance_theme) === 'system'}><span className="theme-option-icon"><Laptop size={21} /></span><span><strong>Automático</strong><small>Segue a preferência do dispositivo.</small></span></button><button type="button" className={`theme-option ${normalizeThemePreference(values.appearance_theme) === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} aria-pressed={normalizeThemePreference(values.appearance_theme) === 'light'}><span className="theme-option-icon"><Sun size={21} /></span><span><strong>Claro</strong><small>Interface clara e objetiva.</small></span></button><button type="button" className={`theme-option ${normalizeThemePreference(values.appearance_theme) === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} aria-pressed={normalizeThemePreference(values.appearance_theme) === 'dark'}><span className="theme-option-icon"><Moon size={21} /></span><span><strong>Escuro</strong><small>Menos brilho em ambientes escuros.</small></span></button></div><div className="info-banner"><Palette size={18} /><div><strong>Preferência da instituição</strong><span>O tema selecionado é aplicado imediatamente e fica salvo ao clicar em “Salvar alterações”.</span></div></div></Card>}
          {tab === 'whatsapp' && <Card><div className="card-heading"><div><h2>Conexão com WhatsApp</h2><p>Status consultado diretamente na API.</p></div><Badge tone={whatsapp?.status === 'connected' || whatsapp?.status === 'open' ? 'green' : 'gray'}>{whatsapp?.status ?? 'indisponível'}</Badge></div><div className="integration-grid"><div className="integration-card"><div className="integration-icon"><MessageCircleMore size={27} /></div><div><span>Instância</span><strong>{whatsapp?.instanceName ?? 'Nenhuma instância configurada'}</strong><small>{whatsapp?.status ?? 'Status ainda não disponível'}</small></div></div></div><div className="info-banner"><ShieldCheck size={18} /><div><strong>Ações protegidas</strong><span>Conectar ou desconectar o WhatsApp altera serviços externos e será disponibilizado com confirmação explícita.</span></div></div></Card>}
          {tab === 'funil' && <Card><div className="card-heading"><div><h2>Automação do funil</h2><p>Palavras-chave utilizadas pelo backend ao classificar mensagens.</p></div></div><div className="form-grid settings-form"><label><span>Automação ativa</span><select value={values.pipeline_auto_enabled ?? 'true'} onChange={(event) => setValue('pipeline_auto_enabled', event.target.value)}><option value="true">Ativa</option><option value="false">Desativada</option></select></label><label className="full"><span>Palavras de qualificação</span><textarea value={values.pipeline_qualificacao_keywords ?? ''} onChange={(event) => setValue('pipeline_qualificacao_keywords', event.target.value)} rows={4} placeholder="interesse, informações, preço" /></label><label className="full"><span>Palavras de proposta</span><textarea value={values.pipeline_proposta_keywords ?? ''} onChange={(event) => setValue('pipeline_proposta_keywords', event.target.value)} rows={4} placeholder="proposta, contrato, orçamento" /></label></div><div className="info-banner"><Waypoints size={18} /><div><strong>Regra do backend</strong><span>O funil avança de acordo com as configurações persistidas nesta conta.</span></div></div></Card>}
          {tab === 'atalhos' && <Card><div className="card-heading"><div><h2>Mensagens rápidas</h2><p>Os atalhos são gerenciados pelo módulo de mensagens rápidas da API.</p></div></div><div className="empty-state">Nenhuma mensagem de demonstração é exibida aqui.</div></Card>}
          {tab === 'seguranca' && <Card><div className="card-heading"><div><h2>Segurança e sessão</h2><p>Políticas aplicadas pelo backend.</p></div><KeyRound size={20} /></div><div className="security-list"><div><div><strong>Sessão em cookie HTTP-only</strong><span>O token não fica acessível ao JavaScript do navegador.</span></div><Badge tone="green">Ativo</Badge></div><div><div><strong>Revogação imediata</strong><span>Alterações de acesso invalidam sessões antigas via authVersion.</span></div><Badge tone="green">Ativo</Badge></div><div><div><strong>Notificações operacionais</strong><span>Preferência registrada para a instituição.</span></div><label className="switch"><input type="checkbox" checked={values.security_access_notifications === 'true'} onChange={(event) => setValue('security_access_notifications', String(event.target.checked))} /><span /></label></div><div><div><strong>Alertas por e-mail</strong><span>Preferência administrativa persistida no banco.</span></div><Bell size={19} /></div></div></Card>}
        </div>
      </div>
    </RoleGuard>
  );
}
*/
