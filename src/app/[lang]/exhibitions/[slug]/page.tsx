import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { showcaseText } from "@/i18n/showcase";
import { getExhibition } from "@/lib/showcase";
import { Crumbs } from "@/components/CatalogParts";
import { ExhibitionView } from "@/components/ExhibitionView";
import { CopyButton } from "@/components/Viewer";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const e = await getExhibition(slug);
  if (!e) return { robots: { index: false } };
  return { title: pick(e.title, lang).text, description: pick(e.description, lang).text.slice(0, 160), robots: e.is_demo ? { index: false } : undefined };
}

export default async function Exhibition({ params }: P) {
  const { lang: l, slug } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = showcaseText(lang);
  const d = dict(lang);
  const e = await getExhibition(slug);
  if (!e) notFound();
  const title = pick(e.title, lang);
  const items = e.items.map((x) => ({
    id: x.id,
    title: pick(x.title, lang).text,
    caption: pick(x.caption, lang).text,
    source: x.source,
    href: `/${lang}/catalog/doc/${x.uid}`,
    date: x.date_text,
    file: x.file,
    mime: x.mime,
  }));
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { href: `/${lang}/exhibitions`, label: t.exTitle }, { label: title.text }]} />
      <div className="row-between" style={{ alignItems: "flex-end", marginBottom: 24 }}>
        <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="tags"><span className="tag red">{items.length} {t.exhibits}</span>{e.is_demo ? <span className="tag grey">{t.demo}</span> : null}</span>
          <h1 lang={title.fallback ? "ru" : undefined}>{title.text}</h1>
          <p className="muted" lang="ru">{pick(e.description, lang).text}</p>
        </div>
        <div className="acts-row">
          <CopyButton label={t.share} done={t.copied} icon="share" className="btn sec" />
          <Link className="btn sec" href={`/${lang}/exhibitions`}>{t.allExhibitions}</Link>
        </div>
      </div>
      <ExhibitionView items={items} t={t} />
    </div>
  );
}
