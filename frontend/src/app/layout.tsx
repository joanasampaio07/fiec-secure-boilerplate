import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema FIEC • Portal Educacional & IA Segura",
  description: "Arquitetura Zero-Trust • LGPD by Design • ISO 27001 / NIST",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
