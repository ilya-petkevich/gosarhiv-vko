import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { FIELDS, checkRows, type Mapping } from "@/lib/importer";
import { rollbackImport, runImport, saveMapping } from "../../actions";

export const metadata = { title: "Импорт" };

export default async function ImportJob({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ info?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "catalog.import")) redirect("/admin");
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const { info } = await searchParams;
  const job = (await q<{ id: number; filename: string; status: string; columns: string[]; rows: string[][]; mapping: Mapping; ok_rows: number; failed_rows: number; errors: { row: number; error: string }[]; fund: string }>(
    `select j.id, j.filename, j.status, j.columns, j.rows, j.mapping, j.ok_rows, j.failed_rows, j.errors, f.fund_number fund
     from import_jobs j left join funds f on f.id = j.fund_id where j.id = $1`, [Number(id)],
  ))[0];
  if (!job) notFound();
  const checks = job.status === "preview" ? await checkRows(job.rows, job.mapping) : [];
  const good = checks.filter((c) => !c.errors.length).length;
  const missingRequired = FIELDS.filter((f) => f.required && job.mapping[f.key] == null);

  return (
    <div className="adm-stack">
      <p className="small"><Link href="/admin/import">← Импорт</Link></p>
      <h1 className="h2">{job.filename}</h1>
      <p className="small muted">Фонд {job.fund} · строк: {job.rows.length}</p>
      {info ? <p className="notice ok" role="status">{info}</p> : null}

      {job.status === "preview" ? (
        <>
          <form action={saveMapping} className="card adm-card">
            <h2 className="h3">1. Сопоставление колонок</h2>
            <input type="hidden" name="id" value={job.id} />
            <div className="grid3">
              {FIELDS.map((f) => (
                <label key={f.key} className="fld"><span className="label">{f.label}{f.required ? " *" : ""}</span>
                  <select name={`map_${f.key}`} defaultValue={job.mapping[f.key] ?? ""}>
                    <option value="">— не загружать —</option>
                    {job.columns.map((c, i) => <option key={i} value={i}>{c}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div><button className="btn sec" type="submit">Применить сопоставление</button></div>
          </form>

          <section className="card adm-card">
            <h2 className="h3">2. Предварительный просмотр</h2>
            {missingRequired.length ? <p className="notice">Укажите колонки для обязательных полей: {missingRequired.map((f) => f.label).join(", ")}.</p> : null}
            <p>Готово к загрузке: <b>{good}</b> из {checks.length}. С ошибками или дубликатами: <b>{checks.length - good}</b> — они будут пропущены.</p>
            <div className="price-wrap">
              <table className="price adm-table">
                <thead><tr><th>Строка</th><th>Шифр</th><th>Название</th><th>Дата</th><th>Проверка</th></tr></thead>
                <tbody>
                  {checks.slice(0, 50).map((c) => (
                    <tr key={c.n}>
                      <td>{c.n}</td><td className="small">{c.values.cipher}</td><td className="small">{c.values.title_ru}</td><td className="small">{c.values.date_text}</td>
                      <td className="small">{c.errors.length ? <span className="st st-rework">{c.errors.join("; ")}</span> : <span className="st st-published">готово</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {checks.length > 50 ? <p className="small muted">Показаны первые 50 строк.</p> : null}
          </section>

          <form action={runImport} className="card adm-card">
            <h2 className="h3">3. Импорт</h2>
            <input type="hidden" name="id" value={job.id} />
            <p className="small muted">Записи создадутся черновиками с закрытым описанием. Строки с ошибками будут пропущены и попадут в протокол.</p>
            <div><button className="btn" type="submit" disabled={!good || missingRequired.length > 0}>Импортировать {good} {good === 1 ? "строку" : "строк"}</button></div>
          </form>
        </>
      ) : (
        <section className="card adm-card">
          <h2 className="h3">Протокол</h2>
          <p>Создано записей: <b>{job.ok_rows}</b>. Пропущено: <b>{job.failed_rows}</b>. Состояние: {job.status === "rolled_back" ? "откачен" : "выполнен"}.</p>
          {job.errors.length ? (
            <ul className="adm-list">{job.errors.map((x, i) => <li key={i} className="small">Строка {x.row}: {x.error}</li>)}</ul>
          ) : null}
          <div className="acts-row">
            <Link className="btn sec" href="/admin/catalog?status=draft">Открыть черновики</Link>
            {job.status === "done" ? (
              <form action={rollbackImport}><input type="hidden" name="id" value={job.id} /><button className="btn sec" type="submit">Откатить импорт</button></form>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
