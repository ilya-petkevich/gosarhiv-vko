import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dict, isLang, pick, type Lang, type L10n } from "@/i18n/dict";
import { branchText } from "@/i18n/branches";
import { q } from "@/lib/db";
import { Crumbs } from "@/components/CatalogParts";
import { BranchesMap, type BranchView } from "@/components/BranchesMap";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = branchText(lang);
  return { title: t.title, description: t.lead };
}

type Row = {
  slug: string; name: L10n; short_name: L10n | null; address: L10n; phone: string | null; email: string | null; hours: L10n | null;
  lat: number | null; lng: number | null; coords_verified: boolean; is_main: boolean;
};

export default async function Branches({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = branchText(lang);
  const d = dict(lang);
  const rows = await q<Row>(
    `select slug, name, short_name, address, phone, email, hours, lat, lng, coords_verified, is_main from branches where is_visible order by sort`,
  );
  const branches: BranchView[] = rows.map((r) => ({
    slug: r.slug,
    name: pick(r.name, lang).text,
    short: pick(r.short_name ?? r.name, lang).text,
    address: pick(r.address, lang).text,
    phone: r.phone,
    email: r.email,
    hours: r.hours ? pick(r.hours, lang).text : null,
    lat: r.lat,
    lng: r.lng,
    verified: r.coords_verified,
    isMain: r.is_main,
  }));

  // структурированные данные: адреса и телефоны подразделений (ТЗ 7.5)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ArchiveOrganization",
    name: d.orgName,
    telephone: "+7 7232 25-59-76",
    department: branches.map((b) => ({ "@type": "ArchiveOrganization", name: b.name, address: b.address, telephone: b.phone ?? undefined })),
  };

  return (
    <div className="wrap">
      <Crumbs items={[{ href: `/${lang}`, label: d.cat.home }, { label: t.title }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1>{t.title}</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 900 }}>{t.lead}</p>
      {lang !== "ru" ? <p className="notice" style={{ marginTop: 12 }}>{d.notVerifiedTranslation}</p> : null}
      <BranchesMap branches={branches} t={t} />
    </div>
  );
}
