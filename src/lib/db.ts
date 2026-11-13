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
  const statementMs = Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15000);
  const open = () =>
    postgres(url, {
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
      connection: { statement_timeout: statementMs },
    });
  let sql = open();

  // После простоя (функция была заморожена) старые соединения почти наверняка мертвы:
  // пул открывается заново до запроса, а не после 20 с ожидания.
  const staleMs = Number(process.env.DB_STALE_MS || 4000);
  let lastUsed = Date.now();
  let inFlight = 0;
  const fresh = () => {
    const now = Date.now();
    if (inFlight === 0 && now - lastUsed > staleMs) {
      const old = sql;
      sql = open();
      old.end({ timeout: 0 }).catch(() => {});
    }
    lastUsed = now;
  };

  // Vercel замораживает функцию между запросами; пулер за это время рвёт простаивающее соединение,
  // и запрос в «мёртвый» сокет ждал ответа до лимита функции (300 с). Поэтому — свой таймаут:
  // зависшее соединение сбрасывается вместе с пулом, запрос на чтение повторяется один раз на новом.
  // обрыв соединения (пулер закрыл сокет, пул сброшен соседним запросом) — чтение можно повторить
  const retryable = (e: unknown) =>
    ["DB_STALL", "CONNECTION_DESTROYED", "CONNECTION_CLOSED", "CONNECTION_ENDED", "ECONNRESET", "EPIPE"].includes(
      String((e as { code?: string }).code),
    );
  const clientMs = statementMs + 5000;
  const guard = async <T,>(run: (s: typeof sql) => Promise<T>, ms: number): Promise<T> => {
    fresh();
    inFlight++;
    const cur = sql;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        run(cur),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Object.assign(new Error("db: нет ответа от базы"), { code: "DB_STALL" })), ms);
        }),
      ]);
    } catch (e) {
      if (retryable(e) && sql === cur) {
        console.error(`db: ${(e as { code?: string }).code} — пул пересоздан`);
        sql = open();
        // соседние запросы на старом пуле не обрываются сразу — им даётся 5 с
        cur.end({ timeout: 5 }).catch(() => {});
      }
      throw e;
    } finally {
      clearTimeout(timer);
      inFlight--;
      lastUsed = Date.now();
    }
  };
  const readOnly = (text: string) => /^\s*select\b/i.test(text);
  // чтения короткие: зависший сокет распознаётся за 8 с, а не за 20
  const readMs = Number(process.env.DB_READ_STALL_MS || 8000);

  return {
    kind: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      const run = (s: typeof sql) => s.unsafe(text, params as never[]) as unknown as Promise<T[]>;
      if (!readOnly(text)) return guard(run, clientMs);
      try {
        return await guard(run, readMs);
      } catch (e) {
        if (!retryable(e)) throw e;
        return guard(run, clientMs);
      }
    },
    async exec(text: string) {
      await guard((s) => s.unsafe(text) as unknown as Promise<unknown>, clientMs * 4);
    },
    async tx<T>(fn: (q: Db["query"]) => Promise<T>) {
      return guard(
        (s) =>
          s.begin(async (t) =>
            fn(async <R,>(text: string, params: unknown[] = []) => (await t.unsafe(text, params as never[])) as unknown as R[]),
          ) as Promise<T>,
        clientMs * 2,
      );
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
