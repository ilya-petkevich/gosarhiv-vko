import { notFound, redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth";
import { canEditEntity } from "@/lib/workflow";
import { createShowcase } from "../../../actions";

export const metadata = { title: "Новая подборка или выставка" };

export default async function NewShowcase({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ e?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  const { kind } = await params;
  if (kind !== "collection" && kind !== "exhibition") notFound();
  if (!canEditEntity(u, kind)) redirect(`/admin/showcase?kind=${kind}&e=${encodeURIComponent("Недостаточно прав")}`);
  const { e } = await searchParams;
  const isCol = kind === "collection";
  return (
    <div className="adm-stack">
      <h1>{isCol ? "Новая историческая подборка" : "Новая онлайн-выставка"}</h1>
      <p className="muted">Сохраняется черновиком. На сайте появится после проверки и публикации.</p>
      {e ? <p className="notice" role="alert">{e}</p> : null}
      <form action={createShowcase} className="card adm-card adm-form">
        <input type="hidden" name="kind" value={kind} />
        <label className="fld"><span className="label">Название *</span><input name="title_ru" required maxLength={300} /></label>
        <label className="fld"><span className="label">{isCol ? "Кратко о подборке" : "Описание выставки"}</span><textarea name="summary_ru" rows={3} maxLength={2000} /></label>
        {isCol ? <label className="fld"><span className="label">Пояснение редакции (показывается отдельно от фактов с источниками)</span><textarea name="editorial_ru" rows={3} maxLength={2000} /></label> : null}
        <div><button className="btn" type="submit">Создать черновик</button></div>
      </form>
    </div>
  );
}
