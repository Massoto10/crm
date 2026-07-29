'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CalendarDays, List, Plus } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Badge, Button, Card, Modal, PageHeader } from '@/components/ui';
import { RoleGuard } from '@/components/role-guard';

function initialForm() {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000);
  return {
    body: '',
    contactId: '',
    date: nextHour.toISOString().slice(0, 10),
    time: nextHour.toTimeString().slice(0, 5),
  };
}

export default function AgendamentosPage() {
  const { schedules, contacts, createSchedule, notify } = useCrm();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const pending = useMemo(() => schedules.filter((item) => ['Agendado', 'Pendente'].includes(item.status)), [schedules]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      await createSchedule({ contactId: form.contactId, body: form.body, scheduledAt });
      setOpen(false);
      setForm(initialForm());
      notify('Agendamento gravado no banco.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível criar o agendamento.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allowed={['institution_admin', 'operator']}>
      <PageHeader title="Agendamentos" subtitle="Mensagens programadas diretamente na sua operação." actions={<div className="segmented-actions"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16} /> Lista</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} /> Agenda</button></div>} />
      <div className="page-actions"><Button onClick={() => setOpen(true)}><Plus size={17} /> Novo agendamento</Button></div>

      {view === 'calendar' ? <div className="schedule-grid"><Card className="calendar-card"><div className="card-heading"><div><h2>Agenda da operação</h2><p>Os horários abaixo vêm do banco.</p></div><CalendarDays size={20} /></div><div className="info-row"><span>Agendamentos pendentes</span><strong>{pending.length}</strong></div><div className="info-row"><span>Total registrado</span><strong>{schedules.length}</strong></div></Card><Card className="agenda-card"><div className="card-heading"><div><h2>Próximos agendamentos</h2><p>{schedules.length} compromissos registrados</p></div></div><div className="agenda-timeline">{schedules.map((item) => <div key={item.id}><div className="timeline-time">{item.time}</div><span className="timeline-line" /><div className="timeline-content"><strong>{item.title}</strong><span>{item.contact}</span><small>{item.date} · {item.owner}</small></div><Badge tone={item.status === 'Enviado' ? 'green' : item.status === 'Falhou' ? 'red' : item.status === 'Pendente' ? 'orange' : 'blue'}>{item.status}</Badge></div>)}</div></Card></div> : <Card><div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Horário</th><th>Mensagem</th><th>Contato</th><th>Responsável</th><th>Status</th></tr></thead><tbody>{schedules.map((item) => <tr key={item.id}><td>{item.date}</td><td><strong>{item.time}</strong></td><td>{item.title}</td><td>{item.contact}</td><td>{item.owner}</td><td><Badge tone={item.status === 'Enviado' ? 'green' : item.status === 'Falhou' ? 'red' : item.status === 'Pendente' ? 'orange' : 'blue'}>{item.status}</Badge></td></tr>)}</tbody></table></div></Card>}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo agendamento" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button form="schedule-form" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Confirmar agendamento'}</Button></>}>
        <form id="schedule-form" className="form-grid" onSubmit={create}>
          <label className="full"><span>Mensagem</span><textarea required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Ex.: Follow-up de proposta" /></label>
          <label className="full"><span>Cliente</span><select required value={form.contactId} onChange={(event) => setForm({ ...form, contactId: event.target.value })}><option value="">Selecione um contato</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Data</span><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
          <label><span>Hora</span><input required type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
        </form>
      </Modal>
    </RoleGuard>
  );
}
