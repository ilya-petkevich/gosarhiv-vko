// Строка поиска на главной: вкладка определяет, куда вести.
import { redirect } from "next/navigation";

export default async function Search({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { lang } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 200);
  const qs = q ? `q=${encodeURIComponent(q)}` : "";
  if (sp.mode === "ask") redirect(`/${lang}/assistant${qs ? `?${qs}` : ""}`);
  redirect(`/${lang}/catalog${qs ? `?${qs}` : ""}`);
}
