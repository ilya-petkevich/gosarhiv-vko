// Хранилище файлов.
// - Локально и в Docker — папка на диске (.data/files или FILES_DIR).
// - На стенде (Vercel) — закрытый бакет Supabase Storage: задайте SUPABASE_URL, SUPABASE_SERVICE_KEY
//   и при желании SUPABASE_BUCKET (по умолчанию archive-files). Бакет создаётся сам, закрытым.
// Файлы никогда не отдаются из хранилища напрямую: только через /api/files/[id] с проверкой прав.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.env.FILES_DIR || path.join(process.cwd(), ".data", "files");
const SB_URL = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "archive-files";
export const STORAGE_KIND = SB_URL && SB_KEY ? "supabase" : "disk";

function checkKey(key: string) {
  if (!/^[\w./-]+$/.test(key) || key.includes("..")) throw new Error("bad storage key");
}

const MIME: Record<string, string> = { svg: "image/svg+xml", jpg: "image/jpeg", png: "image/png", webp: "image/webp", tif: "image/tiff", pdf: "application/pdf" };

let bucketReady: Promise<void> | null = null;
function ensureBucket() {
  bucketReady ??= (async () => {
    const r = await fetch(`${SB_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
    });
    // 400/409 — бакет уже есть
    if (!r.ok && r.status !== 400 && r.status !== 409) throw new Error(`storage bucket: ${r.status}`);
  })();
  return bucketReady;
}

export async function putFile(key: string, data: Buffer) {
  checkKey(key);
  const meta = { size: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex") };
  if (STORAGE_KIND === "supabase") {
    await ensureBucket();
    const ext = key.split(".").pop() ?? "";
    const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY!, "Content-Type": MIME[ext] ?? "application/octet-stream", "x-upsert": "true" },
      body: new Uint8Array(data),
    });
    if (!r.ok) throw new Error(`storage put: ${r.status}`);
    return meta;
  }
  const p = path.join(ROOT, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
  return meta;
}

export async function readFile(key: string): Promise<Buffer | null> {
  try {
    checkKey(key);
    if (STORAGE_KIND === "supabase") {
      const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${key}`, { headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY! } });
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    }
    return await fs.readFile(path.join(ROOT, key));
  } catch {
    return null;
  }
}
