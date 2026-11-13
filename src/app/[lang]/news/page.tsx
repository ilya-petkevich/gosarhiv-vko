import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { contentText } from "@/i18n/content";
import { listNews, newsCategories } from "@/lib/content";
import { Crumbs, Pager } from "@/components/CatalogParts";

export const dynamic = "force-dynamic";
const PER = 12;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = contentText(lang);
  return { title: t.news, description: t.newsLead };
}

export default async function News({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ c?: string; page?: string; q?: string; sort?: string }> }) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = contentText(lang);
  const d = dict(lang);
  const { c, page: pg, q: qRaw, sort } = await searchParams;
  const text = (qRaw ?? "").slice(0, 100);
  const order = sort === "old" ? "old" : "new";
  const cats = await newsCategories();
  const cat = cats.some((x) => x.slug === c) ? c : undefined;
  const page = Math.max(1, Math.min(200, Number(pg) || 1));
  const { rows, total } = await listNews({ category: cat, limit: PER, offset: (page - 1) * PER, q: text, order });
  const href = (p: number) => `/${lang}/news?${new URLSearchParams({ ...(cat ? { c: cat } : {}), ...(text ? { q: text } : {}), ...(order === "old" ? { sort: "old" } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  const keep = (o: Record<string, string | undefined>) => `/${lang}/news?${new URLSearchParams(Object.entries({ c: cat, q: text || undefined, sort: order === "old" ? "old" : undefined, ...o }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { label: t.news }]} />
      <h1>{t.news}</h1>
      <p className="muted" style={{ marginTop: 8 }}>{t.newsLead}</p>
      <form className="news-search" role="search" action={`/${lang}/news`} method="get">
        {cat ? <input type="hidden" name="c" value={cat} /> : null}
        <label htmlFor="nq" className="sr">{t.newsSearch}</label>
        <input id="nq" name="q" type="search" defaultValue={text} placeholder={t.newsSearch} maxLength={100} />
        <select name="sort" defaultValue={order} aria-label={t.newsNew}>
          <option value="new">{t.newsNew}</option>
          <option value="old">{t.newsOld}</option>
        </select>
        <button className="btn" type="submit">{t.newsFind}</button>
      </form>
      <nav className="chips-row" style={{ margin: "16px 0 20px" }}>
        <Link className="chip" href={keep({ c: undefined })} aria-current={!cat ? "page" : undefined}>{t.all}</Link>
        {cats.map((x) => <Link key={x.slug} className="chip" href={keep({ c: x.slug })} aria-current={cat === x.slug ? "page" : undefined}>{pick(x.name, lang).text}</Link>)}
      </nav>
      {rows.length ? (
        <div className="news-list">
          {rows.map((n) => {
            const title = pick(n.title, lang);
            return (
              <article key={n.slug} className="card news-card">
                <div className="tags">
                  <time className="small muted" dateTime={n.iso}>{n.date}</time>
                  {n.category_name ? <span className="tag">{pick(n.category_name, lang).text}</span> : null}
                  {n.branch ? <span className="tag grey">{pick(n.branch, lang).text}</span> : null}
                  {n.is_demo ? <span className="tag grey">{t.demo}</span> : null}
                </div>
                <h2 className="h3"><Link href={`/${lang}/news/${n.slug}`} lang={title.fallback ? "ru" : undefined}>{title.text}</Link></h2>
                {n.summary ? <p className="muted" lang="ru">{pick(n.summary, lang).text}</p> : null}
              </article>
            );
          })}
        </div>
      ) : <p className="notice">{text ? t.newsNothing : t.nothing}</p>}
      <div style={{ marginTop: 20 }}><Pager page={page} pages={Math.max(1, Math.ceil(total / PER))} href={href} lang={lang} /></div>
    </div>
  );
}
