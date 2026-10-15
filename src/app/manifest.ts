import type { MetadataRoute } from "next";

/** Manifesto da app (PWA): permite pôr o Radar no ecrã principal do telemóvel. Abre no backoffice. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Radar de Inovação · Sogrape",
    short_name: "Radar",
    description: "Notícias, startups e pipeline da equipa de Inovação da Sogrape.",
    start_url: "/backoffice",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAFAFA",
    theme_color: "#FAFAFA",
    lang: "pt-PT",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
