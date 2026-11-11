import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { contentText } from "@/i18n/content";
import { calendarFor, calendarYears, getPage } from "@/lib/content";
import { Crumbs } from "@/components/CatalogParts";
import { Md } from "@/components/Md";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<{ y?: string }> };

const MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split(" ");
const MONTHS_NOM = "Январь Февраль Март Апрель Май Июнь Июль Август Сентябрь Октябрь Ноябрь Декабрь".split(" ");

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  if (slug === "calendar") return { title: contentText(lang).calendar };
  const p = await getPage(slug);
  return p ? { title: pick(p.title, lang).text } : { robots: { index: false } };
}

export default async function AboutPage({ params, searchParams }: P) {
  const { lang: l, slug } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = contentText(lang);
  const d = dict(lang);
  const crumbs = (title: string) => [{ href: `/${lang}`, label: d.cat.home }, { href: `/${lang}/about`, label: t.about }, { label: title }];

  if (slug === "calendar") {
    const years = await calendarYears();
    const { y } = await searchParams;
    const year = years.includes(Number(y)) ? Number(y) : years.includes(new Date().getFullYear()) ? new Date().getFullYear() : years[0];
    const rows = await calendarFor(year);
    const byMonth = new Map<number, typeof rows>();
    for (const r of rows) byMonth.set(r.month ?? 13, [...(byMonth.get(r.month ?? 13) ?? []), r]);
    return (
      <div className="wrap">
        <Crumbs items={crumbs(t.calendar)} />
        <h1>{t.calendar} — {year}</h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: 900 }}>{t.calendarLead}</p>
        <nav className="chips-row" style={{ margin: "20px 0" }}>
          {years.map((x) => <Link key={x} className="chip" href={`/${lang}/about/calendar?y=${x}`} aria-current={x === year ? "page" : undefined}>{x}</Link>)}
        </nav>
        {lang !== "ru" ? <p className="notice">{d.notVerifiedTranslation}</p> : null}
        <div className="cal" lang="ru">
          {[...byMonth.entries()].map(([m, list]) => (
            <section key={m} className="card cal-m">
              <h2 className="h3">{m === 13 ? t.yearOnly : MONTHS_NOM[m - 1]}</h2>
              <ul>
                {list.map((r, i) => (
                  <li key={i}>
                    <span className="cal-d">{r.day && r.month ? `${r.day} ${MONTHS[r.month - 1]}` : "—"}</span>
                    <span><b>{year - r.year} {t.years}</b> ({r.year}) — {pick(r.title, lang).text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>{t.source}: Календарь юбилейных и памятных дат Восточно-Казахстанской области на {year} год (материалы архива).</p>
      </div>
    );
  }

  const p = await getPage(slug);
  if (!p) notFound();
  const title = pick(p.title, lang);
  const body = pick(p.body, lang);
  return (
    <div className="wrap">
      <Crumbs items={crumbs(title.text)} />
      <article className="page-art">
        <h1 lang={title.fallback ? "ru" : undefined}>{title.text}</h1>
        {body.fallback ? <p className="notice">{d.notVerifiedTranslation}</p> : null}
        <div lang={body.fallback ? "ru" : undefined}><Md text={body.text} lang={lang} /></div>
        <p className="small muted page-src">{p.source ? `${t.source}: ${p.source}. ` : ""}{t.updated}: {p.updated_at}.</p>
      </article>
    </div>
  );
}
