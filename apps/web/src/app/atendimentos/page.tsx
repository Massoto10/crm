'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Copy, Download, FileText, Mic, MoreVertical, Paperclip, Plus, RotateCcw, Save, Search, Send, Smile, Square, UserRoundCog, X } from 'lucide-react';
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

// Lista curta em vez de biblioteca de emoji: qualquer pacote traz alguns MB e a
// CSP nao permite carregar sprite de fora. Cobre o que se usa em atendimento.
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😉', '😊', '😍', '😘',
  '🤔', '😐', '😴', '😢', '😡', '👍', '👎', '👏',
  '🙏', '💪', '👋', '✅', '❌', '⚠️', '❤️', '🔥',
  '🎉', '💰', '📅', '📎', '📞', '📍', '⏰', '✨',
];

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
    sendMedia,
    sendAudio,
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
  const abaAjustadaRef = useRef(false);

  // Anexo: o arquivo escolhido espera numa previa ate o operador confirmar,
  // porque enviar imagem sem chance de revisar ou legendar e caminho de erro.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [anexo, setAnexo] = useState<File | null>(null);
  const [anexoLegenda, setAnexoLegenda] = useState('');
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);

  // Gravacao de voz. `intencaoRef` existe porque MediaRecorder.onstop e um so
  // para tres saidas diferentes — parar, enviar e cancelar — e o handler precisa
  // saber qual delas pediu a parada. Ref e nao estado: o onstop le o valor no
  // momento em que dispara, e um estado daria a leitura antiga do closure.
  const [gravando, setGravando] = useState(false);
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  const [audioPendente, setAudioPendente] = useState<{ blob: Blob; mimetype: string; url: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const intencaoRef = useRef<'guardar' | 'enviar' | 'cancelar'>('guardar');

  const [emojiAberto, setEmojiAberto] = useState(false);

  // Mensagem nova de cliente entra como `pending`, mas a aba padrao e "Ativo":
  // a conversa recem-chegada cai numa aba que o operador nao esta olhando, e o
  // efeito pratico e o mesmo de nao ter recebido nada. Na primeira carga, se ha
  // pendente, abre nela. Uma vez so — depois disso a aba e escolha do operador.
  useEffect(() => {
    if (abaAjustadaRef.current || conversations.length === 0) return;
    abaAjustadaRef.current = true;
    if (conversations.some((item) => item.status === 'pending')) setTab('pending');
  }, [conversations]);

  // URL de objeto precisa ser criada uma vez e revogada: criar dentro do JSX
  // gera uma nova a cada render e vaza todas as anteriores.
  const anexoPreviaUrl = useMemo(
    () => (anexo && anexo.type.startsWith('image/') ? URL.createObjectURL(anexo) : null),
    [anexo],
  );
  useEffect(() => {
    if (!anexoPreviaUrl) return;
    return () => URL.revokeObjectURL(anexoPreviaUrl);
  }, [anexoPreviaUrl]);

  // Sair da tela com audio gravado e sem enviar tambem tem que liberar o blob.
  useEffect(() => () => {
    if (audioPendente) URL.revokeObjectURL(audioPendente.url);
  }, [audioPendente]);

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
    if (!active) return;

    // Gravando, o botao de enviar encerra a gravacao e manda o audio direto —
    // sem obrigar a parar antes. O envio de fato acontece no onstop.
    if (gravando) {
      intencaoRef.current = 'enviar';
      recorderRef.current?.stop();
      return;
    }
    if (audioPendente) {
      await enviarAudioPendente();
      return;
    }

    if (!text.trim()) return;
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

  const escolherArquivo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    // Reseta o input: sem isto, escolher o MESMO arquivo duas vezes seguidas
    // nao dispara change e o anexo parece nao funcionar.
    event.target.value = '';
    if (!arquivo) return;
    // A API limita o base64 em 15 MB, e base64 infla ~33%. Barra antes de subir
    // para o operador receber um aviso claro em vez de um 400 genérico.
    if (arquivo.size > 10 * 1024 * 1024) {
      notify('Arquivo maior que 10 MB. Envie um menor.', 'danger');
      return;
    }
    setAnexo(arquivo);
    setAnexoLegenda('');
  };

  const enviarAnexo = async () => {
    if (!anexo || !active) return;
    setEnviandoAnexo(true);
    try {
      await sendMedia(active.id, anexo, anexoLegenda);
      setAnexo(null);
      setAnexoLegenda('');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível enviar o anexo.', 'danger');
    } finally {
      setEnviandoAnexo(false);
    }
  };

  const despacharAudio = async (blob: Blob, mimetype: string) => {
    if (!active) return;
    setEnviandoAudio(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o áudio'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      await sendAudio(active.id, base64, mimetype || 'audio/webm');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível enviar o áudio.', 'danger');
    } finally {
      setEnviandoAudio(false);
    }
  };

  const iniciarGravacao = async () => {
    if (!active) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      intencaoRef.current = 'guardar';

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        // Libera o microfone: sem isto o indicador de gravacao fica aceso no
        // navegador mesmo depois de terminar.
        stream.getTracks().forEach((track) => track.stop());
        setGravando(false);

        const intencao = intencaoRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        if (intencao === 'cancelar' || blob.size === 0) return;

        const mimetype = recorder.mimeType || 'audio/webm';
        if (intencao === 'enviar') {
          await despacharAudio(blob, mimetype);
          return;
        }
        // 'guardar': fica em espera para o operador ouvir, enviar ou descartar.
        setAudioPendente({ blob, mimetype, url: URL.createObjectURL(blob) });
      };

      recorder.start();
      recorderRef.current = recorder;
      setGravando(true);
    } catch {
      // Permissao negada ou navegador sem suporte.
      notify('Não foi possível acessar o microfone. Verifique a permissão do navegador.', 'danger');
    }
  };

  /** Quadrado vermelho: para e segura o audio, sem enviar. */
  const pararGravacao = () => {
    intencaoRef.current = 'guardar';
    recorderRef.current?.stop();
  };

  /** X durante a gravacao, ou descartar o audio ja gravado. */
  const cancelarAudio = () => {
    if (gravando) {
      intencaoRef.current = 'cancelar';
      recorderRef.current?.stop();
      return;
    }
    if (audioPendente) {
      URL.revokeObjectURL(audioPendente.url);
      setAudioPendente(null);
    }
  };

  const enviarAudioPendente = async () => {
    if (!audioPendente) return;
    const { blob, mimetype, url } = audioPendente;
    URL.revokeObjectURL(url);
    setAudioPendente(null);
    await despacharAudio(blob, mimetype);
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
            {anexo && (
              <div className="anexo-previa">
                <div className="anexo-previa-arquivo">
                  {anexoPreviaUrl
                    ? <img src={anexoPreviaUrl} alt={anexo.name} />
                    : <FileText size={28} />}
                  <div>
                    <strong>{anexo.name}</strong>
                    <span>{(anexo.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button type="button" className="icon-button" aria-label="Descartar anexo" onClick={() => { setAnexo(null); setAnexoLegenda(''); }}><X size={18} /></button>
                </div>
                <div className="anexo-previa-acoes">
                  <input value={anexoLegenda} onChange={(event) => setAnexoLegenda(event.target.value)} placeholder="Legenda (opcional)" disabled={enviandoAnexo} />
                  <Button type="button" onClick={() => void enviarAnexo()} disabled={enviandoAnexo}>{enviandoAnexo ? 'Enviando...' : 'Enviar'}</Button>
                </div>
              </div>
            )}
{audioPendente && (
              <div className="audio-previa">
                <audio controls src={audioPendente.url} />
                <button type="button" className="icon-button" aria-label="Descartar áudio" title="Descartar áudio" onClick={cancelarAudio} disabled={enviandoAudio}><X size={18} /></button>
                <Button type="button" onClick={() => void enviarAudioPendente()} disabled={enviandoAudio}>{enviandoAudio ? 'Enviando...' : 'Enviar'}</Button>
              </div>
            )}
            {emojiAberto && (
              <div className="emoji-painel" role="menu">
                {EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => { setText((value) => value + emoji); setEmojiAberto(false); }}>{emoji}</button>
                ))}
              </div>
            )}
            <form className="chat-composer" onSubmit={send}>
              <input ref={fileInputRef} type="file" hidden onChange={escolherArquivo} accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" />
              <button type="button" aria-label="Emoji" title="Emoji" onClick={() => setEmojiAberto((value) => !value)} disabled={active.status === 'closed' || sending}><Smile size={20} /></button>
              <button type="button" aria-label="Anexar arquivo" title="Anexar arquivo" onClick={() => fileInputRef.current?.click()} disabled={active.status === 'closed' || sending || enviandoAnexo}><Paperclip size={20} /></button>
              {gravando ? (
                <>
                  <button type="button" aria-label="Cancelar gravação" title="Cancelar gravação" onClick={cancelarAudio}><X size={20} /></button>
                  <button type="button" aria-label="Parar gravação" title="Parar gravação" className="gravando" onClick={pararGravacao}><Square size={18} /></button>
                </>
              ) : (
                <button type="button" aria-label="Gravar áudio" title="Gravar áudio" onClick={() => void iniciarGravacao()} disabled={active.status === 'closed' || sending || enviandoAudio || !!audioPendente}><Mic size={20} /></button>
              )}
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder={gravando ? 'Gravando... toque em enviar para mandar' : enviandoAudio ? 'Enviando áudio...' : 'Digite sua mensagem...'} disabled={active.status === 'closed' || sending || gravando || !!audioPendente} />
              <button className="send-button" type="submit" aria-label={gravando || audioPendente ? 'Enviar áudio' : 'Enviar mensagem'} disabled={active.status === 'closed' || sending || enviandoAudio}><Send size={19} /></button>
            </form>
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
