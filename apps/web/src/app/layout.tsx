import type { Metadata } from 'next';
import { connection } from 'next/server';
import './globals.css';
import { CrmProvider } from '@/context/crm-context';
import { ThemeController } from '@/components/theme-controller';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crm.scaletonext.com.br';

export const metadata: Metadata = {
  // Open Graph exige URL absoluta na imagem. `metadataBase` e o que transforma
  // o caminho relativo do opengraph-image em absoluto; sem ele o WhatsApp
  // recebe um caminho que nao sabe resolver e nao mostra card nenhum.
  metadataBase: new URL(siteUrl),
  title: 'ScaleToNext CRM',
  description: 'CRM multi-tenant de atendimento por WhatsApp',
  openGraph: {
    type: 'website',
    siteName: 'ScaleToNext CRM',
    locale: 'pt_BR',
    url: siteUrl,
    title: 'ScaleToNext CRM',
    description: 'Atendimento por WhatsApp, funil e agendamentos em um só lugar.',
  },
  // O WhatsApp lê og:*, mas Twitter/X e algumas prévias preferem estas.
  twitter: {
    card: 'summary_large_image',
    title: 'ScaleToNext CRM',
    description: 'Atendimento por WhatsApp, funil e agendamentos em um só lugar.',
  },
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
