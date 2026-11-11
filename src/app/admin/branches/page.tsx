import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { canEditBranch } from "@/lib/workflow";

export const metadata = { title: "Филиалы" };

export default async function AdminBranches({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "branches.edit_all", "branches.edit_own")) redirect("/admin");
  const { e } = await searchParams;
  const rows = await q<{ id: number; name: { ru: string }; address: { ru: string }; phone: string | null; is_visible: boolean }>(
    `select id, name, address, phone, is_visible from branches order by sort`,
  );
  return (
    <div className="adm-stack">
      <h1>Архив и филиалы</h1>
      {e ? <p className="notice" role="alert">{e}</p> : null}
      <div className="card price-wrap">
        <table className="price adm-table">
          <thead><tr><th>Подразделение</th><th>Адрес</th><th>Телефон</th><th>На карте</th><th></th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.name.ru}</td><td className="small">{b.address.ru}</td><td className="small">{b.phone ?? "—"}</td><td className="small">{b.is_visible ? "да" : "скрыт"}</td>
                <td>{canEditBranch(u, b.id) ? <Link className="btn sec sm" href={`/admin/branches/${b.id}`}>Изменить</Link> : <span className="small muted">нет прав</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
