import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { MAX_IMPORT_MB, MAX_ROWS } from "@/lib/importer";
import { uploadImport } from "../actions";

export const metadata = { title: "Импорт" };

const ST: Record<string, string> = { preview: "Проверка", running: "Идёт", done: "Выполнен", failed: "Ошибка", rolled_back: "Откачен" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "catalog.import")) redirect("/admin");
  const { e } = await searchParams;
  const funds = await q<{ id: number; fund_number: string; title: { ru: string } }>(`select id, fund_number, title from funds where is_demo order by fund_number`);
  const jobs = await q<{ id: number; filename: string; status: string; total_rows: number; ok_rows: number; failed_rows: number; at: string }>(
    `select id, filename, status, total_rows, ok_rows, failed_rows, to_char(created_at, 'DD.MM.YYYY HH24:MI') at from import_jobs order by id desc limit 20`,
  );
  return (
    <div className="adm-stack">
      <h1>Импорт описаний из Excel или CSV</h1>
      <p className="muted">Первая строка файла — заголовки колонок. Записи создаются черновиками с закрытым описанием: на сайт они попадут только после проверки и публикации.</p>
      {e ? <p className="notice" role="alert">{e}</p> : null}
      <form action={uploadImport} className="card adm-card adm-form">
        <label className="fld"><span className="label">Фонд, в который загружать *</span>
          <select name="fund_id" required>{funds.map((f) => <option key={f.id} value={f.id}>{f.fund_number} — {f.title.ru}</option>)}</select>
        </label>
        <label className="fld"><span className="label">Файл .xlsx или .csv (до {MAX_IMPORT_MB} МБ, до {MAX_ROWS} строк) *</span>
          <input type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        </label>
        <div className="acts-row">
          <button className="btn" type="submit">Загрузить и проверить</button>
          <a className="btn sec" href="/docs/import-sample.csv" download>Образец файла (CSV)</a>
          {can(u, "catalog.export") ? <a className="btn sec" href="/admin/export" download>Выгрузить открытые описания (CSV)</a> : null}
        </div>
      </form>
      {jobs.length ? (
        <div className="card price-wrap">
          <table className="price adm-table">
            <thead><tr><th>Файл</th><th>Когда</th><th>Строк</th><th>Создано</th><th>С ошибками</th><th>Состояние</th></tr></thead>
            <tbody>{jobs.map((j) => <tr key={j.id}><td><Link href={`/admin/import/${j.id}`}>{j.filename}</Link></td><td className="small">{j.at}</td><td>{j.total_rows}</td><td>{j.ok_rows}</td><td>{j.failed_rows}</td><td className="small">{ST[j.status]}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
