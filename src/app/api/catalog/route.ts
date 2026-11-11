// Открытый API каталога: те же правила доступа, что и на страницах.
// GET /api/catalog?q=…&tab=docs|funds&doc_type=&from=&to=&fund=&branch=&copy=1&page=

import { searchDocuments, searchFunds } from "@/lib/catalog";

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const int = (k: string) => (/^\d{3,4}$/.test(u.get(k) ?? "") ? Number(u.get(k)) : undefined);
  const f = {
    q: (u.get("q") ?? "").slice(0, 200),
    docType: u.get("doc_type") ?? undefined,
    from: int("from"),
    to: int("to"),
    fund: u.get("fund") ?? undefined,
    branch: u.get("branch") ?? undefined,
    copy: u.get("copy") === "1",
    kind: u.get("kind") === "personal" ? "personal" : undefined,
    page: Math.min(500, Number(u.get("page")) || 1),
  };
  const r = u.get("tab") === "funds" ? await searchFunds(f) : await searchDocuments(f);
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
