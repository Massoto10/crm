'use client';

import { ShieldAlert } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import type { Role } from '@/lib/types';
import { Card } from './ui';

export function RoleGuard({ allowed, children }: { allowed: Role[]; children: React.ReactNode }) {
  const { session } = useCrm();
  if (!session || !allowed.includes(session.role)) {
    return (
      <Card className="access-denied">
        <ShieldAlert size={34} />
        <h2>Acesso não autorizado</h2>
        <p>Seu perfil não possui permissão para visualizar este módulo.</p>
      </Card>
    );
  }
  return <>{children}</>;
}
