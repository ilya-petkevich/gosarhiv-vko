import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { showcaseText } from "@/i18n/showcase";
import { listExhibitions } from "@/lib/showcase";
import { Crumbs } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = showcaseText(lang);
  return { title: t.exTitle, description: t.exLead };
}

export default async function Exhibitions({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = showcaseText(lang);
  const d = dict(lang);
  const list = await listExhibitions();
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { label: t.exTitle }]} />
      <h1>{t.exTitle}</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 900 }}>{t.exLead}</p>
      <div className="sc-grid">
        {list.map((e) => {
          const title = pick(e.title, lang);
          return (
            <Link key={e.slug} href={`/${lang}/exhibitions/${e.slug}`} className="card sc-card">
              <span className="sc-cover">
                {e.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${e.cover}`} alt="" loading="lazy" />
                ) : <Icon name="film" size={40} />}
              </span>
              <span className="sc-body">
                <span className="tags"><span className="tag red">{e.count} {t.exhibits}</span>{e.is_demo ? <span className="tag grey">{t.demo}</span> : null}</span>
                <b lang={title.fallback ? "ru" : undefined}>{title.text}</b>
                <span className="small muted" lang="ru">{pick(e.description, lang).text}</span>
                <span className="more">{t.open} <Icon name="arrow" size={20} /></span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
