import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { DocFields } from "@/components/DocForm";
import { createDocument } from "../../actions";

export const metadata = { title: "Новая запись" };

export default async function NewDoc({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "catalog.edit", "content.create")) redirect("/admin/catalog?e=denied");
  const { e } = await searchParams;
  const funds = await q<{ id: number; fund_number: string; title: { ru: string } }>(`select id, fund_number, title from funds where is_demo order by fund_number`);
  return (
    <div className="adm-stack">
      <h1>Новая запись каталога</h1>
      <p className="muted">Запись сохраняется черновиком. На сайте она появится только после проверки и публикации.</p>
      {e ? <p className="notice" role="alert">{e}</p> : null}
      <form action={createDocument} className="card adm-card">
        <label className="fld"><span className="label">Фонд *</span>
          <select name="fund_id" required>{funds.map((f) => <option key={f.id} value={f.id}>{f.fund_number} — {f.title.ru}</option>)}</select>
        </label>
        <DocFields v={{}} />
        <div><button className="btn" type="submit">Сохранить черновик</button></div>
      </form>
    </div>
  );
}
