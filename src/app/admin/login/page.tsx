import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth";
import { loginAction } from "../actions";

export const metadata = { title: "Вход" };

const MSG: Record<string, string> = {
  bad: "Неверный логин или пароль.",
  locked: "Слишком много неудачных попыток. Вход временно заблокирован на 15 минут.",
  session: "Сессия закончилась. Войдите снова.",
  bye: "Вы вышли из админки.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await currentStaff()) redirect("/admin");
  const { e } = await searchParams;
  return (
    <div className="card adm-login">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo" src="/img/logo-gavko.png" alt="" width={64} height={64} />
      <h1 className="h3">Вход для сотрудников архива</h1>
      {e && MSG[e] ? <p className={`notice${e === "bye" ? " ok" : ""}`} role="alert">{MSG[e]}</p> : null}
      <form action={loginAction} className="adm-form">
        <label className="fld"><span className="label">Логин</span><input name="login" autoComplete="username" required maxLength={64} /></label>
        <label className="fld"><span className="label">Пароль</span><input name="password" type="password" autoComplete="current-password" required maxLength={200} /></label>
        <button className="btn" type="submit">Войти</button>
      </form>
      <p className="small muted">Демо-стенд: тестовые учётные записи выдаются комиссии отдельно.</p>
    </div>
  );
}
