import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang } from "@/i18n/dict";
import { contentText } from "@/i18n/content";
import { getNews } from "@/lib/content";
import { Crumbs } from "@/components/CatalogParts";
import { Md } from "@/components/Md";
import { CopyButton } from "@/components/Viewer";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const n = await getNews(slug);
  if (!n) return { robots: { index: false } };
  return { title: pick(n.title, lang).text, description: pick(n.summary, lang).text, openGraph: { type: "article", publishedTime: n.iso }, robots: n.is_demo ? { index: false } : undefined };
}

export default async function NewsItem({ params }: P) {
  const { lang: l, slug } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = contentText(lang);
  const d = dict(lang);
  const n = await getNews(slug);
  if (!n) notFound();
  const title = pick(n.title, lang);
  const body = pick(n.body, lang);
  const jsonLd = { "@context": "https://schema.org", "@type": "NewsArticle", headline: title.text, datePublished: n.iso, publisher: { "@type": "ArchiveOrganization", name: d.orgName } };
  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { href: `/${lang}/news`, label: t.news }, { label: title.text.length > 60 ? title.text.slice(0, 57) + "…" : title.text }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="page-art">
        <div className="tags">
          <time className="small muted" dateTime={n.iso}>{n.date}</time>
          {n.category_name ? <span className="tag">{pick(n.category_name, lang).text}</span> : null}
          {n.branch ? <span className="tag grey">{pick(n.branch, lang).text}</span> : null}
          {n.is_demo ? <span className="tag grey">{t.demo}</span> : null}
        </div>
        <h1 lang={title.fallback ? "ru" : undefined}>{title.text}</h1>
        {n.summary ? <p className="lead" lang="ru">{pick(n.summary, lang).text}</p> : null}
        {body.fallback ? <p className="notice">{d.notVerifiedTranslation}</p> : null}
        <div lang={body.fallback ? "ru" : undefined}><Md text={body.text} lang={lang} /></div>
        <div className="acts-row" style={{ marginTop: 24 }}>
          <CopyButton label={d.cat.share} done={d.cat.linkCopied} icon="share" className="btn sec" />
          <Link className="btn sec" href={`/${lang}/news`}>{t.allNews}</Link>
        </div>
      </article>
    </div>
  );
}
