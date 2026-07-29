'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Copy, Download, FileText, MoreVertical, Paperclip, Plus, RotateCcw, Save, Search, Send, Smile, UserRoundCog } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Avatar, Badge, Button, Card, PageHeader } from '@/components/ui';
import type { ChatMessage, ConversationStatus } from '@/lib/types';
import { RoleGuard } from '@/components/role-guard';

const statusLabel: Record<ConversationStatus, string> = {
  pending: 'Pendente',
  open: 'Ativo',
  waiting_customer: 'Aguardando cliente',
  waiting_agent: 'Aguardando agente',
  closed: 'Fechado',
};

function safeMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  const url = value.trim();
  return /^(data:|blob:|https?:\/\/)/i.test(url) ? url : null;
}

function fileName(message: ChatMessage) {
  const label = message.content.replace(/^\[Documento\]\s*/i, '').trim();
  return label || 'Documento';
}

function hasCaption(message: ChatMessage) {
  return !/^\[(Áudio|Imagem|Vídeo|Documento|Figurinha)\]/i.test(message.content.trim());
}

function MessageContent({ message }: { message: ChatMessage }) {
  const url = safeMediaUrl(message.mediaUrl);

  if (message.type === 'text') return <p>{message.content}</p>;
  if (!url) return <p className="media-unavailable">{message.content} <span>Mídia indisponível.</span></p>;

  if (message.type === 'audio') {
    return <audio className="message-audio" controls preload="metadata" src={url}>Seu navegador não suporta reprodução de áudio.</audio>;
  }

  if (message.type === 'video') {
    return <div className="message-media"><video className="message-video" controls preload="metadata" playsInline src={url}>Seu navegador não suporta reprodução de vídeo.</video>{hasCaption(message) ? <p>{message.content}</p> : null}</div>;
  }

  if (message.type === 'document') {
    return <a className="message-document" href={url} target="_blank" rel="noreferrer" download={fileName(message)}><FileText size={20} /><span><strong>{fileName(message)}</strong><small>Abrir ou baixar documento</small></span><Download size={17} /></a>;
  }

  const alt = message.type === 'sticker' ? 'Figurinha recebida' : 'Imagem recebida';
  return <div className={`message-media ${message.type === 'sticker' ? 'message-sticker' : ''}`}><Image className="message-image" src={url} alt={alt} width={640} height={480} sizes="(max-width: 820px) 70vw, 420px" unoptimized />{message.type === 'image' && hasCaption(message) ? <p>{message.content}</p> : null}</div>;
}

