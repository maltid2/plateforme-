import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SentinelScope — Audit de sécurité web",
    short_name: "SentinelScope",
    description:
      "Audit de sécurité web réel : score clair, vulnérabilités détectées et actions à mener.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#7C5CFF",
    lang: "fr",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
