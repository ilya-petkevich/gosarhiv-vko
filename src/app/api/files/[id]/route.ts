// Отдача цифровых копий. Файл выдаётся, только если открыт сам файл и опубликована запись,
// к которой он привязан (доп. ТЗ 3.1). Иначе — 404 без подробностей: закрытый файл не выдаётся
// ни по прямой ссылке, ни перебором номеров.

import { getPublicFile } from "@/lib/catalog";
import { readFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) return new Response("Not found", { status: 404 });
  const meta = await getPublicFile(Number(id));
  if (!meta) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const data = await readFile(meta.storage_key);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": meta.mime,
      "Content-Length": String(data.length),
      ETag: `"${meta.sha256}"`,
      // доступ может закрыться в любой момент — кэшируем ненадолго
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      // SVG открывается изолированно, без выполнения скриптов; PDF показывает встроенный просмотрщик браузера
      ...(meta.mime === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" } : {}),
      "Content-Disposition": "inline",
      "X-Robots-Tag": "noindex",
    },
  });
}
