// Создаёт таблицы и заполняет базовые данные. Безопасно запускать повторно.
//   npm run db:setup
// Тестовые учётные записи получают пароль из DEMO_PASSWORD (.env), см. .env.example.

import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { getDb } from "../src/lib/db";
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS, DEMO_USERS } from "../db/seed/roles";
import { BRANCHES, APPROX_COORDS } from "../db/seed/branches";
import { DEMO_FUNDS, DEMO_DOCS, demoImage } from "../db/seed/catalog";
import { DEMO_EXHIBITIONS, DEMO_COLLECTIONS } from "../db/seed/showcase";
import { EXTRA_PAGES, NEWS_CATEGORIES, DEMO_NEWS } from "../db/seed/pages";
import { putFile } from "../src/lib/storage";

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

  // примерные координаты для карты; подтверждённые архивом (coords_verified) не трогаем
  for (const [slug, [lat, lng]] of Object.entries(APPROX_COORDS)) {
    await db.query(`update branches set lat = $2, lng = $3 where slug = $1 and lat is null and not coords_verified`, [slug, lat, lng]);
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

  await seedFunds();
  await seedDemoCatalog();
  await seedChronicle();
  await seedShowcase();
  await seedPagesAndNews();

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

type FundJson = {
  number: string; title: string; names: { dates: string | null; name: string }[]; kind: string; secret: boolean;
  year_from: number | null; year_to: number | null; units_text: string | null; cases_count: number | null;
  first_received: string | null; ownership: string | null; category: string | null; note: string | null; source: string;
};

async function mainBranchId() {
  const db = await getDb();
  return (await db.query<{ id: number }>(`select id from branches where is_main limit 1`))[0].id;
}

// Перечень фондов архива (перенос со старого сайта, ТЗ 11). Секретные фонды не публикуются.
async function seedFunds() {
  const db = await getDb();
  const have = (await db.query<{ n: number }>(`select count(*)::int as n from funds where not is_demo`))[0].n;
  if (have > 0) return;
  const file = path.join(process.cwd(), "db", "seed", "data", "funds-2018.json");
  const funds: FundJson[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const branch = await mainBranchId();
  await db.tx(async (query) => {
    for (const f of funds) {
      await query(
        `insert into funds(branch_id, fund_number, kind, title, year_from, year_to, cases_count, publish_status, status,
                           names, names_text, units_text, first_received, ownership, fund_category, note, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'published',$9,$10,$11,$12,$13,$14,$15,$16)
         on conflict (branch_id, fund_number) do nothing`,
        [
          branch, f.number, f.kind, { ru: f.title }, f.year_from, f.year_to, f.cases_count,
          f.secret ? "no_publish" : "public",
          JSON.stringify(f.names), f.names.map((n) => n.name).join(" "), f.units_text, f.first_received,
          f.ownership, f.category, f.note, f.source,
        ],
      );
    }
  });
  console.log(`  фонды: ${funds.length} (секретных, не публикуются: ${funds.filter((f) => f.secret).length})`);
}

async function seedDemoCatalog() {
  const db = await getDb();
  const branch = await mainBranchId();
  const fundIds: Record<string, number> = {};
  for (const f of DEMO_FUNDS) {
    await db.query(
      `insert into funds(branch_id, fund_number, kind, title, year_from, year_to, publish_status, status, is_demo, source, annotation)
       values ($1,$2,'organization',$3,$4,$5,'public','published',true,'Демонстрационные данные',$6)
       on conflict (branch_id, fund_number) do nothing`,
      [branch, f.number, f.title, f.year_from, f.year_to, { ru: "Демонстрационный фонд для показа возможностей каталога. Записи и шифры условные." }],
    );
    fundIds[f.number] = (await db.query<{ id: number }>(`select id from funds where branch_id = $1 and fund_number = $2`, [branch, f.number]))[0].id;
  }

  let added = 0;
  for (const [i, d] of DEMO_DOCS.entries()) {
    const fundId = fundIds[d.fund];
    const invTitle = DEMO_FUNDS.find((f) => f.number === d.fund)!.inv;
    await db.query(
      `insert into inventories(fund_id, number, title, publish_status, status, is_demo) values ($1,$2,$3,'public','published',true)
       on conflict (fund_id, number) do nothing`,
      [fundId, d.inv, { ru: d.inv === "1" ? invTitle : `${invTitle}, опись ${d.inv}` }],
    );
    const invId = (await db.query<{ id: number }>(`select id from inventories where fund_id = $1 and number = $2`, [fundId, d.inv]))[0].id;
    await db.query(
      `insert into cases(inventory_id, number, title, publish_status, status, is_demo) values ($1,$2,$3,'public','published',true)
       on conflict (inventory_id, number) do nothing`,
      [invId, d.case, { ru: d.case_title }],
    );
    const caseId = (await db.query<{ id: number }>(`select id from cases where inventory_id = $1 and number = $2`, [invId, d.case]))[0].id;
    const docBranch = d.branch
      ? (await db.query<{ id: number }>(`select id from branches where slug = $1`, [d.branch]))[0]?.id ?? branch
      : branch;
    const i18n = { kk: d.title.kk ? "machine" : "none", en: d.title.en ? "machine" : "none" };
    const rows = await db.query<{ id: number }>(
      `insert into documents(uid, fund_id, case_id, branch_id, cipher, title, description, doc_type, date_text, year_from, year_to,
                             date_uncertain, author, place, provenance, i18n_status, publish_status, status, is_demo, published_at)
       values (md5('demo:' || $1::text)::uuid, $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Демонстрационные данные',$15,$16,$17,true,
               case when $17 = 'published' then now() end)
       on conflict (uid) do nothing returning id`,
      [d.key, fundId, caseId, docBranch, `${d.fund}, оп. ${d.inv}, д. ${d.case}`, d.title, d.description, d.doc_type, d.date_text,
       d.year_from, d.year_to, d.date_uncertain ?? false, d.author ?? null, d.place ?? null, i18n, d.publish ?? "public", d.status ?? "published"],
    );
    if (!rows.length) continue;
    added++;
    for (let p = 1; p <= (d.pages ?? 0); p++) {
      const key = `demo/${d.key}/p${p}.svg`;
      const meta = await putFile(key, Buffer.from(demoImage(d, p, i + 1)));
      const f = await db.query<{ id: number }>(
        `insert into digital_files(kind, storage_key, original_name, mime, size_bytes, sha256, width, height, access, provenance, rights_note, is_demo)
         values ('master',$1,$2,'image/svg+xml',$3,$4,1200,$5,$6,'Сгенерированное демо-изображение, не скан документа','Демо-данные проекта',true)
         on conflict (storage_key) do update set sha256 = excluded.sha256 returning id`,
        [key, `${d.key}-p${p}.svg`, meta.size, meta.sha256, d.doc_type === "photo" ? 860 : 1600, d.file_access ?? "public"],
      );
      await db.query(`insert into document_files(document_id, file_id, sort) values ($1,$2,$3) on conflict do nothing`, [rows[0].id, f[0].id, p]);
    }
  }
  if (added) console.log(`  демо-документы: ${added}`);
}

// Хронология из календарей памятных дат (scripts/convert/calendar_from_docx.py)
async function seedChronicle() {
  const db = await getDb();
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "db", "seed", "data", "chronicle-events.json"), "utf8")) as {
    themes: { key: string; label: string }[];
    events: { year: number; month: number | null; day: number | null; date_text: string; text: string; theme: string; sources: string[] }[];
  };
  // календарь памятных дат: месяц, день и годы календарей (заполняется и для уже загруженных событий)
  const fill = async () => {
    for (const [i, e] of data.events.entries()) {
      await db.query(`update historical_events set month = $2, day = $3, calendar_years = $4 where slug = $1 and month is null and day is null and calendar_years = '{}'`, [
        `ev-${e.year}-${i}`, e.month, e.day, e.sources.map(Number),
      ]);
    }
  };
  if ((await db.query<{ n: number }>(`select count(*)::int n from historical_events`))[0].n > 0) {
    await fill();
    return;
  }
  for (const [i, t] of data.themes.entries()) {
    await db.query(`insert into categories(kind, slug, name, sort) values ('chronicle',$1,$2,$3) on conflict (kind, slug) do nothing`, [t.key, { ru: t.label }, i]);
  }
  const cats = new Map((await db.query<{ id: number; slug: string }>(`select id, slug from categories where kind = 'chronicle'`)).map((c) => [c.slug, c.id]));
  await db.tx(async (query) => {
    for (const [i, e] of data.events.entries()) {
      await query(
        `insert into historical_events(slug, title, date_text, year, category_id, sources, status) values ($1,$2,$3,$4,$5,$6,'published') on conflict (slug) do nothing`,
        [`ev-${e.year}-${i}`, { ru: e.text }, e.date_text, e.year, cats.get(e.theme) ?? null,
         `Календарь юбилейных и памятных дат ВКО на ${e.sources.join(", ")} год (материалы архива)`],
      );
    }
  });
  await fill();
  console.log(`  события хронологии: ${data.events.length}`);
}

