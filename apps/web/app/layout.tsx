import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STN CRM",
  description: "CRM de atendimento para WhatsApp e Instagram"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
