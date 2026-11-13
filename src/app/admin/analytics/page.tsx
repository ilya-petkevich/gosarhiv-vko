import { redirect } from "next/navigation";
import { currentStaff, can } from "@/lib/auth";
import { q } from "@/lib/db";
import { siteStats } from "@/lib/siteStats";
import { analyticsAdvice } from "../actions";

export const metadata = { title: "Аналитика" };

export default async function Analytics({ searchParams }: { searchParams: Promise<{ e?: string; m?: string }> }) {
  const u = await currentStaff();
  if (!u) redirect("/admin/login");
  if (!can(u, "analytics.view")) redirect("/admin");
  const { e, m } = await searchParams;
  const st = await siteStats();
  const saved = (await q<{ value: { text: string; at: string; by: string } }>(`select value from site_settings where key = 'analytics_advice'`))[0]?.value;
  const max = Math.max(1, ...st.views.map((v) => v.n));
  const c = st.catalog;

  return (
    <div className="adm-stack">
      <h1>Аналитика</h1>
      <p className="muted small">За последние 30 дней. Без IP-адресов, cookie и персональных данных: хранятся только раздел сайта, язык и урезанный текст поискового запроса (цифры длиннее 4 знаков и адреса почты вырезаются).</p>
      {e ? <p className="notice" role="alert">{e}</p> : null}
      {m === "done" ? <p className="notice ok" role="status">Рекомендации обновлены.</p> : null}

      <div className="dash-grid">
        <div className="card kpi"><span className="n">{st.totalViews.toLocaleString("ru-RU")}</span><span className="l">просмотров разделов</span></div>
        <div className="card kpi b"><span className="n">{st.searchTotal + st.emptyTotal}</span><span className="l">поисковых запросов</span></div>
        <div className="card kpi o"><span className="n">{st.emptyTotal}</span><span className="l">запросов без результатов</span></div>
        <div className="card kpi g"><span className="n">{st.aiTotal}</span><span className="l">ответов помощника</span></div>
      </div>

      <section className="card adm-card" aria-labelledby="rec">
        <h2 id="rec" className="h3">Рекомендации</h2>
        <ul className="tips">{st.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        {saved ? (
          <div className="ai-advice">
            <b>Рекомендации модели</b> <span className="small muted">— сформировано автоматически {new Date(saved.at).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}, проверьте перед применением</span>
            <p style={{ whiteSpace: "pre-line", marginTop: 8 }}>{saved.text}</p>
          </div>
        ) : null}
        <form action={analyticsAdvice}>
          <button className="btn sec sm" type="submit">Сформулировать рекомендации с помощью ИИ</button>
          <p className="small muted" style={{ marginTop: 6 }}>В модель уходят только сводные цифры с этой страницы.</p>
        </form>
      </section>

      <div className="grid2">
        <section className="card adm-card" aria-labelledby="pop">
          <h2 id="pop" className="h3">Популярность разделов</h2>
          {st.views.length ? (
            <ul className="bars">
              {st.views.slice(0, 12).map((v) => (
                <li key={v.path}><span>{st.SECTION[v.path] ?? v.path}</span><span className="bar"><i style={{ width: `${(v.n / max) * 100}%` }} /></span><b>{v.n}</b></li>
              ))}
            </ul>
          ) : <p className="muted small">Посещений пока нет.</p>}
        </section>
        <section className="card adm-card" aria-labelledby="ai">
          <h2 id="ai" className="h3">Помощник</h2>
          {st.ai.length ? <ul className="bars">{st.ai.map((a) => <li key={a.mode}><span>{st.AI_MODE[a.mode] ?? a.mode}</span><b>{a.n}</b></li>)}</ul> : <p className="muted small">Вопросов пока не было.</p>}
          {c ? <p className="small">Каталог: {c.funds} фондов, {c.docs} опубликованных документов, с цифровой копией — {c.with_copy}.</p> : null}
        </section>
        <section className="card adm-card" aria-labelledby="sq">
          <h2 id="sq" className="h3">Частые запросы</h2>
          {st.searches.length ? <ul className="bars">{st.searches.map((s) => <li key={s.value}><span>{s.value}</span><b>{s.n}</b></li>)}</ul> : <p className="muted small">Нет данных.</p>}
        </section>
        <section className="card adm-card" aria-labelledby="eq">
          <h2 id="eq" className="h3">Не нашли</h2>
          {st.empty.length ? <ul className="bars">{st.empty.map((s) => <li key={s.value}><span>{s.value}</span><b>{s.n}</b></li>)}</ul> : <p className="muted small">Все запросы что-то нашли.</p>}
          {st.notFound.length ? (
            <>
              <h3 className="small" style={{ marginTop: 12 }}>Несуществующие адреса</h3>
              <ul className="bars">{st.notFound.map((s) => <li key={s.value}><span className="mono">{s.value}</span><b>{s.n}</b></li>)}</ul>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
