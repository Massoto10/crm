'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { RoleGuard } from '@/components/role-guard';
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui';

type AuditLog = {
  id: string;
  action: string;
  method: string;
  route: string;
  statusCode: number;
  metadata: { fields?: string[] };
  createdAt: string;
  actor?: { id: string; name: string; email: string; role: 'admin' | 'agent' } | null;
};

type AuditResponse = { data: AuditLog[]; nextCursor: string | null };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function actionLabel(action: string) {
  return action.replace(/^([a-z]+)\./, (_, method: string) => `${method.toUpperCase()} · `).replaceAll('.', ' / ');
}

function statusTone(statusCode: number): 'green' | 'orange' | 'red' {
  if (statusCode < 400) return 'green';
  if (statusCode < 500) return 'orange';
  return 'red';
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (cursor) query.set('cursor', cursor);
      const result = await apiFetch<AuditResponse>(`/audit-logs?${query.toString()}`);
      setLogs((current) => append ? [...current, ...result.data] : result.data);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar a auditoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RoleGuard allowed={['institution_admin']}>
      <PageHeader
        title="Auditoria"
        subtitle="Ações de escrita realizadas na instituição. Conteúdo de mensagens, senhas e tokens não é registrado."
        actions={<Button variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Atualizar</Button>}
      />
      <Card>
        <div className="table-toolbar">
          <div>
            <h2>Histórico operacional</h2>
            <p>{loading ? 'Atualizando registros...' : `${logs.length} registro(s) carregado(s)`}</p>
          </div>
        </div>
        {error ? (
          <EmptyState title="Não foi possível carregar" description={error} />
        ) : logs.length === 0 && !loading ? (
          <EmptyState title="Nenhuma ação registrada ainda" description="As próximas alterações feitas pela equipe aparecerão aqui." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Data e hora</th><th>Responsável</th><th>Ação</th><th>Resultado</th><th>Campos alterados</th></tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td><strong>{log.actor?.name ?? 'Sistema'}</strong><br /><small>{log.actor?.role === 'admin' ? 'Administrador' : log.actor ? 'Operador' : 'Sem sessão'}</small></td>
                    <td><strong>{actionLabel(log.action)}</strong><br /><small>{log.route}</small></td>
                    <td><Badge tone={statusTone(log.statusCode)}>{log.statusCode}</Badge></td>
                    <td>{log.metadata.fields?.length ? log.metadata.fields.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor ? <div className="table-footer"><span>Há registros mais antigos.</span><Button variant="secondary" onClick={() => void load(nextCursor, true)} disabled={loading}><ClipboardList size={16} /> Carregar mais</Button></div> : null}
      </Card>
    </RoleGuard>
  );
}
