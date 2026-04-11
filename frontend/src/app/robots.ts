import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "*",
      disallow: ["/api/", "/_next/", "/static/", "/account/", "/auth/"],
    },
    sitemap: "https://search.octara.xyz/sitemap.xml",
  };
}
