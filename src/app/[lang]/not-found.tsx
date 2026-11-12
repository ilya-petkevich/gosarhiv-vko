// «Страница не существует» (доп. ТЗ, п. 2). Язык берётся из cookie: not-found не получает параметры адреса.

import Link from "next/link";
import { cookies } from "next/headers";
import { dict, isLang, type Lang } from "@/i18n/dict";
import { Kniga } from "@/components/Kniga";

export default async function NotFound() {
  const c = (await cookies()).get("lang")?.value;
  const lang: Lang = c && isLang(c) ? (c as Lang) : "ru";
  const d = dict(lang);
  return (
    <div className="wrap" style={{ padding: "72px 0", display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
      <Kniga size={120} mood="think" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <h1 style={{ fontSize: 32 }}>{d.notFoundTitle}</h1>
        <p className="muted">{d.notFoundText}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn" href={`/${lang}`}>{d.toHome}</Link>
          <Link className="btn sec" href={`/${lang}/catalog`}>{d.nav.catalog}</Link>
        </div>
      </div>
    </div>
  );
}