function parseProposalValue(value: string) {
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

export default function AtendimentoPage() {
  const {
    conversations,
    messages,
    contacts,
    pipelineStages,
    loadConversation,
    sendMessage,
    closeConversation,
    setConversationStatus,
    updateContactStage,
    updateContactDetails,
    addContactLabel,
    notify,
  } = useCrm();
  const [activeId, setActiveId] = useState('');
  const [tab, setTab] = useState<'pending' | 'active' | 'closed'>('active');
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [proposalValue, setProposalValue] = useState('0');
  const [notes, setNotes] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => conversations.filter((item) => {
    const matchesTab = tab === 'pending' ? item.status === 'pending' : tab === 'closed' ? item.status === 'closed' : ['open', 'waiting_customer', 'waiting_agent'].includes(item.status);
    return matchesTab && item.name.toLowerCase().includes(query.toLowerCase());
  }), [conversations, tab, query]);

  const active = conversations.find((item) => item.id === activeId) ?? filtered[0] ?? conversations[0];
  const activeConversationId = active?.id;
  const activeMessages = messages.filter((message) => message.conversationId === activeConversationId);
  const contact = contacts.find((item) => item.id === active?.contactId);

  useEffect(() => {
    if (activeConversationId && activeConversationId !== activeId) setActiveId(activeConversationId);
  }, [activeConversationId, activeId]);

  useEffect(() => {
    if (!activeConversationId) return;
    void loadConversation(activeConversationId).catch((error) => notify(error instanceof Error ? error.message : 'Não foi possível carregar a conversa.', 'danger'));
  }, [activeConversationId, loadConversation, notify]);

  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (!chatBody || !activeConversationId) return;
    const scrollToLastMessage = () => chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: 'auto' });
    const frame = window.requestAnimationFrame(scrollToLastMessage);
    const mediaLayoutCheck = window.setTimeout(scrollToLastMessage, 500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(mediaLayoutCheck);
    };
  }, [activeConversationId, activeMessages.length]);

  useEffect(() => {
    setMenuOpen(false);
    setTagName('');
    setProposalValue(String(contact?.value ?? 0));
    setNotes(contact?.notes ?? '');
  }, [contact?.id, contact?.value, contact?.notes]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !active) return;
    setSending(true);
    try {
      await sendMessage(active.id, text.trim());
      setText('');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.', 'danger');
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!active) return;
    try {
      await closeConversation(active.id);
      setMenuOpen(false);
      notify('Conversa encerrada no banco.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível encerrar a conversa.', 'danger');
    }
  };

  const changeStage = async (pipelineStageId: string) => {
    if (!active) return;
    try {
      await updateContactStage(active.contactId, pipelineStageId || null);
      notify('Etapa do funil atualizada.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível atualizar a etapa.', 'danger');
    }
  };

  const waitForCustomer = async () => {
    if (!active) return;
    try {
      await setConversationStatus(active.id, 'waiting_customer');
      setMenuOpen(false);
      notify('Conversa marcada como aguardando cliente.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível alterar o status.', 'danger');
    }
  };

  const reopen = async () => {
    if (!active) return;
    try {
      await setConversationStatus(active.id, 'open');
      setMenuOpen(false);
      notify('Conversa reaberta.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível reabrir a conversa.', 'danger');
    }
  };

  const submitLabel = async (event: FormEvent) => {
    event.preventDefault();
    if (!contact || !tagName.trim()) return;
    setAddingTag(true);
    try {
      await addContactLabel(contact.id, tagName);
      setTagName('');
      notify('Etiqueta atribuída ao contato.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível atribuir a etiqueta.', 'danger');
    } finally {
      setAddingTag(false);
    }
  };

  const saveDetails = async () => {
    if (!contact) return;
    const value = parseProposalValue(proposalValue);
    if (!Number.isFinite(value) || value < 0) {
      notify('Informe um valor de proposta válido.', 'danger');
      return;
    }
    setSavingDetails(true);
    try {
      await updateContactDetails(contact.id, { value, notes });
      notify('Valor da proposta e observação salvos.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível salvar os dados do contato.', 'danger');
    } finally {
      setSavingDetails(false);
    }
  };

  const copyPhone = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.phone);
      setMenuOpen(false);
      notify('Telefone copiado.');
    } catch {
      notify('Não foi possível copiar o telefone.', 'danger');
    }
  };

  return (
    <RoleGuard allowed={['institution_admin', 'operator']}>
      <PageHeader title="Atendimentos" subtitle="Conversas e mensagens carregadas da API da sua operação." actions={<Button variant="secondary" disabled><UserRoundCog size={17} /> Distribuir conversas</Button>} />
      <div className="chat-layout">
        <Card className="conversation-panel">
          <div className="conversation-tabs">
            <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Pendente <span>{conversations.filter((item) => item.status === 'pending').length}</span></button>
            <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Ativo <span>{conversations.filter((item) => ['open', 'waiting_customer', 'waiting_agent'].includes(item.status)).length}</span></button>
            <button className={tab === 'closed' ? 'active' : ''} onClick={() => setTab('closed')}>Fechado <span>{conversations.filter((item) => item.status === 'closed').length}</span></button>
          </div>
          <div className="panel-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversa..." /></div>
          <div className="conversation-list">
            {filtered.map((item) => <button key={item.id} className={active?.id === item.id ? 'active' : ''} onClick={() => setActiveId(item.id)}><Avatar name={item.name} /><div><div><strong>{item.name}</strong><time>{item.time}</time></div><p>{item.preview}</p><small>{item.owner}</small></div>{item.unread > 0 && <span className="unread">{item.unread}</span>}</button>)}
          </div>
        </Card>

        <Card className="chat-panel">
          {active ? <>
            <div className="chat-header"><div className="chat-person"><Avatar name={active.name} /><div><strong>{active.name}</strong><span>{active.phone}</span></div></div><div className="chat-header-actions"><select value={active.stageId ?? ''} onChange={(event) => void changeStage(event.target.value)}><option value="">Sem etapa</option>{pipelineStages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Badge tone={active.status === 'closed' ? 'gray' : active.status === 'pending' ? 'orange' : 'green'}>{statusLabel[active.status]}</Badge><button type="button" className="icon-button" aria-label="Fechar conversa" title="Fechar conversa" onClick={() => void close()} disabled={active.status === 'closed'}><CheckCircle2 size={18} /></button><div className="conversation-menu-wrap"><button type="button" className="icon-button" aria-label="Mais opções" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><MoreVertical size={18} /></button>{menuOpen && <div className="conversation-menu" role="menu"><button type="button" role="menuitem" onClick={() => void waitForCustomer()} disabled={active.status === 'closed'}><Clock3 size={16} />Aguardar cliente</button><button type="button" role="menuitem" onClick={() => void copyPhone()}><Copy size={16} />Copiar telefone</button>{active.status === 'closed' ? <button type="button" role="menuitem" onClick={() => void reopen()}><RotateCcw size={16} />Reabrir conversa</button> : <button type="button" role="menuitem" className="danger" onClick={() => void close()}><CheckCircle2 size={16} />Fechar conversa</button>}</div>}</div></div></div>
            <div ref={chatBodyRef} className="chat-body"><div className="chat-day">Histórico</div>{activeMessages.length ? activeMessages.map((message) => <div key={message.id} className={`message-row ${message.direction}`}><div className="message-bubble"><MessageContent message={message} /><small>{message.time} {message.direction === 'out' ? '✓✓' : ''}</small></div></div>) : <div className="empty-chat">Nenhuma mensagem carregada nesta conversa.</div>}</div>
            <form className="chat-composer" onSubmit={send}><button type="button" disabled><Smile size={20} /></button><button type="button" disabled><Paperclip size={20} /></button><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Digite sua mensagem..." disabled={active.status === 'closed' || sending} /><button className="send-button" type="submit" disabled={active.status === 'closed' || sending}><Send size={19} /></button></form>
          </> : <div className="empty-chat">Nenhuma conversa disponível neste filtro.</div>}
        </Card>

        <Card className="contact-panel">
          {active && contact ? <>
            <div className="contact-summary"><Avatar name={active.name} size="lg" /><div><h3>{active.name}</h3><p>{active.phone}</p><button type="button">Ver contato completo</button></div></div>
            <section><div className="section-title"><h4>Etiquetas</h4></div><div className="tag-wrap">{active.tags.length ? active.tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>) : <span className="panel-empty">Nenhuma etiqueta.</span>}</div><form className="tag-form" onSubmit={submitLabel}><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Nova etiqueta" maxLength={40} disabled={addingTag} /><button type="submit" aria-label="Adicionar etiqueta" disabled={addingTag || !tagName.trim()}><Plus size={16} /></button></form></section>
            <section><div className="section-title"><h4>Funil e proposta</h4></div><div className="info-row"><span>Etapa atual</span><strong>{active.stage}</strong></div><label className="contact-field"><span>Valor da proposta</span><div className="currency-input"><span>R$</span><input type="number" min="0" step="0.01" inputMode="decimal" value={proposalValue} onChange={(event) => setProposalValue(event.target.value)} /></div></label><label className="contact-field"><span>Observação</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anotações internas sobre esta proposta..." maxLength={5000} rows={4} /></label><button type="button" className="contact-save" onClick={() => void saveDetails()} disabled={savingDetails}><Save size={15} />{savingDetails ? 'Salvando...' : 'Salvar proposta'}</button></section>
            <section><div className="section-title"><h4>Responsável</h4></div><div className="owner-line"><Avatar name={active.owner} size="sm" /><div><strong>{active.owner}</strong><span>Atendimento</span></div></div></section>
            <section><div className="section-title"><h4>Ações rápidas</h4></div><div className="quick-actions"><button type="button" onClick={() => void waitForCustomer()} disabled={active.status === 'closed'}><Clock3 size={18} />Aguardar cliente</button><button type="button" onClick={() => void close()} disabled={active.status === 'closed'}><CheckCircle2 size={18} />Fechar conversa</button></div></section>
          </> : null}
        </Card>
      </div>
    </RoleGuard>
  );
}
