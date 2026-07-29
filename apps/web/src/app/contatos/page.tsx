'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Download, Filter, MoreHorizontal, Plus, Search, Upload } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Avatar, Badge, Button, Card, Modal, PageHeader } from '@/components/ui';
import { brl } from '@/lib/format';
import type { Contact } from '@/lib/types';
import { RoleGuard } from '@/components/role-guard';

const blankContact = { name: '', phone: '', email: '', value: '0', stageId: '' };

export default function ContatosPage() {
  const { contacts, pipelineStages, createContact, loading, notify } = useCrm();
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('Todos');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankContact);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => contacts.filter((item) => {
    const search = `${item.name} ${item.email} ${item.phone}`.toLowerCase();
    return search.includes(query.toLowerCase()) && (stage === 'Todos' || item.stage === stage);
  }), [contacts, query, stage]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createContact({ name: form.name, phone: form.phone, email: form.email, value: Number(form.value), stageId: form.stageId || undefined });
      setOpen(false);
      setForm(blankContact);
      notify('Contato criado no banco com sucesso.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível criar o contato.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allowed={['institution_admin', 'operator']}>
      <PageHeader title="Contatos" subtitle="Dados carregados diretamente da sua operação." actions={<><Button variant="secondary" disabled><Upload size={17} /> Importar</Button><Button onClick={() => setOpen(true)}><Plus size={17} /> Novo contato</Button></>} />
      <Card>
        <div className="table-toolbar">
          <div className="panel-search grow"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contato, telefone ou e-mail..." /></div>
          <select className="select" value={stage} onChange={(event) => setStage(event.target.value)}><option>Todos</option>{pipelineStages.map((item) => <option key={item.id}>{item.name}</option>)}</select>
          <Button variant="secondary" disabled><Filter size={16} /> Mais filtros</Button>
          <Button variant="ghost" disabled><Download size={16} /> Exportar</Button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Contato</th><th>Telefone</th><th>Responsável</th><th>Status</th><th>Etapa</th><th>Valor estimado</th><th>Último contato</th><th /></tr></thead>
            <tbody>{filtered.map((item) => <tr key={item.id} onClick={() => setSelected(item)}><td><div className="person-cell"><Avatar name={item.name} size="sm" /><div><strong>{item.name}</strong><small>{item.email}</small></div></div></td><td>{item.phone}</td><td>{item.owner}</td><td><Badge tone={item.status === 'Cliente' ? 'green' : item.status === 'Proposta' ? 'purple' : 'blue'}>{item.status}</Badge></td><td>{item.stage}</td><td><strong>{brl(item.value)}</strong></td><td>{item.lastContact}</td><td><button className="icon-button" aria-label="Ver detalhes"><MoreHorizontal size={18} /></button></td></tr>)}</tbody>
          </table>
        </div>
        <div className="table-footer"><span>{loading ? 'Atualizando...' : `Mostrando ${filtered.length} de ${contacts.length} contatos`}</span></div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo contato" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button form="contact-form" type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar contato'}</Button></>}>
        <form id="contact-form" className="form-grid" onSubmit={create}>
          <label className="full"><span>Nome completo</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Juliana Ferreira" /></label>
          <label><span>Telefone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(11) 99999-9999" /></label>
          <label><span>E-mail</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="cliente@email.com" /></label>
          <label><span>Etapa inicial</span><select value={form.stageId} onChange={(event) => setForm({ ...form, stageId: event.target.value })}><option value="">Sem etapa</option>{pipelineStages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Valor estimado</span><input type="number" min="0" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} /></label>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Detalhes do contato">
        {selected ? <div className="detail-stack"><div className="detail-person"><Avatar name={selected.name} size="lg" /><div><h3>{selected.name}</h3><p>{selected.email}</p><p>{selected.phone}</p></div></div><div className="detail-grid"><div><span>Responsável</span><strong>{selected.owner}</strong></div><div><span>Etapa</span><strong>{selected.stage}</strong></div><div><span>Valor</span><strong>{brl(selected.value)}</strong></div><div><span>Último contato</span><strong>{selected.lastContact}</strong></div></div><div className="tag-wrap">{selected.tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}</div></div> : null}
      </Modal>
    </RoleGuard>
  );
}
