import type { Metadata, Viewport } from "next";
import "./globals.css";
import { COLOR_BARRA, GUION_TEMA } from "@/lib/tema";
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
  // El punto de partida, para cuando el tema está en automático. Al elegir
  // claro u oscuro a mano, `aplicarTema` reescribe estas etiquetas: la barra
  // de estado no lee variables CSS y hay que decírselo.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: COLOR_BARRA.claro },
    { media: "(prefers-color-scheme: dark)", color: COLOR_BARRA.oscuro },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        {/*
          Antes de pintar nada. Si esto corriera después, abrir la app de noche
          con el tema en oscuro daría un destello blanco de pantalla completa
          — el llamado "flash of unstyled theme". Por eso va inline y sin
          defer, aunque un script en el head sea lo que uno normalmente evita.
        */}
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="min-h-full">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
