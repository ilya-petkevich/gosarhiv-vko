// Создаёт таблицы и заполняет базовые данные. Безопасно запускать повторно.
//   npm run db:setup
// Тестовые учётные записи получают пароль из DEMO_PASSWORD (.env), см. .env.example.

import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { getDb } from "../src/lib/db";
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS, DEMO_USERS } from "../db/seed/roles";
import { BRANCHES } from "../db/seed/branches";

async function migrate() {
  const db = await getDb();
  await db.exec(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await db.query<{ name: string }>(`select name from schema_migrations`)).map((r) => r.name));
  const dir = path.join(process.cwd(), "db", "migrations");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    if (!/^[\w.-]+$/.test(file)) throw new Error(`Недопустимое имя миграции: ${file}`);
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    // миграция целиком в одной транзакции: при ошибке база остаётся как была
    await db.exec(`begin;\n${sql}\n;insert into schema_migrations(name) values ('${file}');\ncommit;`);
    console.log(`  миграция ${file}`);
  }
}

async function seed() {
  const db = await getDb();

  for (const p of PERMISSIONS) {
    await db.query(`insert into permissions(code, description) values ($1,$2) on conflict (code) do update set description = excluded.description`, [p.code, p.description]);
  }
  for (const [i, r] of ROLES.entries()) {
    await db.query(
      `insert into roles(code, name, description, sort) values ($1,$2,$3,$4)
       on conflict (code) do update set name = excluded.name, description = excluded.description, sort = excluded.sort`,
      [r.code, r.name, r.description, i],
    );
  }
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    for (const perm of perms) {
      await db.query(`insert into role_permissions(role_code, perm_code) values ($1,$2) on conflict do nothing`, [role, perm]);
    }
  }

  for (const [i, b] of BRANCHES.entries()) {
    await db.query(
      `insert into branches(slug, name, short_name, address, phone, email, hours, lat, lng, coords_verified, is_main, data_source, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11,$12)
       on conflict (slug) do nothing`,
      [b.slug, b.name, b.short_name, b.address, b.phone, b.email ?? null, b.hours ?? null, b.lat ?? null, b.lng ?? null, b.is_main ?? false, b.source, i],
    );
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.log("  DEMO_PASSWORD не задан — тестовые учётные записи не созданы");
  } else {
    const hash = await bcrypt.hash(password, 12);
    for (const u of DEMO_USERS) {
      const branch = u.branch
        ? (await db.query<{ id: number }>(`select id from branches where slug = $1`, [u.branch]))[0]?.id ?? null
        : null;
      const rows = await db.query<{ id: string }>(
        `insert into users(login, full_name, password_hash, branch_id) values ($1,$2,$3,$4)
         on conflict (login) do update set full_name = excluded.full_name, branch_id = excluded.branch_id
         returning id`,
        [u.login, u.full_name, hash, branch],
      );
      await db.query(`insert into user_roles(user_id, role_code) values ($1,$2) on conflict do nothing`, [rows[0].id, u.role]);
    }
  }

  await db.query(
    `insert into site_settings(key, value) values ('contacts', $1) on conflict (key) do nothing`,
    [{
      phone: "8 (7232) 25-59-76",
      email: "arhiv-ukg@yandex.kz",
      hours: { ru: "Пн–Пт 8:00–17:00", kk: "Дс–Жм 8:00–17:00", en: "Mon–Fri 8:00–17:00" },
      reading_room: { ru: "читальный зал 9:00–16:00", kk: "оқу залы 9:00–16:00", en: "reading room 9:00–16:00" },
      source: "Контакты.docx (материалы заказчика)",
    }],
  );
}

(async () => {
  const db = await getDb();
  console.log(`База: ${db.kind === "pglite" ? "встроенная (PGlite, .data/pglite)" : "PostgreSQL (DATABASE_URL)"}`);
  await migrate();
  await seed();
  console.log("Готово.");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
