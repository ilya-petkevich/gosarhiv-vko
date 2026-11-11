// Общие части каталога: хлебные крошки, карточка записи в выдаче, постраничная навигация.

import Link from "next/link";
import { dict, pick, type Lang } from "@/i18n/dict";
import type { DocHit } from "@/lib/catalog";
import { Icon } from "./Icon";

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="crumbs" aria-label="breadcrumbs">
      <ol>
        {items.map((i, n) => (
          <li key={n}>
            {i.href ? <Link href={i.href}>{i.label}</Link> : <span aria-current="page">{i.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DocRow({ d, lang }: { d: DocHit; lang: Lang }) {
  const t = dict(lang).cat;
  const title = pick(d.title, lang);
  return (
    <article className="card rec">
      <Link className="rec-thumb" href={`/${lang}/catalog/doc/${d.uid}`} tabIndex={-1} aria-hidden="true">
        {d.preview_id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${d.preview_id}`} alt="" loading="lazy" />
        ) : (
          <span className="rec-ph"><Icon name={d.doc_type === "photo" ? "image" : d.doc_type === "video" ? "film" : "doc"} size={30} /></span>
        )}
      </Link>
      <div className="rec-body">
        <div className="tags">
          <span className="tag">{t.types[d.doc_type] ?? d.doc_type}</span>
          {d.has_copy ? <span className="tag green"><Icon name="eye" size={16} /> {t.hasCopy}</span> : <span className="tag grey">{t.descOnly}</span>}
          {d.is_demo ? <span className="tag grey">{t.demoRecord}</span> : null}
        </div>
        <h3>
          <Link href={`/${lang}/catalog/doc/${d.uid}`} lang={title.fallback ? "ru" : undefined}>{title.text}</Link>
        </h3>
        <p className="small muted">
          {d.date_text}
          {d.date_uncertain ? ` (${t.dateApprox})` : ""}
          {d.place ? ` · ${d.place}` : ""}
        </p>
        <p className="small cipher-line">{t.cipher}: <b>{d.cipher}</b></p>
      </div>
    </article>
  );
}

export function Pager({ page, pages, href, lang }: { page: number; pages: number; href: (p: number) => string; lang: Lang }) {
  if (pages <= 1) return null;
  const t = dict(lang).cat;
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))).sort((a, b) => a - b);
  return (
    <nav className="pager" aria-label={t.page}>
      {page > 1 ? <Link className="btn sec sm" href={href(page - 1)} rel="prev"><Icon name="left" size={18} /> {t.prev}</Link> : null}
      {nums.map((p, i) => (
        <span key={p} style={{ display: "contents" }}>
          {i > 0 && p - nums[i - 1] > 1 ? <span className="muted">…</span> : null}
          <Link className={`pg${p === page ? " on" : ""}`} href={href(p)} aria-current={p === page ? "page" : undefined} aria-label={`${t.page} ${p}`}>{p}</Link>
        </span>
      ))}
      {page < pages ? <Link className="btn sec sm" href={href(page + 1)} rel="next">{t.next} <Icon name="right" size={18} /></Link> : null}
    </nav>
  );
}
