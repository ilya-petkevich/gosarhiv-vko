import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentStaff, audit } from "@/lib/auth";
import { q } from "@/lib/db";
import { canEditBranch } from "@/lib/workflow";
import { saveBranch } from "../../actions";

export const metadata = { title: "Филиал" };

export default async function EditBranch({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; m?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  const { id } = await params;
  if (!/^\d{1,6}$/.test(id)) notFound();
  if (!canEditBranch(u, Number(id))) {
    // прямой переход по адресу чужого филиала тоже проверяется и попадает в журнал
    await audit(u, "branch.open", "branch", id, "denied", { reason: "not_own_branch" });
    redirect(`/admin/branches?e=${encodeURIComponent("Можно открывать и менять сведения только своего филиала")}`);
  }
  const { e, m } = await searchParams;
  const b = (await q<{ id: number; name: { ru: string }; address: { ru: string }; phone: string | null; email: string | null; director: string | null; hours: { ru?: string } | null; is_visible: boolean; coords_verified: boolean }>(
    `select id, name, address, phone, email, director, hours, is_visible, coords_verified from branches where id = $1`, [Number(id)],
  ))[0];
  if (!b) notFound();
  return (
    <div className="adm-stack">
      <p className="small"><Link href="/admin/branches">← Филиалы</Link></p>
      <h1 className="h2">{b.name.ru}</h1>
      {m === "saved" ? <p className="notice ok" role="status">Сохранено. Изменения уже на сайте.</p> : null}
      {e ? <p className="notice" role="alert">{e}</p> : null}
      <form action={saveBranch} className="card adm-card adm-form">
        <input type="hidden" name="id" value={b.id} />
        <label className="fld"><span className="label">Адрес *</span><input name="address" defaultValue={b.address.ru} required maxLength={300} /></label>
        <div className="grid2">
          <label className="fld"><span className="label">Директор</span><input name="director" defaultValue={b.director ?? ""} maxLength={120} /></label>
          <label className="fld"><span className="label">Телефон</span><input name="phone" defaultValue={b.phone ?? ""} maxLength={60} /></label>
          <label className="fld"><span className="label">Почта</span><input name="email" type="email" defaultValue={b.email ?? ""} maxLength={120} /></label>
        </div>
        <label className="fld"><span className="label">Режим работы</span><input name="hours" defaultValue={b.hours?.ru ?? ""} maxLength={200} placeholder="Например: Пн–Пт 9:00–18:00" /></label>
        <label className="check"><input type="checkbox" name="is_visible" defaultChecked={b.is_visible} /> Показывать на карте и в списке</label>
        <p className="small muted">Координаты: {b.coords_verified ? "подтверждены" : "примерные, не подтверждены"}.</p>
        <div><button className="btn" type="submit">Сохранить</button></div>
      </form>
    </div>
  );
}
