// Адрес сайта для sitemap.xml, canonical и Open Graph.
export const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  "http://localhost:3000"
).replace(/\/+$/, "");

// Демо-стенд можно закрыть от поисковиков целиком: SITE_NOINDEX=1
export const NOINDEX = process.env.SITE_NOINDEX === "1";
