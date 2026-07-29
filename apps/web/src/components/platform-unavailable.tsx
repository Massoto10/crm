'use client';

import { DatabaseZap } from 'lucide-react';
import { SystemGuard } from './system-guard';
import { Card, PageHeader } from './ui';

export function PlatformUnavailable({ title }: { title: string }) {
  return (
    <SystemGuard>
      <PageHeader title={title} subtitle="Administração global da plataforma." />
      <Card className="access-denied">
        <DatabaseZap size={34} />
        <h2>Módulo global ainda não foi provisionado</h2>
        <p>A API atual isola cada instituição e não expõe gestão global de planos, tenants ou superadministradores. Nenhum dado fictício é exibido nesta área.</p>
      </Card>
    </SystemGuard>
  );
}
