import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sentinelscope-pied.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const legal = [
    "mentions-legales",
    "confidentialite",
    "conditions",
    "cookies",
  ].map((path) => ({
    url: `${SITE_URL}/${path}`,
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...legal,
  ];
}
