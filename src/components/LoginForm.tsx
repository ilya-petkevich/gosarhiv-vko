"use client";

// Форма входа. «Запомнить меня» сохраняет логин и пароль в менеджере паролей браузера
// (Credential Management API в Chrome/Edge/Dia; в Safari — его связка ключей по autocomplete).
// Сам сайт пароль не хранит, правила сессии (30 минут бездействия, 8 часов) не меняются.

import { useEffect, useRef, useState } from "react";

const KEY = "gavko_remember";

type PwdCred = Credential & { password?: string; id: string };
type PwdCtor = new (form: HTMLFormElement) => Credential;

export function LoginForm({ action }: { action: (f: FormData) => void | Promise<void> }) {
  const form = useRef<HTMLFormElement>(null);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    let on = false;
    try {
      on = localStorage.getItem(KEY) === "1";
    } catch {}
    setRemember(on);
    if (!on || !("PasswordCredential" in window) || !form.current) return;
    navigator.credentials
      .get({ password: true, mediation: "optional" } as CredentialRequestOptions)
      .then((c) => {
        const cred = c as PwdCred | null;
        const f = form.current;
        if (!cred || !cred.password || !f) return;
        (f.elements.namedItem("login") as HTMLInputElement).value = cred.id;
        (f.elements.namedItem("password") as HTMLInputElement).value = cred.password;
      })
      .catch(() => {});
  }, []);

  return (
    <form
      ref={form}
      action={action}
      className="adm-form"
      onSubmit={(e) => {
        try {
          if (remember) localStorage.setItem(KEY, "1");
          else localStorage.removeItem(KEY);
        } catch {}
        const P = (window as unknown as { PasswordCredential?: PwdCtor }).PasswordCredential;
        if (remember && P) navigator.credentials.store(new P(e.currentTarget)).catch(() => {});
      }}
    >
      <label className="fld"><span className="label">Логин</span><input name="login" id="login" autoComplete="username" required maxLength={64} /></label>
      <label className="fld"><span className="label">Пароль</span><input name="password" id="password" type="password" autoComplete="current-password" required maxLength={200} /></label>
      <label className="adm-check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Запомнить меня на этом компьютере
      </label>
      <button className="btn" type="submit">Войти</button>
    </form>
  );
}
