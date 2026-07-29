import type { Metadata } from 'next';
import { connection } from 'next/server';
import './globals.css';
import { CrmProvider } from '@/context/crm-context';
import { ThemeController } from '@/components/theme-controller';

export const metadata: Metadata = {
  title: 'ScaleToNext CRM',
  description: 'CRM multi-tenant de atendimento por WhatsApp',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A CSP por requisição usa nonce. Forçar renderização dinâmica permite que o
  // Next aplique esse nonce aos scripts gerados em todas as rotas filhas.
  await connection();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <CrmProvider><ThemeController />{children}</CrmProvider>
      </body>
    </html>
  );
}
