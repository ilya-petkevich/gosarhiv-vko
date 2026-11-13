import { cleanQuery, track } from "@/lib/analytics";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { DOC_TYPES, catalogFacets, searchDocuments, searchFunds, type Filters } from "@/lib/catalog";
import { Crumbs, DocRow, Pager } from "@/components/CatalogParts";
import { Icon } from "@/components/Icon";
import { Kniga } from "@/components/Kniga";
import { FiltersBox } from "@/components/FiltersBox";
import { Md } from "@/components/Md";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const int = (v: string) => (/^\d{3,4}$/.test(v) ? Number(v) : undefined);

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang).cat;
  return { title: t.title, description: t.lead };
}

export default async function Catalog({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<SP> }) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const d = dict(lang);
  const t = d.cat;
  const sp = await searchParams;

  const tab = one(sp.tab) === "funds" ? "funds" : "docs";
  const f: Filters & { kind?: string } = {
    q: one(sp.q).slice(0, 200),
    docType: one(sp.doc_type),
    from: int(one(sp.from)),
    to: int(one(sp.to)),
    fund: one(sp.fund) || undefined,
    branch: one(sp.branch) || undefined,
    copy: one(sp.copy) === "1",
    inv: one(sp.inv).slice(0, 20) || undefined,
    caseNo: one(sp.case).slice(0, 20) || undefined,
    author: one(sp.author).slice(0, 100) || undefined,
    place: one(sp.place).slice(0, 100) || undefined,
    topic: one(sp.topic).slice(0, 40) || undefined,
    kind: one(sp.kind) === "personal" ? "personal" : undefined,
    sort: (["old", "new"].includes(one(sp.sort)) ? one(sp.sort) : "relevance") as Filters["sort"],
    page: Math.min(500, Number(one(sp.page)) || 1),
  };

  const [docs, funds, facets] = await Promise.all([
    searchDocuments(tab === "docs" ? f : { ...f, page: 1 }),
    searchFunds(tab === "funds" ? f : { ...f, page: 1 }),
    catalogFacets(),
  ]);
  // аналитика: что ищут и что не находят (без персональных данных)
  if (f.q && (f.page ?? 1) === 1) {
    const cq = cleanQuery(f.q);
    if (cq) track(docs.total + funds.total ? "search" : "search_empty", "/catalog", lang, cq);
  }
  const branchInfo = tab === "funds" && f.branch ? facets.allBranches.find((x) => x.slug === f.branch) ?? null : null;
  const parsed = docs.parsed;

  const base = `/${lang}/catalog`;
  const qs = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | undefined> = {
      q: f.q || undefined, tab: tab === "funds" ? "funds" : undefined, doc_type: f.docType || undefined,
      from: f.from?.toString(), to: f.to?.toString(), fund: f.fund, branch: f.branch, copy: f.copy ? "1" : undefined,
      inv: f.inv, case: f.caseNo, author: f.author, place: f.place, topic: f.topic,
      kind: f.kind, sort: f.sort !== "relevance" ? f.sort : undefined,
    };
    for (const [k, v] of Object.entries({ ...cur, ...over })) if (v !== undefined && v !== "") u.set(k, String(v));
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };

  const active: { label: string; href: string }[] = [];
  if (f.docType) active.push({ label: t.types[f.docType] ?? f.docType, href: qs({ doc_type: undefined, page: undefined }) });
  else if (parsed.docType && tab === "docs") active.push({ label: `${t.types[parsed.docType]} (${t.fromQuery})`, href: qs({ q: f.q?.replace(/\S*(фото|photo|сурет|снимк|карт|газет|видео|аудио)\S*/giu, "").trim(), page: undefined }) });
  if (f.from || f.to) active.push({ label: `${f.from ?? "…"}–${f.to ?? "…"}`, href: qs({ from: undefined, to: undefined, page: undefined }) });
  else if (parsed.decadeFrom) active.push({ label: `${parsed.decadeFrom}–${parsed.decadeTo} (${t.fromQuery})`, href: qs({ q: parsed.text, page: undefined }) });
  if (f.fund) active.push({ label: `${t.fund} ${f.fund}`, href: qs({ fund: undefined, page: undefined }) });
  if (f.branch) {
    const b = facets.allBranches.find((x) => x.slug === f.branch);
    active.push({ label: b ? pick(b.short_name, lang).text : f.branch, href: qs({ branch: undefined, page: undefined }) });
  }
  if (f.inv) active.push({ label: `${t.invNo}: ${f.inv}`, href: qs({ inv: undefined, page: undefined }) });
  if (f.caseNo) active.push({ label: `${t.caseNo}: ${f.caseNo}`, href: qs({ case: undefined, page: undefined }) });
  if (f.author) active.push({ label: `${t.authorOrg}: ${f.author}`, href: qs({ author: undefined, page: undefined }) });
  if (f.place) active.push({ label: `${t.placeName}: ${f.place}`, href: qs({ place: undefined, page: undefined }) });
  if (f.topic) {
    const tp = facets.topics.find((x) => x.slug === f.topic);
    active.push({ label: tp ? pick(tp.name, lang).text : f.topic, href: qs({ topic: undefined, page: undefined }) });
  }
  if (f.copy) active.push({ label: t.onlyCopy, href: qs({ copy: undefined, page: undefined }) });
  if (f.kind) active.push({ label: t.onlyPersonal, href: qs({ kind: undefined, page: undefined }) });

  const res = tab === "docs" ? docs : funds;
  const empty = res.total === 0;

  return (
    <div className="wrap catalog">
      <Crumbs items={[{ href: `/${lang}`, label: t.home }, { label: t.title }]} />
      <div className="cat-head">
        <h1>{t.title}</h1>
        <span className="tag">{t.demoTag}</span>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>{t.lead}</p>

      <form className="card cat-search" role="search" action={base} method="get">
        <Icon name="search" />
        <label htmlFor="cq" className="sr">{d.find}</label>
        <input id="cq" name="q" type="search" defaultValue={f.q} placeholder={t.placeholder} autoComplete="off" />
        {tab === "funds" ? <input type="hidden" name="tab" value="funds" /> : null}
        <Link className="btn sec ask" href={`/${lang}/assistant${f.q ? `?q=${encodeURIComponent(f.q)}` : ""}`}>
          <Icon name="sparkle" size={20} /> {t.askAssistant}
        </Link>
        <button className="btn" type="submit">{d.find}</button>
      </form>

      <nav className="cat-tabs" aria-label={t.title}>
        <Link href={qs({ tab: undefined, page: undefined, kind: undefined })} aria-current={tab === "docs" ? "page" : undefined}>
          {t.tabDocs} <span className="cnt">{docs.total}</span>
        </Link>
        <Link href={qs({ tab: "funds", page: undefined, doc_type: undefined, copy: undefined, fund: undefined, branch: undefined })} aria-current={tab === "funds" ? "page" : undefined}>
          {t.tabFunds} <span className="cnt">{funds.total}</span>
        </Link>
      </nav>

      {active.length ? (
        <div className="active-f">
          {active.map((a) => (
            <Link key={a.label} className="chip" href={a.href} aria-label={`${t.reset}: ${a.label}`}>
              {a.label} <Icon name="x" size={16} />
            </Link>
          ))}
          <Link className="small" href={tab === "funds" ? `${base}?tab=funds` : base}>{t.reset}</Link>
        </div>
      ) : null}

      <div className="cat-grid">
        <FiltersBox>
          <summary><h2 className="h3">{t.filters}</h2></summary>
          <form action={base} method="get">
            {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
            {tab === "funds" ? <input type="hidden" name="tab" value="funds" /> : null}
            {tab === "docs" ? (
              <label className="fld">
                <span className="label">{t.type}</span>
                <select name="doc_type" defaultValue={f.docType}>
                  <option value="">{t.anyType}</option>
                  {DOC_TYPES.map((x) => <option key={x} value={x}>{t.types[x]}</option>)}
                </select>
              </label>
            ) : null}
            <fieldset className="fld">
              <legend className="label">{t.period}</legend>
              <div className="row2">
                <label><span className="sr">{t.from}</span><input name="from" inputMode="numeric" pattern="\d{4}" placeholder={t.from} defaultValue={f.from} /></label>
                <span aria-hidden="true">—</span>
                <label><span className="sr">{t.to}</span><input name="to" inputMode="numeric" pattern="\d{4}" placeholder={t.to} defaultValue={f.to} /></label>
              </div>
            </fieldset>
            {tab === "docs" ? (
              <>
                <label className="fld">
                  <span className="label">{t.fund}</span>
                  <select name="fund" defaultValue={f.fund}>
                    <option value="">{t.anyFund}</option>
                    {facets.funds.map((x) => <option key={x.fund_number} value={x.fund_number}>{x.fund_number}</option>)}
                  </select>
                </label>
                <label className="fld">
                  <span className="label">{t.branch}</span>
                  <select name="branch" defaultValue={f.branch}>
                    <option value="">{t.anyBranch}</option>
                    {facets.branches.map((x) => <option key={x.slug} value={x.slug}>{pick(x.short_name, lang).text}</option>)}
                  </select>
                </label>
                {facets.topics.length ? (
                  <label className="fld">
                    <span className="label">{t.topic}</span>
                    <select name="topic" defaultValue={f.topic}>
                      <option value="">{t.anyTopic}</option>
                      {facets.topics.map((x) => <option key={x.slug} value={x.slug}>{pick(x.name, lang).text}</option>)}
                    </select>
                  </label>
                ) : null}
                <div className="row2">
                  <label className="fld"><span className="label">{t.invNo}</span><input name="inv" defaultValue={f.inv} maxLength={20} /></label>
                  <label className="fld"><span className="label">{t.caseNo}</span><input name="case" defaultValue={f.caseNo} maxLength={20} /></label>
                </div>
                <label className="fld"><span className="label">{t.authorOrg}</span><input name="author" defaultValue={f.author} maxLength={100} /></label>
                <label className="fld"><span className="label">{t.placeName}</span><input name="place" defaultValue={f.place} maxLength={100} /></label>
                <label className="check"><input type="checkbox" name="copy" value="1" defaultChecked={f.copy} /> {t.onlyCopy}</label>
              </>
            ) : (
              <>
                <label className="fld">
                  <span className="label">{t.branch}</span>
                  <select name="branch" defaultValue={f.branch}>
                    <option value="">{t.anyBranch}</option>
                    {facets.allBranches.map((x) => <option key={x.slug} value={x.slug}>{pick(x.short_name, lang).text}</option>)}
                  </select>
                </label>
                <label className="check"><input type="checkbox" name="kind" value="personal" defaultChecked={f.kind === "personal"} /> {t.onlyPersonal}</label>
              </>
            )}
            <label className="fld">
              <span className="label">{t.sort}</span>
              <select name="sort" defaultValue={f.sort}>
                <option value="relevance">{t.sortRel}</option>
                <option value="old">{t.sortOld}</option>
                <option value="new">{t.sortNew}</option>
              </select>
            </label>
            <button className="btn" type="submit">{t.apply}</button>
          </form>
        </FiltersBox>

        <section className="results" aria-live="polite">
          <p className="found"><b>{t.found(res.total)}</b></p>
          {tab === "docs" && docs.fuzzy ? <p className="notice"><Icon name="help" size={20} /> {t.fuzzy}</p> : null}

          {empty && tab === "funds" && branchInfo ? (
            <div className="card branch-funds">
              <h2 className="h3">{pick(branchInfo.name, lang).text}</h2>
              <p className="muted">{t.branchNoList}</p>
              {branchInfo.description ? <div className="small"><Md text={pick(branchInfo.description, lang).text} lang={lang} /></div> : null}
              <div className="acts">
                <Link className="btn sec" href={`/${lang}/branches#${branchInfo.slug}`}><Icon name="pin" size={18} /> {t.branchCard}</Link>
                <Link className="btn sec" href={`${base}?tab=funds`}>{t.resetFilters}</Link>
              </div>
            </div>
          ) : empty ? (
            <div className="card nothing">
              <Kniga size={96} mood="sad" />
              <h2 className="h3">{t.nothingTitle(f.q ?? "")}</h2>
              <p className="muted">{t.nothingText}</p>
              <div className="acts">
                <Link className="btn sec" href={tab === "funds" ? `${base}?tab=funds` : base}>{t.resetFilters}</Link>
                <Link className="btn" href={`/${lang}/assistant${f.q ? `?q=${encodeURIComponent(f.q)}` : ""}`}><Icon name="sparkle" size={20} /> {t.askAssistant}</Link>
              </div>
            </div>
          ) : tab === "docs" ? (
            docs.rows.map((x) => <DocRow key={x.uid} d={x} lang={lang} />)
          ) : (
            funds.rows.map((x) => {
              const title = pick(x.title, lang);
              return (
                <article className="card rec fund-rec" key={x.id}>
                  <div className="fund-no" aria-hidden="true">{x.fund_number}</div>
                  <div className="rec-body">
                    <div className="tags">
                      <span className="tag">{x.kind === "personal" ? t.fundKindPersonal : t.fundKindOrg}</span>
                      {x.is_demo ? <span className="tag grey">{t.demoRecord}</span> : null}
                    </div>
                    <h3><Link href={`/${lang}/catalog/fund/${x.id}`} lang={title.fallback ? "ru" : undefined}><span className="sr">{t.fund} {x.fund_number} — </span>{title.text}</Link></h3>
                    <p className="small muted">
                      {x.year_from ? `${x.year_from}–${x.year_to ?? ""}` : ""}
                      {x.units_text ? ` · ${x.units_text} ${t.units}` : ""}
                      {x.names_count > 1 ? ` · ${t.namesMore(x.names_count - 1)}` : ""}
                    </p>
                  </div>
                </article>
              );
            })
          )}
          <Pager page={res.page} pages={res.pages} href={(p) => qs({ page: p > 1 ? p : undefined })} lang={lang} />
        </section>
      </div>
    </div>
  );
}
