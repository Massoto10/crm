'use client';

import { FormEvent, useState } from 'react';
import { MoreHorizontal, Plus, ShieldCheck, Users } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Avatar, Badge, Button, Card, Modal, PageHeader, StatCard } from '@/components/ui';
import { RoleGuard } from '@/components/role-guard';

const blank = { name: '', email: '', departmentId: '' };

export default function EquipePage() {
  const { operators, departments, createOperator, setOperatorActive, notify } = useCrm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await createOperator(form);
      setOpen(false);
      setForm(blank);
      setTemporaryPassword(result.temporaryPassword);
      notify('Operador criado no banco. Guarde a senha temporária exibida abaixo.', 'info');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível criar o operador.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string) => {
    const operator = operators.find((item) => item.id === id);
    if (!operator) return;
    try {
      await setOperatorActive(operator, operator.status !== 'Ativo');
      notify(operator.status === 'Ativo' ? 'Operador desativado.' : 'Operador ativado.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível atualizar o operador.', 'danger');
    }
  };

  return (
    <RoleGuard allowed={['institution_admin']}>
      <PageHeader title="Equipe" subtitle="Operadores e setores carregados da API da instituição." actions={<Button onClick={() => setOpen(true)}><Plus size={17} /> Novo operador</Button>} />
      <div className="stats-grid stats-grid-3">
        <StatCard label="Operadores cadastrados" value={operators.length} helper="Contas retornadas pela API" icon={<Users size={22} />} tone="blue" />
        <StatCard label="Operadores ativos" value={operators.filter((item) => item.status === 'Ativo').length} helper="Disponíveis para atendimento" icon={<ShieldCheck size={22} />} tone="green" />
        <StatCard label="Setores" value={departments.length} helper="Estrutura atual da equipe" icon={<Users size={22} />} tone="purple" />
      </div>
      {temporaryPassword ? <Card className="temporary-password"><strong>Senha temporária do novo operador</strong><code>{temporaryPassword}</code><Button variant="ghost" onClick={() => setTemporaryPassword(null)}>Ocultar</Button></Card> : null}
      <Card>
        <div className="table-toolbar"><div><h2>Operadores</h2><p>Criação, ativação e desativação são gravadas no banco.</p></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Operador</th><th>Setor</th><th>Escopo</th><th>Telas liberadas</th><th>Status</th><th>Ações</th></tr></thead><tbody>{operators.map((item) => <tr key={item.id}><td><div className="person-cell"><Avatar name={item.name} size="sm" /><div><strong>{item.name}</strong><small>{item.email}</small></div></div></td><td>{item.department}</td><td><Badge tone={item.scope === 'all' ? 'purple' : 'blue'}>{item.scope === 'all' ? 'Todas as conversas' : 'Próprias conversas'}</Badge></td><td><div className="tag-wrap">{item.views.length ? item.views.map((view) => <Badge key={view} tone="gray">{view}</Badge>) : <span>Definido pelo setor</span>}</div></td><td><button className="status-toggle" onClick={() => void toggleStatus(item.id)}><Badge tone={item.status === 'Ativo' ? 'green' : 'red'}>{item.status}</Badge></button></td><td><div className="table-actions"><button className="icon-button" aria-label="Mais opções"><MoreHorizontal size={16} /></button></div></td></tr>)}</tbody></table></div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo operador" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button form="operator-form" type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar operador'}</Button></>}>
        <form id="operator-form" className="form-grid" onSubmit={create}>
          <label><span>Nome completo</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Beatriz Souza" /></label>
          <label><span>E-mail de acesso</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="operador@empresa.com" /></label>
          <label className="full"><span>Setor</span><select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">Sem setor</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </form>
      </Modal>
    </RoleGuard>
  );
}
