import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";

export const metadata = { title: "Страницы" };

export default async function AdminPages() {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "pages.edit")) redirect("/admin");
  const rows = await q<{ id: number; slug: string; title: { ru: string }; date: string; version: number }>(
    `select id, slug, title, to_char(updated_at, 'DD.MM.YYYY HH24:MI') date, version from pages order by section, sort`,
  );
  return (
    <div className="adm-stack">
      <h1>Информационные страницы</h1>
      <div className="card price-wrap">
        <table className="price adm-table">
          <thead><tr><th>Страница</th><th>Адрес</th><th>Версия</th><th>Изменено</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td><Link href={`/admin/pages/${r.id}`}>{r.title.ru}</Link></td><td className="small">/about/{r.slug}</td><td>{r.version}</td><td className="small">{r.date}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
