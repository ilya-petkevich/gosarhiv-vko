// Доступ к базе.
// DATABASE_URL задан → обычный PostgreSQL (Supabase, Docker, свой сервер).
// Не задан → встроенный PostgreSQL (PGlite) в папке .data/pglite: проект запускается без установки базы.
// Все запросы параметризованы ($1, $2 …), строки в SQL не склеиваются.

import path from "node:path";
import fs from "node:fs";

type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
  tx<T>(fn: (q: Db["query"]) => Promise<T>): Promise<T>;
  kind: "postgres" | "pglite";
}

async function makePglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const pg = await PGlite.create({ dataDir: dir, extensions: { pg_trgm } });
  return {
    kind: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query(text, params)).rows as T[];
    },
    async exec(text: string) {
      await pg.exec(text);
    },
    async tx<T>(fn: (q: Db["query"]) => Promise<T>) {
      return pg.transaction(async (t) =>
        fn(async <R,>(text: string, params: unknown[] = []) => (await t.query(text, params)).rows as R[]),
      );
    },
  };
}

async function makePostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    max: Number(process.env.DB_POOL_MAX || 5),
    // пулер Supabase (transaction mode) не поддерживает подготовленные запросы
    prepare: false,
    // шифрование, если сервер его поддерживает (Supabase — да, локальный Docker — нет); DB_SSL=require — строго
    ssl: (process.env.DB_SSL as "require" | "prefer" | undefined) ?? (/@(localhost|127\.0\.0\.1|db)[:/]/.test(url) ? false : "prefer"),
    onnotice: () => {},
    // бессерверная среда: не держать простаивающие соединения (пулер может их оборвать) и не ждать вечно
    idle_timeout: Number(process.env.DB_IDLE_TIMEOUT || 20),
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    connection: { statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15000) },
  });
  return {
    kind: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as never[])) as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text);
    },
    async tx<T>(fn: (q: Db["query"]) => Promise<T>) {
      return sql.begin(async (t) =>
        fn(async <R,>(text: string, params: unknown[] = []) => (await t.unsafe(text, params as never[])) as unknown as R[]),
      ) as Promise<T>;
    },
  };
}

const g = globalThis as unknown as { __gavkoDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__gavkoDb) {
    const url = process.env.DATABASE_URL;
    g.__gavkoDb = url ? makePostgres(url) : makePglite();
  }
  return g.__gavkoDb;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await getDb()).query<T>(text, params);
}
