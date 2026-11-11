// Вход сотрудников (ТЗ 6, 7.3).
// - пароли — bcrypt; в базе хранится только хэш токена сессии;
// - cookie httpOnly, SameSite=Lax, Secure на HTTPS;
// - после 5 неудачных попыток вход блокируется на 15 минут;
// - выход по бездействию через 30 минут и не позже 8 часов после входа;
// - каждая попытка входа пишется в журнал (без паролей).

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { q } from "./db";

export const COOKIE = "gavko_admin";
const IDLE_MIN = 30;
const MAX_HOURS = 8;
const MAX_FAILS = 5;
const LOCK_MIN = 15;
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

export type Staff = {
  id: string;
  login: string;
  full_name: string;
  branch_id: number | null;
  roles: string[];
  perms: Set<string>;
};

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
}

export async function audit(
  user: { id: string; login: string } | null,
  action: string,
  objectType: string | null,
  objectId: string | number | null,
  result: "ok" | "denied" | "error",
  details?: Record<string, unknown>,
) {
  await q(
    `insert into audit_log(user_id, user_login, action, object_type, object_id, result, details, ip) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [user?.id ?? null, user?.login ?? null, action, objectType, objectId == null ? null : String(objectId), result, details ?? null, await clientIp()],
  );
}

export async function login(loginRaw: string, password: string): Promise<"ok" | "bad" | "locked"> {
  const loginName = loginRaw.trim().toLowerCase().slice(0, 64);
  const rows = await q<{ id: string; login: string; password_hash: string; is_active: boolean; failed_attempts: number; locked_until: string | null }>(
    `select id, login, password_hash, is_active, failed_attempts, locked_until from users where lower(login) = $1`,
    [loginName],
  );
  const u = rows[0];
  if (!u) {
    await bcrypt.compare(password, DUMMY_HASH); // одинаковое время ответа для существующих и несуществующих логинов
    await audit(null, "login", "user", loginName, "denied", { reason: "unknown_login" });
    return "bad";
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    await audit(u, "login", "user", u.id, "denied", { reason: "locked" });
    return "locked";
  }
  const ok = u.is_active && (await bcrypt.compare(password, u.password_hash));
  if (!ok) {
    const fails = u.failed_attempts + 1;
    await q(
      `update users set failed_attempts = $2::int, locked_until = case when $2::int >= $3::int then now() + ($4::text || ' minutes')::interval else locked_until end where id = $1`,
      [u.id, fails, MAX_FAILS, String(LOCK_MIN)],
    );
    await audit(u, "login", "user", u.id, "denied", { reason: u.is_active ? "bad_password" : "inactive", attempt: fails });
    return fails >= MAX_FAILS ? "locked" : "bad";
  }
  await q(`update users set failed_attempts = 0, locked_until = null, last_login_at = now() where id = $1`, [u.id]);
  const token = crypto.randomBytes(32).toString("base64url");
  const h = await headers();
  await q(
    `insert into sessions(id, user_id, expires_at, ip, user_agent) values ($1,$2, now() + ($3 || ' hours')::interval, $4, $5)`,
    [sha(token), u.id, String(MAX_HOURS), await clientIp(), (h.get("user-agent") ?? "").slice(0, 200)],
  );
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_HOURS * 3600,
  });
  await audit(u, "login", "user", u.id, "ok");
  return "ok";
}

export async function logout() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  const user = await currentStaff();
  if (token) await q(`delete from sessions where id = $1`, [sha(token)]);
  c.delete(COOKIE);
  if (user) await audit(user, "logout", "user", user.id, "ok");
}

export async function currentStaff(): Promise<Staff | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const rows = await q<{ id: string; login: string; full_name: string; branch_id: number | null; is_active: boolean; idle: boolean }>(
    `select u.id, u.login, u.full_name, u.branch_id, u.is_active,
            s.last_seen_at < now() - ($2 || ' minutes')::interval as idle
     from sessions s join users u on u.id = s.user_id
     where s.id = $1 and s.expires_at > now()`,
    [sha(token), String(IDLE_MIN)],
  );
  const u = rows[0];
  if (!u || !u.is_active || u.idle) {
    if (u) await q(`delete from sessions where id = $1`, [sha(token)]);
    return null;
  }
  await q(`update sessions set last_seen_at = now() where id = $1 and last_seen_at < now() - interval '1 minute'`, [sha(token)]);
  const roles = (await q<{ role_code: string }>(`select role_code from user_roles where user_id = $1`, [u.id])).map((r) => r.role_code);
  const perms = new Set(
    (await q<{ perm_code: string }>(`select distinct rp.perm_code from user_roles ur join role_permissions rp on rp.role_code = ur.role_code where ur.user_id = $1`, [u.id])).map(
      (r) => r.perm_code,
    ),
  );
  return { id: u.id, login: u.login, full_name: u.full_name, branch_id: u.branch_id, roles, perms };
}

export const can = (u: Staff | null, ...perms: string[]) => !!u && perms.some((p) => u.perms.has(p));
