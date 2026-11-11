import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { STATUS_LABEL, PUBLISH_LABEL } from "@/lib/workflow";

export const metadata = { title: "Каталог" };

export default async function AdminCatalog({ searchParams }: { searchParams: Promise<{ status?: string; e?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "catalog.edit", "content.create", "content.edit", "content.review", "content.publish")) redirect("/admin");
  const { status, e } = await searchParams;
  const st = status && STATUS_LABEL[status] ? status : null;
  const rows = await q<{ id: number; title: { ru: string }; cipher: string | null; status: string; publish_status: string; updated_at: string; author: string | null }>(
    `select d.id, d.title, d.cipher, d.status, d.publish_status, to_char(d.updated_at, 'DD.MM.YYYY HH24:MI') as updated_at, u.full_name as author
     from documents d left join users u on u.id = d.created_by
     where ($1::text is null or d.status = $1) order by d.updated_at desc limit 200`,
    [st],
  );
  return (
    <div className="adm-stack">
      <div className="row-between">
        <h1>Электронный каталог</h1>
        {can(u, "catalog.edit", "content.create") ? <Link className="btn" href="/admin/catalog/new">+ Новая запись</Link> : null}
      </div>
      {e === "denied" ? <p className="notice" role="alert">Недостаточно прав.</p> : null}
      <nav className="chips-row" aria-label="Фильтр по статусу">
        <Link className="chip" href="/admin/catalog" aria-current={!st ? "page" : undefined}>Все</Link>
        {Object.entries(STATUS_LABEL).map(([k, v]) => <Link key={k} className="chip" href={`/admin/catalog?status=${k}`} aria-current={st === k ? "page" : undefined}>{v}</Link>)}
      </nav>
      <div className="card price-wrap">
        <table className="price adm-table">
          <thead><tr><th>Запись</th><th>Шифр</th><th>Статус</th><th>Доступ</th><th>Изменено</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/catalog/${r.id}`}>{r.title.ru}</Link>{r.author ? <div className="small muted">{r.author}</div> : null}</td>
                <td className="small">{r.cipher}</td>
                <td><span className={`st st-${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="small">{PUBLISH_LABEL[r.publish_status]}</td>
                <td className="small">{r.updated_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
