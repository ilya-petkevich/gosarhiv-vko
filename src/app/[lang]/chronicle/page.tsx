import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { showcaseText } from "@/i18n/showcase";
import { PERIODS, eventThemes, listCollections, listEvents, listPersons } from "@/lib/showcase";
import { Crumbs } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = showcaseText(lang);
  return { title: t.chTitle, description: t.chLead };
}

export default async function Chronicle({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ p?: string; th?: string }> }) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = showcaseText(lang);
  const d = dict(lang);
  const { p, th } = await searchParams;
  const period = PERIODS.some((x) => x.key === p) ? p : undefined;
  const [cols, events, themes, persons] = await Promise.all([listCollections(), listEvents(period, th), eventThemes(), listPersons()]);
  const theme = themes.some((x) => x.slug === th) ? th : undefined;
  const href = (o: { p?: string; th?: string }) => {
    const u = new URLSearchParams();
    const pp = "p" in o ? o.p : period;
    const tt = "th" in o ? o.th : theme;
    if (pp) u.set("p", pp);
    if (tt) u.set("th", tt);
    const s = u.toString();
    return `/${lang}/chronicle${s ? `?${s}` : ""}#timeline`;
  };
  const byYear = new Map<number, typeof events>();
  for (const e of events) byYear.set(e.year, [...(byYear.get(e.year) ?? []), e]);

  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { label: t.chTitle }]} />
      <h1>{t.chTitle}</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 900 }}>{t.chLead}</p>

      {cols.length ? (
        <section className="section" style={{ marginTop: 40 }} aria-labelledby="cols">
          <h2 id="cols" style={{ marginBottom: 20 }}>{t.collections}</h2>
          <div className="sc-grid">
            {cols.map((c) => {
              const title = pick(c.title, lang);
              return (
                <Link key={c.slug} href={`/${lang}/chronicle/${c.slug}`} className="card sc-card">
                  <span className="sc-cover">
                    {c.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${c.cover}`} alt="" loading="lazy" />
                    ) : <Icon name="history" size={40} />}
                  </span>
                  <span className="sc-body">
                    <span className="tags"><span className="tag">{c.count} {t.materials}</span>{c.is_demo ? <span className="tag grey">{t.demo}</span> : null}</span>
                    <b lang={title.fallback ? "ru" : undefined}>{title.text}</b>
                    <span className="small muted" lang="ru">{pick(c.summary, lang).text}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {persons.length ? (
        <section className="section" style={{ marginTop: 48 }} aria-labelledby="pers">
          <div className="section-head">
            <h2 id="pers">{t.persons}</h2>
            <Link className="more" href={`/${lang}/chronicle/persons`}>{t.allPersons} ({persons.length}) <Icon name="arrow" size={20} /></Link>
          </div>
          <div className="person-grid" style={{ marginTop: 0 }}>
            {persons.slice(0, 4).map((p) => (
              <Link key={p.slug} href={`/${lang}/chronicle/persons/${p.slug}`} className="card person-card">
                <span className="pc-ic"><Icon name="user" size={28} /></span>
                <span><b>{pick(p.name, lang).text}</b>{p.years ? <span className="small muted">{p.years}</span> : null}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section" style={{ marginTop: 56 }} aria-labelledby="tl-h" id="timeline">
        <h2 id="tl-h" style={{ marginBottom: 8 }}>{t.timeline}</h2>
        <p className="muted small" style={{ marginBottom: 20 }}>{t.timelineLead}</p>
        <div className="tl-filters">
          <nav className="chips-row" aria-label={t.period}>
            <span className="muted small">{t.period}:</span>
            <Link className="chip" href={href({ p: undefined })} aria-current={!period ? "page" : undefined}>{t.all}</Link>
            {PERIODS.map((x) => <Link key={x.key} className="chip" href={href({ p: x.key })} aria-current={period === x.key ? "page" : undefined}>{x.label[lang]}</Link>)}
          </nav>
          <nav className="chips-row" aria-label={t.theme}>
            <span className="muted small">{t.theme}:</span>
            <Link className="chip" href={href({ th: undefined })} aria-current={!theme ? "page" : undefined}>{t.all}</Link>
            {themes.filter((x) => x.n).map((x) => <Link key={x.slug} className="chip" href={href({ th: x.slug })} aria-current={theme === x.slug ? "page" : undefined}>{pick(x.name, lang).text}</Link>)}
          </nav>
        </div>
        <p style={{ margin: "16px 0" }}><b>{t.found} {events.length}</b></p>
        {events.length ? (
          <ol className="tl" lang="ru">
            {[...byYear.entries()].map(([year, list]) => (
              <li key={year} className="tl-year">
                <span className="tl-y">{year}</span>
                <ul>
                  {list.map((e) => (
                    <li key={e.slug} className="card tl-ev">
                      <span className="small muted">{e.date_text}{e.theme_name ? <> · <span className="tag">{pick(e.theme_name, lang).text}</span></> : null}</span>
                      <span>{pick(e.title, lang).text}</span>
                      {e.sources ? <span className="small muted">{t.sourceCal}: {e.sources}</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : <p className="notice">{t.nothing}</p>}
      </section>
    </div>
  );
}
