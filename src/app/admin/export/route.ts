// Выгрузка описаний каталога в CSV (ТЗ 6.3). Только разрешённые данные (доп. ТЗ 3.5):
// записи с открытым описанием, без закрытых файлов и сведений о сотрудниках.

import { currentStaff, can, audit } from "@/lib/auth";
import { q } from "@/lib/db";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // защита от формул при открытии в Excel
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET() {
  const u = await currentStaff();
  if (!u) return new Response("Unauthorized", { status: 401 });
  if (!can(u, "catalog.export")) {
    await audit(u, "catalog.export", "document", null, "denied");
    return new Response("Forbidden", { status: 403 });
  }
  const rows = await q<Record<string, unknown>>(
    `select d.cipher, d.title->>'ru' title_ru, d.title->>'kk' title_kk, d.title->>'en' title_en, d.date_text, d.year_from, d.year_to,
            d.doc_type, d.place, d.description->>'ru' description_ru, f.fund_number, d.status
     from documents d join funds f on f.id = d.fund_id
     where d.publish_status = 'public' and d.status = 'published' and f.publish_status = 'public' order by f.fund_number, d.cipher`,
  );
  const head = ["Шифр", "Название", "Название (қаз)", "Название (eng)", "Дата", "Год с", "Год по", "Вид", "Место", "Описание", "Фонд", "Статус"];
  const keys = ["cipher", "title_ru", "title_kk", "title_en", "date_text", "year_from", "year_to", "doc_type", "place", "description_ru", "fund_number", "status"];
  const csv = "﻿" + [head.join(";"), ...rows.map((r) => keys.map((k) => cell(r[k])).join(";"))].join("\r\n");
  await audit(u, "catalog.export", "document", null, "ok", { rows: rows.length });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gavko-catalog-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
