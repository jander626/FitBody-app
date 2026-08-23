import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitFood",
    short_name: "FitFood",
    description:
      "Registro de calorías y macros por foto o por texto, con la tabla de alimentos de siempre.",
    start_url: "/hoy",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f5f2",
    theme_color: "#f6f5f2",
    lang: "es",
    categories: ["health", "fitness", "food"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Registrar comida",
        short_name: "Registrar",
        url: "/registrar",
      },
      { name: "Peso de hoy", short_name: "Peso", url: "/peso" },
    ],
  };
}