async function seedShowcase() {
  const db = await getDb();
  const docId = async (key: string) =>
    (await db.query<{ id: number; file: number | null }>(
      `select d.id, (select x.file_id from document_files x where x.document_id = d.id order by x.sort limit 1) as file from documents d where d.uid = md5('demo:' || $1::text)::uuid`,
      [key],
    ))[0];
  for (const ex of DEMO_EXHIBITIONS) {
    const r = await db.query<{ id: number }>(
      `insert into exhibitions(slug, title, description, status, is_demo, published_at) values ($1,$2,$3,'published',true,now()) on conflict (slug) do nothing returning id`,
      [ex.slug, ex.title, ex.description],
    );
    if (!r.length) continue;
    for (const [i, it] of ex.items.entries()) {
      const d = await docId(it.doc);
      if (!d) continue;
      const doc = (await db.query<{ title: { ru: string }; cipher: string }>(`select title, cipher from documents where id = $1`, [d.id]))[0];
      await db.query(
        `insert into exhibits(exhibition_id, title, caption, source, document_id, file_id, rights_checked, sort) values ($1,$2,$3,$4,$5,$6,true,$7)`,
        [r[0].id, doc.title, { ru: it.caption }, doc.cipher, d.id, d.file, i],
      );
    }
  }
  for (const c of DEMO_COLLECTIONS) {
    const r = await db.query<{ id: number }>(
      `insert into collections(slug, title, summary, editorial_note, status, is_demo, published_at) values ($1,$2,$3,$4,'published',true,now()) on conflict (slug) do nothing returning id`,
      [c.slug, c.title, c.summary, c.editorial],
    );
    if (!r.length) continue;
    for (const [i, it] of c.items.entries()) {
      if ("doc" in it) {
        const d = await docId(it.doc);
        if (!d) continue;
        const cipher = (await db.query<{ cipher: string }>(`select cipher from documents where id = $1`, [d.id]))[0].cipher;
        await db.query(`insert into collection_items(collection_id, item_type, item_id, body, source, sort) values ($1,'document',$2,$3,$4,$5)`, [
          r[0].id, d.id, it.note ? { ru: it.note } : null, cipher, i,
        ]);
      } else {
        const ev = (await db.query<{ id: number; sources: string }>(`select id, sources from historical_events where title->>'ru' ilike $1 limit 1`, [`%${it.eventLike}%`]))[0];
        if (!ev) continue;
        await db.query(`insert into collection_items(collection_id, item_type, item_id, body, source, sort) values ($1,'event',$2,$3,$4,$5)`, [
          r[0].id, ev.id, it.note ? { ru: it.note } : null, ev.sources, i,
        ]);
      }
    }
  }
}

