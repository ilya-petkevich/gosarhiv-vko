import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { getFund } from "@/lib/catalog";
import { Crumbs, DocRow } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ lang: string; id: string }> };
const parseId = (s: string) => (/^\d{1,9}$/.test(s) ? Number(s) : null);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return {};
  const n = parseId(id);
  const r = n ? await getFund(n) : null;
  if (!r) return { robots: { index: false } };
  const t = dict(lang).cat;
  return {
    title: `${t.fund} ${r.fund.fund_number}`,
    description: pick(r.fund.title, lang).text.slice(0, 160),
    robots: r.fund.is_demo ? { index: false, follow: true } : undefined,
  };
}

export default async function FundPage({ params }: P) {
  const { lang: l, id } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = dict(lang).cat;
  const n = parseId(id);
  const r = n ? await getFund(n) : null;
  if (!r) notFound();
  const { fund, inventories, docs } = r;
  const title = pick(fund.title, lang);
  const base = `/${lang}/catalog`;

  const meta: [string, string][] = [
    [t.fund, fund.fund_number],
    [t.fundYears, fund.year_from ? `${fund.year_from}–${fund.year_to ?? ""}` : "—"],
    [t.fundUnits, fund.units_text ?? "—"],
    ...(fund.first_received ? [[t.fundReceived, new Date(fund.first_received).toLocaleDateString(lang === "en" ? "en-GB" : lang === "kk" ? "kk-KZ" : "ru-RU")] as [string, string]] : []),
    ...(fund.ownership ? [[t.fundOwnership, fund.ownership] as [string, string]] : []),
    ...(fund.branch_name ? [[t.fields.storage, pick(fund.branch_name, lang).text] as [string, string]] : []),
    ...(fund.source ? [[t.fundSource, fund.source] as [string, string]] : []),
  ];

  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: t.home }, { href: `${base}?tab=funds`, label: t.title }, { label: `${t.fund} ${fund.fund_number}` }]} />
      <div className="doc" style={{ gridTemplateColumns: "1fr" }}>
        <div className="doc-info">
          <div className="tags">
            <span className="tag">{fund.kind === "personal" ? t.fundKindPersonal : t.fundKindOrg}</span>
            {fund.is_demo ? <span className="tag red">{t.demoRecord}</span> : null}
          </div>
          <h1 lang={title.fallback ? "ru" : undefined} style={{ maxWidth: 1000 }}>
            <span className="muted" style={{ fontWeight: 600 }}>{t.fund} {fund.fund_number} — </span>{title.text}
          </h1>
          {fund.annotation ? <p>{pick(fund.annotation, lang).text}</p> : null}
          <dl className="card meta" style={{ maxWidth: 1000 }}>
            {meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>

          {fund.names.length > 1 ? (
            <section aria-labelledby="nm">
              <h2 id="nm" className="h3" style={{ marginBottom: 12 }}>{t.fundNames}</h2>
              <ul className="card names" style={{ padding: "4px 24px", maxWidth: 1000 }}>
                {fund.names.map((x, i) => (
                  <li key={i}><span className="dt">{x.dates ?? "—"}</span><span lang="ru">{x.name}</span></li>
                ))}
              </ul>
            </section>
          ) : null}

          {inventories.length ? (
            <section aria-labelledby="inv">
              <h2 id="inv" className="h3" style={{ marginBottom: 12 }}>{t.inventories}</h2>
              <ul className="card names" style={{ padding: "4px 24px", maxWidth: 1000 }}>
                {inventories.map((x) => (
                  <li key={x.id}><span className="dt">№ {x.number}</span><span>{pick(x.title, lang).text} · {x.docs}</span></li>
                ))}
              </ul>
            </section>
          ) : null}

          {docs.total ? (
            <section aria-labelledby="dc" className="results">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <h2 id="dc" className="h3">{t.docsInFund}: {docs.total}</h2>
                {docs.total > docs.rows.length ? <Link className="more" href={`${base}?fund=${encodeURIComponent(fund.fund_number)}`}>{t.found(docs.total)} <Icon name="arrow" size={20} /></Link> : null}
              </div>
              {docs.rows.map((x) => <DocRow key={x.uid} d={x} lang={lang} />)}
            </section>
          ) : (
            <p className="notice" style={{ maxWidth: 1000 }}><Icon name="help" size={20} /> {t.fundNoDocs}</p>
          )}
        </div>
      </div>
    </div>
  );
}
