import type { MetadataRoute } from "next";
import { NOINDEX, SITE_URL } from "@/lib/site";

// ТЗ 7.5: админка, API и служебные пути закрыты от индексации; демо-стенд можно закрыть целиком (SITE_NOINDEX=1).
export default function robots(): MetadataRoute.Robots {
  if (NOINDEX) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/*/search", "/*/assistant"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
