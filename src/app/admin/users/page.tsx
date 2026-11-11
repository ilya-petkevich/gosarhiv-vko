import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";

export const metadata = { title: "Пользователи и роли" };

export default async function Users() {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "users.manage")) redirect("/admin");
  const users = await q<{ login: string; full_name: string; is_active: boolean; roles: string; branch: string | null; last: string | null; locked: boolean }>(
    `select u.login, u.full_name, u.is_active, string_agg(r.name->>'ru', ', ') roles, b.short_name->>'ru' branch,
            to_char(u.last_login_at, 'DD.MM.YYYY HH24:MI') last, coalesce(u.locked_until > now(), false) locked
     from users u left join user_roles ur on ur.user_id = u.id left join roles r on r.code = ur.role_code left join branches b on b.id = u.branch_id
     group by u.id, b.short_name order by u.login`,
  );
  const roles = await q<{ code: string; name: { ru: string }; perms: string }>(
    `select r.code, r.name, string_agg(p.description, '; ' order by p.code) perms from roles r
     left join role_permissions rp on rp.role_code = r.code left join permissions p on p.code = rp.perm_code group by r.code, r.name, r.sort order by r.sort`,
  );
  return (
    <div className="adm-stack">
      <h1>Пользователи и роли</h1>
      <div className="card price-wrap">
        <table className="price adm-table">
          <thead><tr><th>Логин</th><th>Имя</th><th>Роли</th><th>Филиал</th><th>Последний вход</th><th>Состояние</th></tr></thead>
          <tbody>{users.map((x) => <tr key={x.login}><td>{x.login}</td><td>{x.full_name}</td><td className="small">{x.roles}</td><td className="small">{x.branch ?? "—"}</td><td className="small">{x.last ?? "—"}</td><td className="small">{!x.is_active ? "отключён" : x.locked ? "заблокирован" : "активен"}</td></tr>)}</tbody>
        </table>
      </div>
      <h2 className="h3">Права ролей</h2>
      <div className="card price-wrap">
        <table className="price adm-table">
          <thead><tr><th>Роль</th><th>Права</th></tr></thead>
          <tbody>{roles.map((r) => <tr key={r.code}><td>{r.name.ru}</td><td className="small">{r.perms}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="small muted">Права хранятся в базе (таблица role_permissions) и настраиваются без правки кода. Экран изменения ролей — следующий этап.</p>
    </div>
  );
}
