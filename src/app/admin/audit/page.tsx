import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";

export const metadata = { title: "Журнал действий" };

const RES: Record<string, string> = { ok: "выполнено", denied: "отказано", error: "ошибка" };

export default async function Audit({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "audit.view")) redirect("/admin");
  const { r } = await searchParams;
  const res = r && RES[r] ? r : null;
  const rows = await q<{ at: string; user_login: string | null; action: string; object_type: string | null; object_id: string | null; result: string; details: unknown; ip: string | null }>(
    `select to_char(at, 'DD.MM.YYYY HH24:MI:SS') at, user_login, action, object_type, object_id, result, details, ip
     from audit_log where ($1::text is null or result = $1) order by id desc limit 300`,
    [res],
  );
  return (
    <div className="adm-stack">
      <h1>Журнал действий</h1>
      <p className="muted small">Дата, пользователь, действие, объект и результат. Пароли и секреты в журнал не пишутся.</p>
      <nav className="chips-row">
        <Link className="chip" href="/admin/audit" aria-current={!res ? "page" : undefined}>Все</Link>
        {Object.entries(RES).map(([k, v]) => <Link key={k} className="chip" href={`/admin/audit?r=${k}`} aria-current={res === k ? "page" : undefined}>{v}</Link>)}
      </nav>
      <div className="card price-wrap">
        <table className="price adm-table">
          <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Результат</th><th>Подробности</th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={i}>
                <td className="small">{x.at}</td><td className="small">{x.user_login ?? "—"}</td><td className="small">{x.action}</td>
                <td className="small">{x.object_type ? `${x.object_type} ${x.object_id ?? ""}` : "—"}</td>
                <td><span className={`st st-${x.result === "ok" ? "published" : x.result === "denied" ? "rework" : "draft"}`}>{RES[x.result]}</span></td>
                <td className="small mono">{x.details ? JSON.stringify(x.details).slice(0, 160) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
