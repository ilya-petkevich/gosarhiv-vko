import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/workflow";

export const metadata = { title: "Новости" };

export default async function AdminNews({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "news.edit", "content.review", "content.publish")) redirect("/admin");
  const { e } = await searchParams;
  const own = can(u, "branches.edit_own") && !can(u, "branches.edit_all") ? u.branch_id : null;
  const rows = await q<{ id: number; title: { ru: string }; status: string; date: string; branch: string | null; is_demo: boolean }>(
    `select n.id, n.title, n.status, to_char(coalesce(n.published_at, n.updated_at), 'DD.MM.YYYY') date, b.short_name->>'ru' branch, n.is_demo
     from news n left join branches b on b.id = n.branch_id where ($1::int is null or n.branch_id = $1) order by n.updated_at desc limit 200`,
    [own],
  );
  return (
    <div className="adm-stack">
      <div className="row-between"><h1>Новости</h1>{can(u, "news.edit") ? <Link className="btn" href="/admin/news/new">+ Новость</Link> : null}</div>
      {own ? <p className="muted small">Показаны новости вашего филиала.</p> : null}
      {e ? <p className="notice" role="alert">{e}</p> : null}
      <div className="card price-wrap">
        <table className="price adm-table">
          <thead><tr><th>Заголовок</th><th>Филиал</th><th>Статус</th><th>Дата</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td><Link href={`/admin/news/${r.id}`}>{r.title.ru}</Link>{r.is_demo ? <span className="small muted"> · демо</span> : null}</td><td className="small">{r.branch ?? "—"}</td><td><span className={`st st-${r.status}`}>{STATUS_LABEL[r.status]}</span></td><td className="small">{r.date}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
