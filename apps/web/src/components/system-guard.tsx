'use client';

import { ShieldAlert } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Card } from './ui';

export function SystemGuard({ children }: { children: React.ReactNode }) {
  const { session } = useCrm();
  if (session?.role !== 'system_admin') {
    return <Card className="access-denied"><ShieldAlert size={34} /><h2>Acesso não autorizado</h2><p>Esta área é exclusiva do administrador do sistema.</p></Card>;
  }
  return <>{children}</>;
}
