// Исторические личности (ТЗ 5.6): список
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { showcaseText } from "@/i18n/showcase";
import { listPersons } from "@/lib/showcase";
import { Crumbs } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = showcaseText(lang as Lang);
  return { title: t.persons, description: t.personsLead.slice(0, 160) };
}

export default async function Persons({ params }: P) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = showcaseText(lang);
  const d = dict(lang);
  const persons = await listPersons();
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { href: `/${lang}/chronicle`, label: t.chTitle }, { label: t.persons }]} />
      <h1>{t.persons}</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 860 }}>{t.personsLead}</p>
      <div className="person-grid">
        {persons.map((p) => {
          const name = pick(p.name, lang);
          return (
            <Link key={p.slug} href={`/${lang}/chronicle/persons/${p.slug}`} className="card person-card">
              <span className="pc-ic"><Icon name="user" size={28} /></span>
              <span>
                <b lang={name.fallback ? "ru" : undefined}>{name.text}</b>
                {p.years ? <span className="small muted">{p.years}</span> : null}
                <span className="small" lang={pick(p.biography, lang).fallback ? "ru" : undefined}>{pick(p.biography, lang).text}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
