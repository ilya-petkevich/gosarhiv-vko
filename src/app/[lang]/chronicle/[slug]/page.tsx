import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { showcaseText } from "@/i18n/showcase";
import { getCollection } from "@/lib/showcase";
import { Crumbs } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<{ view?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const c = await getCollection(slug);
  if (!c) return { robots: { index: false } };
  return { title: pick(c.title, lang).text, description: pick(c.summary, lang).text.slice(0, 160), robots: c.is_demo ? { index: false } : undefined };
}

export default async function Collection({ params, searchParams }: P) {
  const { lang: l, slug } = await params;
  const gallery = (await searchParams).view === "gallery";
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = showcaseText(lang);
  const d = dict(lang);
  const c = await getCollection(slug);
  if (!c) notFound();
  const title = pick(c.title, lang);
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { href: `/${lang}/chronicle`, label: t.chTitle }, { label: title.text }]} />
      <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="tags"><span className="tag">{c.items.length} {t.materials}</span>{c.is_demo ? <span className="tag grey">{t.demo}</span> : null}</span>
        <h1 lang={title.fallback ? "ru" : undefined}>{title.text}</h1>
        <p lang="ru">{pick(c.summary, lang).text}</p>
        {c.editorial_note ? (
          <aside className="notice" lang="ru"><Icon name="help" size={20} /> <span><b>{t.editorial}.</b> {pick(c.editorial_note, lang).text.replace(/^Пояснение редакции:\s*/, "").replace(/^./, (x) => x.toUpperCase())}</span></aside>
        ) : null}
      </div>
      <div className="section-head" style={{ margin: "32px 0 16px" }}>
        <h2 className="h3">{t.inCollection}</h2>
        <nav className="seg" aria-label={t.inCollection}>
          <Link href={`/${lang}/chronicle/${slug}`} aria-current={!gallery ? "true" : undefined}>{t.viewList}</Link>
          <Link href={`/${lang}/chronicle/${slug}?view=gallery`} aria-current={gallery ? "true" : undefined}>{t.viewGallery}</Link>
        </nav>
      </div>
      {gallery ? (
        <div className="gallery-grid" lang="ru">
          {c.items.map((it, k) =>
            it.kind === "document" ? (
              <Link key={k} href={`/${lang}/catalog/doc/${it.uid}`} className="card g-item">
                <span className="g-img">
                  {it.file ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${it.file}`} alt={pick(it.title, lang).text} loading="lazy" />
                  ) : <Icon name={it.doc_type === "video" ? "film" : "doc"} size={36} />}
                </span>
                <span className="g-cap"><b>{pick(it.title, lang).text}</b><span className="small muted">{it.date_text} · {it.cipher ?? it.source}</span></span>
              </Link>
            ) : (
              <div key={k} className="card g-item">
                <span className="g-img ev"><b>{it.year}</b></span>
                <span className="g-cap"><b>{pick(it.title, lang).text}</b>{it.source ? <span className="small muted">{it.source}</span> : null}</span>
              </div>
            ),
          )}
        </div>
      ) : (
      <ol className="col-items" lang="ru">
        {c.items.map((it, k) =>
          it.kind === "document" ? (
            <li key={k} className="card col-it">
              <span className="sc-cover sm">
                {it.file ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${it.file}`} alt="" loading="lazy" />
                ) : <Icon name={it.doc_type === "video" ? "film" : "doc"} size={30} />}
              </span>
              <span className="col-tx">
                <span className="tags"><span className="tag">{t.document}</span><span className="small muted">{it.date_text}</span></span>
                <b><Link href={`/${lang}/catalog/doc/${it.uid}`}>{pick(it.title, lang).text}</Link></b>
                {it.note ? <span>{pick(it.note, lang).text}</span> : null}
                <span className="small muted">{t.source}: {it.cipher ?? it.source}</span>
              </span>
            </li>
          ) : (
            <li key={k} className="card col-it">
              <span className="sc-cover sm ev"><b>{it.year}</b></span>
              <span className="col-tx">
                <span className="tags"><span className="tag red">{t.event}</span><span className="small muted">{it.date_text}</span></span>
                <b>{pick(it.title, lang).text}</b>
                {it.note ? <span>{pick(it.note, lang).text}</span> : null}
                {it.source ? <span className="small muted">{t.source}: {it.source}</span> : null}
              </span>
            </li>
          ),
        )}
      </ol>
      )}
      <p style={{ marginTop: 32 }}><Link className="more" href={`/${lang}/chronicle#timeline`}>{t.toTimeline} <Icon name="arrow" size={20} /></Link></p>
    </div>
  );
}
