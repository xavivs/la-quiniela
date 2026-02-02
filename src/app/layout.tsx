import type { Metadata } from "next";
import "./globals.css";

// Solo los 3 tamaños gratuitos de Icons8 (16, 32, 96). El navegador escala cuando hace falta.
const iconBase = "/icons/icons8-football-ball-pastel-color";

export const metadata: Metadata = {
  title: "La Quiniela",
  description: "Pronóstico Quiniela · 14 + pleno al 15",
  icons: {
    icon: [
      { url: `${iconBase}-16.png`, sizes: "16x16", type: "image/png" },
      { url: `${iconBase}-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${iconBase}-96.png`, sizes: "96x96", type: "image/png" },
    ],
    apple: `${iconBase}-96.png`, // iOS/macOS usarán el 96 escalado
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
