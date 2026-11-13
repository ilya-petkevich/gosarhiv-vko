import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { showcaseText } from "@/i18n/showcase";
import { PERIODS, exhibitionCategories, listExhibitions } from "@/lib/showcase";
import { Crumbs } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = showcaseText(lang);
  return { title: t.exTitle, description: t.exLead };
}

export default async function Exhibitions({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ c?: string; p?: string }> }) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = showcaseText(lang);
  const d = dict(lang);
  const { c, p } = await searchParams;
  const [list, cats] = await Promise.all([listExhibitions({ category: c, period: p }), exhibitionCategories()]);
  const cat = cats.some((x) => x.slug === c) ? c : undefined;
  const per = PERIODS.some((x) => x.key === p) ? p : undefined;
  const href = (o: { c?: string; p?: string }) => {
    const u = new URLSearchParams(Object.entries({ c: cat, p: per, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return `/${lang}/exhibitions${u ? `?${u}` : ""}`;
  };
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { label: t.exTitle }]} />
      <h1>{t.exTitle}</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 900 }}>{t.exLead}</p>
      {cats.length ? (
        <nav className="chips-row" aria-label={t.theme} style={{ marginTop: 20 }}>
          <span className="label">{t.theme}:</span>
          <Link className="chip" href={href({ c: undefined })} aria-current={!cat ? "page" : undefined}>{t.all}</Link>
          {cats.map((x) => <Link key={x.slug} className="chip" href={href({ c: x.slug })} aria-current={cat === x.slug ? "page" : undefined}>{pick(x.name, lang).text}</Link>)}
        </nav>
      ) : null}
      <nav className="chips-row" aria-label={t.period} style={{ marginTop: 12 }}>
        <span className="label">{t.period}:</span>
        <Link className="chip" href={href({ p: undefined })} aria-current={!per ? "page" : undefined}>{t.all}</Link>
        {PERIODS.map((x) => <Link key={x.key} className="chip" href={href({ p: x.key })} aria-current={per === x.key ? "page" : undefined}>{x.label[lang]}</Link>)}
      </nav>
      {!list.length ? <p className="notice" style={{ marginTop: 20 }}>{t.exNothing}</p> : null}
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
