'use client';

import { useMemo } from 'react';
import { CalendarCheck2, ContactRound, MessageCircleMore, TrendingUp, UserRoundCheck } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import { brl } from '@/lib/format';
import { RoleGuard } from '@/components/role-guard';

const colors = ['#2563eb', '#22c55e', '#f59e0b', '#94a3b8'];

export default function DashboardPage() {
  const { contacts, conversations, schedules, session, pipelineStages, operators } = useCrm();
  const openConversations = conversations.filter((item) => item.status !== 'closed').length;
  const pending = conversations.filter((item) => item.status === 'pending').length;
  const waiting = conversations.filter((item) => item.status.includes('waiting')).length;
  const closed = conversations.filter((item) => item.status === 'closed').length;
  const totalPipeline = contacts.reduce((sum, item) => sum + item.value, 0);
  const stageTotals = useMemo(() => pipelineStages.map((stage) => ({ ...stage, count: contacts.filter((item) => item.stageId === stage.id).length })), [contacts, pipelineStages]);
  const channelTotals = useMemo(() => Object.entries(conversations.reduce<Record<string, number>>((total, item) => ({ ...total, [item.channel]: (total[item.channel] ?? 0) + 1 }), {})), [conversations]);
  const teamTotals = useMemo(() => operators.map((operator) => ({ name: operator.name, count: conversations.filter((conversation) => conversation.owner === operator.name).length })), [operators, conversations]);
  const donut = useMemo(() => {
    const values = [pending, conversations.filter((item) => item.status === 'open').length, waiting, closed];
    if (!conversations.length) return '#e2e8f0';
    let offset = 0;
    return `conic-gradient(${values.map((value, index) => {
      const start = offset;
      offset += (value / conversations.length) * 100;
      return `${colors[index]} ${start}% ${offset}%`;
    }).join(', ')})`;
  }, [closed, conversations, pending, waiting]);

  return (
    <RoleGuard allowed={['institution_admin', 'operator']}>
      <PageHeader title={`Olá, ${session?.name.split(' ')[0] ?? ''}! 👋`} subtitle="Números calculados a partir dos dados reais da operação." actions={<select className="select" disabled><option>Dados atuais</option></select>} />

      <div className="stats-grid">
        <StatCard label="Conversas abertas" value={openConversations} helper={`${pending} aguardando atendimento`} icon={<MessageCircleMore size={22} />} tone="blue" />
        <StatCard label="Conversas pendentes" value={pending} helper="Aguardando primeira ação" icon={<TrendingUp size={22} />} tone="green" />
        <StatCard label="Contatos" value={contacts.length} helper="Registros retornados pela API" icon={<ContactRound size={22} />} tone="purple" />
        <StatCard label="Agendamentos" value={schedules.length} helper={`${schedules.filter((item) => item.status === 'Agendado').length} pendentes`} icon={<CalendarCheck2 size={22} />} tone="orange" />
      </div>

      <div className="dashboard-grid dashboard-grid-main">
        <Card className="chart-card">
          <div className="card-heading"><div><h2>Atendimentos por status</h2><p>Distribuição atual das conversas</p></div><Badge tone="blue">Total {conversations.length}</Badge></div>
          <div className="donut-layout">
            <div className="donut" style={{ background: donut }}><div><strong>{conversations.length}</strong><span>conversas</span></div></div>
            <div className="legend-list">
              <div><span className="legend-dot blue" />Pendente <strong>{pending}</strong></div>
              <div><span className="legend-dot green" />Ativo <strong>{conversations.filter((item) => item.status === 'open').length}</strong></div>
              <div><span className="legend-dot orange" />Aguardando <strong>{waiting}</strong></div>
              <div><span className="legend-dot gray" />Fechado <strong>{closed}</strong></div>
            </div>
          </div>
        </Card>

        <Card className="chart-card">
          <div className="card-heading"><div><h2>Conversas por canal</h2><p>Origem registrada em cada atendimento</p></div></div>
          <div className="bar-list">
            {channelTotals.length ? channelTotals.map(([channel, count]) => <div key={channel} className="bar-row"><span>{channel}</span><div><i style={{ width: `${Math.round((count / conversations.length) * 100)}%` }} /></div><strong>{count}</strong></div>) : <span>Nenhuma conversa registrada.</span>}
          </div>
        </Card>
      </div>

      <div className="dashboard-grid dashboard-grid-secondary">
        <Card>
          <div className="card-heading"><div><h2>Funil de vendas</h2><p>{brl(totalPipeline)} em oportunidades</p></div></div>
          <div className="stage-summary">
            {stageTotals.map((item, index) => <div key={item.id}><span className={`stage-index stage-${(index % 4) + 1}`}>{index + 1}</span><div><strong>{item.name}</strong><small>{item.count} contatos</small></div></div>)}
          </div>
        </Card>

        <Card>
          <div className="card-heading"><div><h2>Próximos agendamentos</h2><p>Compromissos registrados</p></div></div>
          <div className="compact-list">
            {schedules.slice(0, 4).map((item) => <div key={item.id}><span className="time-block">{item.time}</span><div><strong>{item.title}</strong><small>{item.contact}</small></div><Badge tone={item.status === 'Enviado' ? 'green' : 'blue'}>{item.status}</Badge></div>)}
          </div>
        </Card>

        <Card>
          <div className="card-heading"><div><h2>Distribuição da equipe</h2><p>Conversas por responsável</p></div><UserRoundCheck size={19} /></div>
          <div className="team-performance">
            {teamTotals.map(({ name, count }) => <div key={name}><span className="mini-avatar">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{name}</strong><small>{count} conversas</small></div><Badge tone="green">{count}</Badge></div>)}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
