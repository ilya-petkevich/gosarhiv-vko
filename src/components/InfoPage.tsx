// Справочные страницы с собственным адресом (/faq, /privacy, /useful). Текст — в таблице pages (раздел info),
// правится в админке «Страницы» с историей версий.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { contentText } from "@/i18n/content";
import { getPage } from "@/lib/content";
import { Crumbs } from "@/components/CatalogParts";
import { Md } from "@/components/Md";

export async function infoMetadata(lang: string, slug: string): Promise<Metadata> {
  if (!isLang(lang)) return {};
  const p = await getPage(slug);
  return p ? { title: pick(p.title, lang).text } : { robots: { index: false } };
}

export async function InfoPage({ lang: l, slug }: { lang: string; slug: string }) {
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const p = await getPage(slug);
  if (!p) notFound();
  const d = dict(lang);
  const t = contentText(lang);
  const title = pick(p.title, lang);
  const body = pick(p.body, lang);
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { label: title.text }]} />
      <article className="page-art">
        <h1 lang={title.fallback ? "ru" : undefined}>{title.text}</h1>
        {body.fallback ? <p className="notice">{d.notVerifiedTranslation}</p> : null}
        <div lang={body.fallback ? "ru" : undefined}><Md text={body.text} lang={lang} /></div>
        <p className="small muted page-src">{p.source ? `${t.source}: ${p.source}. ` : ""}{t.updated}: {p.updated_at}.</p>
      </article>
    </div>
  );
}
