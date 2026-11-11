import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { STATUS_LABEL, canEditEntity } from "@/lib/workflow";

export const metadata = { title: "Подборки и выставки" };

export default async function Showcase({ searchParams }: { searchParams: Promise<{ kind?: string; e?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "memory.edit", "exhibitions.edit", "content.review", "content.publish")) redirect("/admin");
  const { kind: k, e } = await searchParams;
  const kind = k === "exhibition" ? "exhibition" : "collection";
  const table = kind === "collection" ? "collections" : "exhibitions";
  const items = kind === "collection" ? "(select count(*)::int from collection_items i where i.collection_id = t.id)" : "(select count(*)::int from exhibits i where i.exhibition_id = t.id)";
  const rows = await q<{ id: number; title: { ru: string }; status: string; n: number; author: string | null; is_demo: boolean }>(
    `select t.id, t.title, t.status, ${items} n, u.full_name author, t.is_demo from ${table} t left join users u on u.id = t.created_by order by t.updated_at desc`,
  );
  return (
    <div className="adm-stack">
      <div className="row-between">
        <h1>Подборки и выставки</h1>
        {canEditEntity(u, kind) ? <Link className="btn" href={`/admin/showcase/${kind}/new`}>+ {kind === "collection" ? "Новая подборка" : "Новая выставка"}</Link> : null}
      </div>
      {e ? <p className="notice" role="alert">{e}</p> : null}
      <nav className="chips-row">
        <Link className="chip" href="/admin/showcase?kind=collection" aria-current={kind === "collection" ? "page" : undefined}>Исторические подборки</Link>
        <Link className="chip" href="/admin/showcase?kind=exhibition" aria-current={kind === "exhibition" ? "page" : undefined}>Онлайн-выставки</Link>
      </nav>
      <div className="card price-wrap">
        <table className="price adm-table">
          <thead><tr><th>Название</th><th>Материалов</th><th>Статус</th><th>Автор</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/admin/showcase/${kind}/${r.id}`}>{r.title.ru}</Link>{r.is_demo ? <span className="small muted"> · демо</span> : null}</td>
              <td>{r.n}</td><td><span className={`st st-${r.status}`}>{STATUS_LABEL[r.status]}</span></td><td className="small">{r.author ?? "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
