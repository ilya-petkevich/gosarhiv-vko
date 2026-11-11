import Link from "next/link";
import { dict, isLang, pick, type Lang, type L10n } from "@/i18n/dict";
import { q } from "@/lib/db";
import { Icon, type IconName } from "@/components/Icon";
import { Kniga } from "@/components/Kniga";
import { VoiceButton } from "@/components/VoiceButton";
import { notFound } from "next/navigation";

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

  const tiles: [IconName, string, string][] = [
    ["folder", d.tiles.funds, "catalog?tab=funds"],
    ["user", d.tiles.personal, "catalog?tab=funds&kind=personal"],
    ["book", d.tiles.metric, "catalog?doc_type=metric_book"],
    ["image", d.tiles.media, "catalog?doc_type=photo"],
    ["history", d.tiles.chronicle, "chronicle"],
    ["film", d.tiles.exhibitions, "exhibitions"],
    ["lamp", d.tiles.reading, "about/reading-room"],
    ["doc", d.tiles.gov, "services/gov"],
    ["receipt", d.tiles.paid, "services/paid"],
    ["scale", d.tiles.laws, "about/laws"],
  ];
  const quickIcons: IconName[] = ["doc", "pin", "calendar"];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
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
              <Kniga size={180} title="Ахмет" />
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
            <Link className="btn" href={L("services/gov")}>{d.certSteps}</Link>
            <a className="btn sec" href="https://egov.kz" rel="noopener" target="_blank">
              <Icon name="globe" size={20} /> {d.toEgov}
              <span className="sr"> ({d.externalSite})</span>
            </a>
          </div>
        </div>
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
    </>
  );
}
