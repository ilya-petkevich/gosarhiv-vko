// Загрузка цифровых копий (ТЗ 7.7, доп. ТЗ 3.6).
// - тип определяется по содержимому файла (сигнатуре), а не по имени: JPEG, PNG, WebP, TIFF, PDF;
//   всё остальное (в том числе SVG, исполняемые файлы, архивы) отклоняется;
// - ограничение размера; мастер-копия хранится без изменений, с SHA-256;
// - для изображений создаётся облегчённая копия WebP (до 1600 px) — она и показывается на сайте;
// - новый файл закрыт по умолчанию («Требует проверки»), пока сотрудник не откроет доступ.

import sharp from "sharp";
import { putFile } from "./storage";
import { q } from "./db";

export const MAX_FILE_MB = Number(process.env.MAX_UPLOAD_MB || 25);
const TYPES = [
  { mime: "image/jpeg", ext: "jpg", test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b: Buffer) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { mime: "image/tiff", ext: "tif", test: (b: Buffer) => ["49492a00", "4d4d002a"].includes(b.subarray(0, 4).toString("hex")) },
  { mime: "application/pdf", ext: "pdf", test: (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
];

export function detectType(b: Buffer) {
  return TYPES.find((t) => b.length > 12 && t.test(b)) ?? null;
}

export type UploadResult = { name: string; ok: true; id: number } | { name: string; ok: false; error: string };

export async function saveUpload(docId: number, file: File, userId: string, sort: number): Promise<UploadResult> {
  const name = (file.name || "file").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
  if (file.size > MAX_FILE_MB * 1024 * 1024) return { name, ok: false, error: `больше ${MAX_FILE_MB} МБ` };
  if (file.size === 0) return { name, ok: false, error: "пустой файл" };
  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectType(buf);
  if (!type) return { name, ok: false, error: "формат не поддерживается (нужны JPEG, PNG, WebP, TIFF или PDF)" };

  let width: number | null = null;
  let height: number | null = null;
  let preview: Buffer | null = null;
  if (type.mime.startsWith("image/")) {
    try {
      const img = sharp(buf, { limitInputPixels: 300_000_000 });
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      preview = await img.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch {
      return { name, ok: false, error: "изображение повреждено или не читается" };
    }
  }

  const stamp = Date.now().toString(36);
  const master = await putFile(`docs/${docId}/${stamp}-master.${type.ext}`, buf);
  const m = await q<{ id: number }>(
    `insert into digital_files(kind, storage_key, original_name, mime, size_bytes, sha256, width, height, access, provenance, uploaded_by)
     values ('master',$1,$2,$3,$4,$5,$6,$7,'needs_check','Загружено в админке',$8) returning id`,
    [`docs/${docId}/${stamp}-master.${type.ext}`, name, type.mime, master.size, master.sha256, width, height, userId],
  );
  if (preview) {
    const pm = await sharp(preview).metadata();
    const p = await putFile(`docs/${docId}/${stamp}-preview.webp`, preview);
    await q(
      `insert into digital_files(master_id, kind, storage_key, original_name, mime, size_bytes, sha256, width, height, access, provenance, uploaded_by)
       values ($1,'preview',$2,$3,'image/webp',$4,$5,$6,$7,'needs_check','Облегчённая копия для просмотра',$8)`,
      [m[0].id, `docs/${docId}/${stamp}-preview.webp`, name, p.size, p.sha256, pm.width ?? null, pm.height ?? null, userId],
    );
  }
  await q(`insert into document_files(document_id, file_id, sort) values ($1,$2,$3)`, [docId, m[0].id, sort]);
  return { name, ok: true, id: m[0].id };
}
