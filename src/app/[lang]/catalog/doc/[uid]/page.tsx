import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { getDocument } from "@/lib/catalog";
import { Crumbs } from "@/components/CatalogParts";
import { CopyButton, Viewer } from "@/components/Viewer";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ lang: string; uid: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, uid } = await params;
  if (!isLang(lang)) return {};
  const r = await getDocument(uid);
  if (!r) return { robots: { index: false } };
  const title = pick(r.doc.title, lang).text;
  return {
    title,
    description: pick(r.doc.description, lang).text.slice(0, 160),
    alternates: { languages: { kk: `/kk/catalog/doc/${uid}`, ru: `/ru/catalog/doc/${uid}`, en: `/en/catalog/doc/${uid}` } },
    openGraph: { title, type: "article", images: r.openFiles[0] && r.openFiles[0].mime.startsWith("image/") ? [`/api/files/${r.openFiles[0].id}`] : undefined },
    // демо-записи не должны попадать в поисковики как настоящие архивные документы
    robots: r.doc.is_demo ? { index: false, follow: true } : undefined,
  };
}

export default async function DocPage({ params }: P) {
  const { lang: l, uid } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const d = dict(lang);
  const t = d.cat;
  const r = await getDocument(uid);
  if (!r) notFound();
  const { doc, openFiles, closedCount, related } = r;

  const title = pick(doc.title, lang);
  const desc = pick(doc.description, lang);
  const base = `/${lang}/catalog`;
  const copyState = openFiles.length ? t.copyOpen : closedCount ? t.copyClosed : t.copyNone;

  const meta: [string, React.ReactNode][] = [
    [t.fields.fund, <Link key="f" href={`${base}/fund/${doc.fund_id}`}>{doc.fund_number} — {pick(doc.fund_title, lang).text}</Link>],
    ...(doc.inv_number ? [[t.fields.inv, `№ ${doc.inv_number}${doc.inv_title ? ` — ${pick(doc.inv_title, lang).text}` : ""}`] as [string, string]] : []),
    ...(doc.case_number ? [[t.fields.case, `№ ${doc.case_number}${doc.case_title ? ` — ${pick(doc.case_title, lang).text}` : ""}`] as [string, string]] : []),
    [t.fields.date, `${doc.date_text ?? "—"}${doc.date_uncertain ? ` (${t.dateApprox})` : ""}`],
    [t.fields.type, t.types[doc.doc_type] ?? doc.doc_type],
    ...(doc.place ? [[t.fields.place, doc.place] as [string, string]] : []),
    ...(doc.author ? [[t.fields.author, doc.author] as [string, string]] : []),
    ...(doc.branch_name ? [[t.fields.storage, `${pick(doc.branch_name, lang).text}${doc.branch_address ? `, ${pick(doc.branch_address, lang).text}` : ""}`] as [string, string]] : []),
    [t.fields.copyState, copyState],
    ...(doc.provenance ? [[t.fields.source, doc.provenance] as [string, string]] : []),
  ];

  // структурированные данные для поисковиков (ТЗ 7.5)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ArchiveComponent",
    name: title.text,
    description: desc.text,
    identifier: doc.cipher,
    dateCreated: doc.year_from ? String(doc.year_from) : undefined,
    holdingArchive: { "@type": "ArchiveOrganization", name: d.orgName },
  };

  return (
    <div className="wrap">
      <Crumbs
        items={[
          { href: `/${lang}`, label: t.home },
          { href: base, label: t.title },
          { href: `${base}/fund/${doc.fund_id}`, label: `${t.fund} ${doc.fund_number}` },
          { label: title.text.length > 60 ? `${title.text.slice(0, 57)}…` : title.text },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="doc">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {openFiles.length ? (
            <Viewer
              files={openFiles.map((f) => ({ id: f.id, mime: f.mime }))}
              alt={title.text}
              labels={{
                sheet: t.sheet("{i}" as unknown as number, "{n}" as unknown as number),
                zoom: t.zoom, unzoom: t.unzoom, prev: t.prev, next: t.next, openFull: t.openFull,
              }}
            />
          ) : (
            <div className="card closed">
              <span style={{ color: "var(--accent)" }}><Icon name={closedCount ? "lock" : "doc"} size={36} /></span>
              <div className="txt">
                <h2 className="h3">{closedCount ? t.closedTitle : t.noCopyTitle}</h2>
                <p className="muted">{closedCount ? t.closedText : t.noCopyText}</p>
                <div className="acts-row">
                  <Link className="btn" href={`/${lang}/services/gov`}>{t.howToRequest}</Link>
                  <Link className="btn sec" href={`/${lang}/about/reading-room`}>{t.readingRoom}</Link>
                </div>
              </div>
            </div>
          )}
          {openFiles.length && closedCount ? (
            <p className="notice"><Icon name="lock" size={20} /> {t.closedTitle}: {closedCount}</p>
          ) : null}
        </div>

        <div className="doc-info">
          <div className="tags">
            <span className="tag">{t.types[doc.doc_type] ?? doc.doc_type}</span>
            {openFiles.length ? <span className="tag green"><Icon name="eye" size={16} /> {t.copyOpen}</span> : <span className="tag grey">{copyState}</span>}
            {doc.is_demo ? <span className="tag red">{t.demoRecord}</span> : null}
          </div>
          <h1 lang={title.fallback ? "ru" : undefined}>{title.text}</h1>
          {title.fallback ? <p className="notice"><Icon name="globe" size={20} /> {d.notVerifiedTranslation}</p> : null}

          {doc.cipher ? (
            <div className="card cipher-box">
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="small muted">{t.cipher}</span>
                <div className="v">{doc.cipher}</div>
                <span className="small muted">{t.cipherHint}</span>
              </div>
              <CopyButton text={doc.cipher} label={t.copy} done={t.copied} />
            </div>
          ) : null}

          <dl className="card meta">
            {meta.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>

          {desc.text ? <p lang={desc.fallback ? "ru" : undefined}>{desc.text}</p> : null}
          {doc.is_demo ? <p className="notice"><Icon name="help" size={20} /> {t.demoNote}</p> : null}

          <div className="acts-row">
            <CopyButton label={t.share} done={t.linkCopied} icon="share" className="btn sec" />
            <Link className="btn sec" href={`/${lang}/assistant?q=${encodeURIComponent(title.text)}`}><Icon name="sparkle" size={20} /> {t.askAssistant}</Link>
          </div>
        </div>
      </div>

      {related.length ? (
        <section className="section" aria-labelledby="rel">
          <h2 id="rel" style={{ marginBottom: 24 }}>{t.related}</h2>
          <div className="related">
            {related.map((x) => {
              const rt = pick(x.title, lang);
              return (
                <Link key={x.uid} className="card" href={`${base}/doc/${x.uid}`}>
                  <span className="im">
                    {x.preview_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${x.preview_id}`} alt="" loading="lazy" />
                    ) : (
                      <Icon name="doc" size={32} />
                    )}
                  </span>
                  <span className="tx">
                    <b lang={rt.fallback ? "ru" : undefined}>{rt.text}</b>
                    <span className="small muted">{x.date_text} · {x.cipher}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
