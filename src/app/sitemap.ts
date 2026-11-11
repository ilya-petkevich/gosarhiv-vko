import type { MetadataRoute } from "next";
import { q } from "@/lib/db";
import { DOC_VISIBLE, FUND_VISIBLE } from "@/lib/catalog";
import { LANGS } from "@/i18n/dict";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

// ТЗ 7.5: карта сайта со всеми языковыми версиями; только открытые опубликованные материалы.
// Демо-записи не включаются: они не должны выглядеть в поиске как настоящие архивные документы.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const alt = (path: string) => ({ languages: Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}/${l}${path}`])) });
  const entry = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}/ru${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    alternates: alt(path),
  });
  const statics = ["", "/catalog", "/catalog?tab=funds", "/exhibitions", "/chronicle", "/news", "/branches", "/services/gov", "/services/paid", "/about", "/about/calendar"];
  const pages = await q<{ slug: string; at: string }>(`select slug, updated_at::text at from pages where status = 'published'`);
  const funds = await q<{ id: number; at: string }>(`select f.id, f.updated_at::text at from funds f where ${FUND_VISIBLE} and not f.is_demo`);
  const docs = await q<{ uid: string; at: string }>(`select d.uid, d.updated_at::text at from documents d join funds f on f.id = d.fund_id where ${DOC_VISIBLE} and ${FUND_VISIBLE} and not d.is_demo`);
  const news = await q<{ slug: string; at: string }>(`select slug, published_at::text at from news where status = 'published' and not is_demo`);
  const ex = await q<{ slug: string; at: string }>(`select slug, updated_at::text at from exhibitions where status = 'published' and not is_demo`);
  const cols = await q<{ slug: string; at: string }>(`select slug, updated_at::text at from collections where status = 'published' and not is_demo`);
  return [
    ...statics.map((p) => entry(p)),
    ...pages.map((p) => entry(`/about/${p.slug}`, p.at)),
    ...funds.map((f) => entry(`/catalog/fund/${f.id}`, f.at)),
    ...docs.map((d) => entry(`/catalog/doc/${d.uid}`, d.at)),
    ...news.map((n) => entry(`/news/${n.slug}`, n.at)),
    ...ex.map((e) => entry(`/exhibitions/${e.slug}`, e.at)),
    ...cols.map((c) => entry(`/chronicle/${c.slug}`, c.at)),
  ];
}
