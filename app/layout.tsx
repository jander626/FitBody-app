import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarSW } from "./registrar-sw";

export const metadata: Metadata = {
  title: "FitFood",
  description:
    "Registro de calorías y macros por foto o por texto, con la tabla de alimentos de siempre.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FitFood",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  // La app es una columna de ancho fijo: sin zoom se comporta como nativa.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
