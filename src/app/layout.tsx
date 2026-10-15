import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/outfit";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar de Inovação",
  description: "Sinais de No Alcohol e IA escolhidos pela equipa de Inovação da Sogrape.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // No iPhone: "Adicionar ao ecrã principal" abre como app, sem a barra do Safari
  appleWebApp: { capable: true, title: "Radar", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FAFAFA", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
