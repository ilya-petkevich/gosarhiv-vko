// Вопрос помощнику «Ахмет». Принимает только запросы со своего сайта.
// IP используется лишь для ограничения частоты в памяти (как хэш) и нигде не сохраняется.

import crypto from "node:crypto";
import { ask } from "@/lib/akhmet";
import { isLang } from "@/i18n/dict";

const SALT = crypto.randomBytes(16).toString("hex");

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { q?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const question = typeof body.q === "string" ? body.q.trim() : "";
  const lang = typeof body.lang === "string" && isLang(body.lang) ? body.lang : "ru";
  if (question.length < 2) return Response.json({ error: "empty" }, { status: 400 });
  if (question.length > 500) return Response.json({ error: "too long" }, { status: 413 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const ipKey = crypto.createHash("sha256").update(SALT + ip).digest("hex").slice(0, 16);
  const answer = await ask(question, lang, ipKey);
  return Response.json(answer, { headers: { "Cache-Control": "no-store" } });
}
