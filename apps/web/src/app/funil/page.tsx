'use client';

import { FormEvent, useState } from 'react';
import { Check, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Avatar, Badge, Button, Card, Modal, PageHeader } from '@/components/ui';
import { brl } from '@/lib/format';
import { RoleGuard } from '@/components/role-guard';

type StageForm = { id?: string; name: string; color: string };

const emptyStage: StageForm = { name: '', color: '#1967ff' };

export default function FunilPage() {
  const { contacts, pipelineStages, session, updateContactStage, createPipelineStage, updatePipelineStage, removePipelineStage, notify } = useCrm();
  const [dragging, setDragging] = useState<string | null>(null);
  const [stageForm, setStageForm] = useState<StageForm | null>(null);
  const [savingStage, setSavingStage] = useState(false);
  const canManageStages = session?.role === 'institution_admin';

  const move = async (contactId: string, stageId: string, stageName: string) => {
    try {
      await updateContactStage(contactId, stageId);
      setDragging(null);
      notify(`Contato movido para ${stageName}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível mover o contato.', 'danger');
    }
  };

  const saveStage = async (event: FormEvent) => {
    event.preventDefault();
    if (!stageForm?.name.trim()) {
      notify('Informe o título do quadro.', 'danger');
      return;
    }
    setSavingStage(true);
    try {
      if (stageForm.id) {
        await updatePipelineStage(stageForm.id, { name: stageForm.name, color: stageForm.color });
        notify('Quadro atualizado.');
      } else {
        await createPipelineStage({ name: stageForm.name, color: stageForm.color });
        notify('Novo quadro criado.');
      }
      setStageForm(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível salvar o quadro.', 'danger');
    } finally {
      setSavingStage(false);
    }
  };

  const removeStage = async (id: string, name: string) => {
    if (!window.confirm(`Remover o quadro “${name}”? Os contatos dele ficarão sem etapa, mas não serão apagados.`)) return;
    try {
      await removePipelineStage(id);
      notify('Quadro removido. Os contatos foram preservados.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível remover o quadro.', 'danger');
    }
  };

  return (
    <RoleGuard allowed={['institution_admin', 'operator']}>
      <PageHeader title="Funil de vendas" subtitle="Etapas e oportunidades carregadas do banco da instituição." actions={canManageStages ? <Button onClick={() => setStageForm({ ...emptyStage })}><Plus size={17} /> Novo quadro</Button> : undefined} />
      <div className="kanban-board">
        {pipelineStages.map((stage, index) => {
          const items = contacts.filter((item) => item.stageId === stage.id);
          const total = items.reduce((sum, item) => sum + item.value, 0);
          return (
            <section key={stage.id} className="kanban-column" onDragOver={(event) => event.preventDefault()} onDrop={() => dragging && void move(dragging, stage.id, stage.name)}>
              <div className="kanban-head"><div><span className={`stage-dot stage-dot-${(index % 4) + 1}`} style={{ background: stage.color }} /><strong>{stage.name}</strong><Badge tone="gray">{items.length}</Badge></div><div className="kanban-head-actions"><span>{brl(total)}</span>{canManageStages && <div className="stage-actions"><button type="button" aria-label={`Editar quadro ${stage.name}`} title="Editar quadro" onClick={() => setStageForm({ id: stage.id, name: stage.name, color: stage.color })}><Pencil size={14} /></button><button type="button" className="stage-remove" aria-label={`Remover quadro ${stage.name}`} title="Remover quadro" onClick={() => void removeStage(stage.id, stage.name)}><Trash2 size={14} /></button></div>}</div></div>
              <div className="kanban-list">
                {items.map((item) => <Card key={item.id} className="kanban-card" draggable onDragStart={() => setDragging(item.id)}><div className="kanban-card-top"><div className="person-cell"><Avatar name={item.name} size="sm" /><div><strong>{item.name}</strong><small>{item.phone}</small></div></div><GripVertical size={16} /></div><div className="tag-wrap">{item.tags.slice(0, 2).map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}</div><div className="kanban-card-bottom"><span>{item.owner}</span><strong>{brl(item.value)}</strong></div></Card>)}
              </div>
            </section>
          );
        })}
        {!pipelineStages.length ? <Card className="empty-state">Nenhuma etapa de funil cadastrada para esta instituição.</Card> : null}
      </div>

      <Modal open={stageForm !== null} title={stageForm?.id ? 'Editar quadro' : 'Novo quadro'} onClose={() => !savingStage && setStageForm(null)} footer={<><Button variant="secondary" type="button" onClick={() => setStageForm(null)} disabled={savingStage}>Cancelar</Button><Button type="submit" form="pipeline-stage-form" disabled={savingStage}><Check size={16} />{savingStage ? 'Salvando...' : 'Salvar quadro'}</Button></>}>
        {stageForm && <form id="pipeline-stage-form" className="stage-form" onSubmit={saveStage}><label><span>Título do quadro</span><input autoFocus value={stageForm.name} onChange={(event) => setStageForm((current) => current ? { ...current, name: event.target.value } : current)} maxLength={60} placeholder="Ex.: Em negociação" /></label><label><span>Cor de identificação</span><div className="stage-color-input"><input type="color" aria-label="Cor do quadro" value={stageForm.color} onChange={(event) => setStageForm((current) => current ? { ...current, color: event.target.value } : current)} /><code>{stageForm.color.toUpperCase()}</code></div></label></form>}
      </Modal>
    </RoleGuard>
  );
}
