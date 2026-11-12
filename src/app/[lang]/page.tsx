import Link from "next/link";
import { dict, isLang, pick, type Lang, type L10n } from "@/i18n/dict";
import { q } from "@/lib/db";
import { Icon, type IconName } from "@/components/Icon";
import { Kniga } from "@/components/Kniga";
import { HeroShelf } from "@/components/HeroShelf";
import { OFFICIAL } from "@/components/Chrome";
import { VoiceButton } from "@/components/VoiceButton";
import { notFound } from "next/navigation";
import { listExhibitions } from "@/lib/showcase";
import { listNews, upcomingDates } from "@/lib/content";
import { showcaseText } from "@/i18n/showcase";
import { contentText } from "@/i18n/content";

export const dynamic = "force-dynamic";

type BranchRow = { slug: string; name: L10n; address: L10n; phone: string | null; lat: number | null; lng: number | null; coords_verified: boolean };

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const d = dict(lang);
  const L = (s: string) => `/${lang}/${s}`;

  const branches = await q<BranchRow>(
    `select slug, name, address, phone, lat, lng, coords_verified from branches where is_visible order by sort limit 6`,
  );
  const total = (await q<{ n: number }>(`select count(*)::int as n from branches where is_visible`))[0]?.n ?? 0;
  const [exhibitions, news, dates] = await Promise.all([listExhibitions(), listNews({ limit: 3 }), upcomingDates(4)]);
  const st = showcaseText(lang);
  const ct = contentText(lang);
  const MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split(" ");
  const MONTHS_NOM = "январь февраль март апрель май июнь июль август сентябрь октябрь ноябрь декабрь".split(" ");
  const nowYear = new Date().getFullYear();

  const tiles: [IconName, string, string][] = [
    ["folder", d.tiles.funds, "catalog?tab=funds"],
    ["user", d.tiles.personal, "catalog?tab=funds&kind=personal"],
    ["book", d.tiles.metric, "catalog?doc_type=metric_book"],
    ["image", d.tiles.media, "catalog?doc_type=photo"],
    ["film", d.tiles.exhibitions, "exhibitions"],
    ["lamp", d.tiles.reading, "about/reading-room"],
    ["doc", d.tiles.gov, "services/gov"],
    ["receipt", d.tiles.paid, "services/paid"],
    ["scale", d.tiles.laws, "about/laws"],
    ["check", d.nav.anticorruption, "anticorruption"],
  ];
  const quickIcons: IconName[] = ["doc", "pin", "calendar"];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-fx" aria-hidden="true">
          <HeroShelf />
        </div>
        <h1 id="hero-title" className="sr">{d.orgName}</h1>
        <div className="wrap">
          <nav className="tiles" aria-label={d.helpTitle}>
            {tiles.map(([icon, title, href]) => (
              <Link key={href} className="tile" href={L(href)}>
                <span className="ib"><Icon name={icon} size={30} stroke={1.7} /></span>
                {title}
              </Link>
            ))}
          </nav>

          <div className="hero-main">
            <div className="akhmet">
              <Kniga size={140} title="Ахмет" anim="blink" />
              <div className="bubble">
                <b>{d.hello}</b>
                <br />
                {d.helloText}
              </div>
            </div>

            <div className="hero-col">
              <div className="quick">
                {d.quick.map((x, i) => (
                  <Link key={x.href} href={L(x.href)}>
                    <Icon name={quickIcons[i]} size={28} />
                    <div style={{ flex: 1 }}>
                      <b>{x.title}</b>
                      <span>{x.sub}</span>
                    </div>
                    <Icon name="right" size={22} />
                  </Link>
                ))}
              </div>

              <form className="search" role="search" action={L("search")} method="get">
                <fieldset className="tabs" style={{ border: 0 }}>
                  <legend className="sr">{d.find}</legend>
                  <label><input type="radio" name="mode" value="ask" defaultChecked /><Icon name="sparkle" size={20} /> {d.tabAsk}</label>
                  <label><input type="radio" name="mode" value="catalog" /><Icon name="search" size={20} /> {d.tabCatalog}</label>
                  <label><input type="radio" name="mode" value="advanced" /><Icon name="sliders" size={20} /> {d.tabAdvanced}</label>
                </fieldset>
                <div className="line">
                  <label htmlFor="q" className="sr">{d.find}</label>
                  <input id="q" name="q" type="search" placeholder={d.searchPlaceholder} autoComplete="off" />
                  <VoiceButton inputId="q" lang={lang} label={d.voice} />
                  <button className="btn go" type="submit">{d.find}</button>
                </div>
              </form>

              <div className="chips">
                <span className="lbl">{d.oftenSearched}</span>
                {d.chips.map((c) => (
                  <Link key={c} href={`${L("search")}?mode=catalog&q=${encodeURIComponent(c)}`}>{c}</Link>
                ))}
              </div>
              <p className="ai-note"><Icon name="help" size={18} /> {d.aiNote}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap section" style={{ marginTop: 48 }}>
        <div className="card cert">
          <span style={{ color: "var(--ochre)" }}><Icon name="help" size={48} stroke={1.6} /></span>
          <div className="txt">
            <h2 style={{ fontSize: 24 }}>{d.certTitle}</h2>
            <p>{d.certText}</p>
          </div>
          <div className="acts">
            <Link className="btn brand" href={L("services/gov")}>{d.certSteps}</Link>
            <a className="btn sec" href="https://egov.kz" rel="noopener" target="_blank">
              <Icon name="globe" size={20} /> {d.toEgov}
              <span className="sr"> ({d.externalSite})</span>
            </a>
          </div>
        </div>
      </div>

      {exhibitions.length ? (
        <section className="wrap section" aria-labelledby="ex-title">
          <div className="section-head">
            <h2 id="ex-title">{st.exTitle}</h2>
            <Link className="more" href={L("exhibitions")}>{st.allExhibitions} <Icon name="arrow" size={20} /></Link>
          </div>
          <div className="sc-grid" style={{ marginTop: 0 }}>
            {exhibitions.slice(0, 3).map((e) => {
              const title = pick(e.title, lang);
              return (
                <Link key={e.slug} href={L(`exhibitions/${e.slug}`)} className="card sc-card">
                  <span className="sc-cover">
                    {e.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${e.cover}`} alt="" loading="lazy" />
                    ) : <Icon name="film" size={40} />}
                  </span>
                  <span className="sc-body">
                    <span className="tags"><span className="tag red">{e.count} {st.exhibits}</span>{e.is_demo ? <span className="tag grey">{st.demo}</span> : null}</span>
                    <b lang={title.fallback ? "ru" : undefined}>{title.text}</b>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="wrap section home-two">
        <section aria-labelledby="news-title">
          <div className="section-head">
            <h2 id="news-title">{ct.news}</h2>
            <Link className="more" href={L("news")}>{ct.allNews} <Icon name="arrow" size={20} /></Link>
          </div>
          <div className="news-list">
            {news.rows.map((n) => {
              const title = pick(n.title, lang);
              return (
                <article key={n.slug} className="card news-card">
                  <div className="tags">
                    <time className="small muted" dateTime={n.iso}>{n.date}</time>
                    {n.category_name ? <span className="tag">{pick(n.category_name, lang).text}</span> : null}
                    {n.is_demo ? <span className="tag grey">{ct.demo}</span> : null}
                  </div>
                  <h3><Link href={L(`news/${n.slug}`)} lang={title.fallback ? "ru" : undefined}>{title.text}</Link></h3>
                </article>
              );
            })}
          </div>
        </section>
        <section aria-labelledby="dates-title">
          <div className="section-head"><h2 id="dates-title">{ct.dates}</h2></div>
          <div className="card dates-card" lang="ru">
            {dates.map((r, i) => (
              <div key={i} className="date-row">
                <span className="cal-d">{r.day && r.month ? `${r.day} ${MONTHS[r.month - 1]}` : r.month ? MONTHS_NOM[r.month - 1] : ""}</span>
                <span><b>{nowYear - r.year} {ct.years}</b> — {pick(r.title, lang).text}</span>
              </div>
            ))}
            <Link className="more" href={L("about/calendar")}>{ct.calendar} {nowYear} <Icon name="arrow" size={20} /></Link>
          </div>
        </section>
      </div>

      <section className="wrap section" aria-labelledby="br-title">
        <div className="section-head">
          <h2 id="br-title">{d.branchesTitle}</h2>
          <Link className="more" href={L("branches")}>{d.allBranches} ({total}) <Icon name="arrow" size={20} /></Link>
        </div>
        <div className="card branch-list">
          {branches.map((b) => {
            const name = pick(b.name, lang);
            return (
              <div className="branch" key={b.slug}>
                <span style={{ color: "var(--accent)" }}><Icon name="pin" /></span>
                <div className="info">
                  <b lang={name.fallback ? "ru" : undefined}>{name.text}</b>
                  <span className="small muted" lang={pick(b.address, lang).fallback ? "ru" : undefined}>{pick(b.address, lang).text}</span>
                  {b.phone ? <a className="small" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a> : null}
                </div>
                <Link className="btn sec sm" href={`${L("branches")}#${b.slug}`}>
                  <Icon name="route" size={18} /> {d.route}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="wrap section" aria-labelledby="off-title">
        <div className="section-head">
          <h2 id="off-title">{d.officialTitle}</h2>
        </div>
        <div className="off-grid">
          <Link className="card off-card sym" href={L("about/symbols")}>
            <span className="off-sym">
              <img src="/img/kz-emblem-20261112.svg" alt="" width={44} height={44} />
              <img src="/img/kz-flag-20261112.svg" alt="" width={66} height={33} />
            </span>
            <b>{d.symTitle}</b>
          </Link>
          {OFFICIAL.map((o) => (
            <a key={o.href} className="card off-card" href={o.href} rel="noopener" target="_blank">
              <span className="off-logo"><img src={o.logo} alt="" loading="lazy" /></span>
              <b>{o.name[lang]}</b>
              <span className="small muted">{o.host} ↗</span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
