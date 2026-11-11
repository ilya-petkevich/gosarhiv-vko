// Подключение к базе при старте сервера, а не на первом запросе:
// встроенный PostgreSQL (PGlite) загружается заранее и не мешает отдаче первой страницы.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    await getDb();
  }
}
