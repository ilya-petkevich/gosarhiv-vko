// Приём отметки просмотра раздела (ТЗ 5.8 Д). Хранится только раздел, язык и тип события — без IP и cookie.
import { track } from "@/lib/analytics";

export async function POST(req: Request) {
  let data: { path?: unknown; event?: unknown } = {};
  try {
    data = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const path = typeof data.path === "string" ? data.path : "";
  const m = path.match(/^\/(kk|ru|en)(?:\/([a-z-]{1,30}))?/);
  const event = data.event === "not_found" ? "not_found" : "view";
  if (m) track(event, `/${m[2] ?? ""}`, m[1], event === "not_found" ? path.slice(0, 120) : null);
  return new Response(null, { status: 204 });
}
