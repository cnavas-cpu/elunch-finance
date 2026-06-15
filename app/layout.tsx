import type { Metadata } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";

// ── Fuente display de marca eLunch (títulos, H1/H2, login) ──
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

// ── Fuente de cuerpo: datos, tablas, formularios ──
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "eLunch Finanzas",
  description: "Sistema de gestión financiera de eLunch",
  icons: {
    icon: "/brand/eLunch-isotipo-crema.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fredoka.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
