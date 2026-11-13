// Страница исторической личности (ТЗ 5.6): сведения с источником, события хронологии и записи каталога
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { showcaseText } from "@/i18n/showcase";
import { getPerson } from "@/lib/showcase";
import { Crumbs } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const p = await getPerson(slug);
  if (!p) return { robots: { index: false } };
  return { title: pick(p.name, lang as Lang).text, description: pick(p.biography, lang as Lang).text.slice(0, 160) };
}

export default async function Person({ params }: P) {
  const { lang: l, slug } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = showcaseText(lang);
  const d = dict(lang);
  const p = await getPerson(slug);
  if (!p) notFound();
  const name = pick(p.name, lang);
  const bio = pick(p.biography, lang);
  const jsonLd = { "@context": "https://schema.org", "@type": "Person", name: pick(p.name, "ru").text, description: pick(p.biography, "ru").text };
  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { href: `/${lang}/chronicle`, label: t.chTitle }, { href: `/${lang}/chronicle/persons`, label: t.persons }, { label: name.text }]} />
      <div style={{ maxWidth: 860, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 lang={name.fallback ? "ru" : undefined}>{name.text}</h1>
        {p.years ? <span className="tags"><span className="tag">{p.years}</span></span> : null}
        <p lang={bio.fallback ? "ru" : undefined} style={{ fontSize: 18 }}>{bio.text}</p>
        {p.sources ? <p className="small muted" lang="ru">{t.source}: {p.sources}</p> : null}
      </div>

      {p.events.length ? (
        <section className="section" aria-labelledby="pe" style={{ marginTop: 32 }}>
          <h2 id="pe" className="h3" style={{ marginBottom: 16 }}>{t.personEvents}</h2>
          <ol className="col-items" lang="ru">
            {p.events.map((e) => (
              <li key={e.slug} className="card col-it">
                <span className="sc-cover sm ev"><b>{e.year}</b></span>
                <span className="col-tx">
                  <span className="tags"><span className="small muted">{e.date_text}</span></span>
                  <b>{pick(e.title, lang).text}</b>
                  {e.sources ? <span className="small muted">{t.source}: {e.sources}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="section" aria-labelledby="pd" style={{ marginTop: 32 }}>
        <h2 id="pd" className="h3" style={{ marginBottom: 16 }}>{t.personDocs}</h2>
        {p.docs.length ? (
          <ul className="col-items">
            {p.docs.map((x) => (
              <li key={x.uid} className="card col-it">
                <span className="col-tx">
                  <b><Link href={`/${lang}/catalog/doc/${x.uid}`}>{pick(x.title, lang).text}</Link></b>
                  <span className="small muted">{[x.date_text, x.cipher].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t.personNoDocs}</p>
        )}
      </section>

      <p style={{ marginTop: 32 }}><Link className="more" href={`/${lang}/chronicle/persons`}>{t.allPersons} <Icon name="arrow" size={20} /></Link></p>
    </div>
  );
}