async function seedPagesAndNews() {
  const db = await getDb();
  const fromDocs = JSON.parse(fs.readFileSync(path.join(process.cwd(), "db", "seed", "data", "pages.json"), "utf8")) as typeof EXTRA_PAGES;
  for (const [i, p] of [...fromDocs, ...EXTRA_PAGES].entries()) {
    await db.query(
      `insert into pages(slug, section, title, body, source, status, sort) values ($1,'about',$2,$3,$4,'published',$5) on conflict (slug) do nothing`,
      [p.slug, { ru: p.title }, { ru: p.body }, p.source, i],
    );
  }
  for (const [i, c] of NEWS_CATEGORIES.entries()) {
    await db.query(`insert into categories(kind, slug, name, sort) values ('news',$1,$2,$3) on conflict (kind, slug) do nothing`, [c.slug, c.name, i]);
  }
  for (const n of DEMO_NEWS) {
    await db.query(
      `insert into news(slug, title, summary, body, category_id, status, is_demo, published_at, created_at)
       values ($1,$2,$3,$4,(select id from categories where kind = 'news' and slug = $5),'published',true,$6::date + time '10:00',$6::date + time '10:00')
       on conflict (slug) do nothing`,
      [n.slug, n.title, n.summary, n.body, n.category, n.date],
    );
  }
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
