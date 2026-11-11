// Хранилище файлов. Сейчас — папка на диске (.data/files); для стенда — S3-совместимое хранилище.
// Файлы никогда не отдаются напрямую: только через /api/files/[id] с проверкой прав.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.env.FILES_DIR || path.join(process.cwd(), ".data", "files");

function resolve(key: string) {
  if (!/^[\w./-]+$/.test(key) || key.includes("..")) throw new Error("bad storage key");
  return path.join(ROOT, key);
}

export async function putFile(key: string, data: Buffer) {
  const p = resolve(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
  return { size: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex") };
}

export async function readFile(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolve(key));
  } catch {
    return null;
  }
}
