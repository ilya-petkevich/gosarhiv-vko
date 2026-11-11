// Адреса без языка (/, /catalog …) ведут на выбранный язык: из cookie, иначе русский.

import { NextResponse, type NextRequest } from "next/server";
import { LANGS, DEFAULT_LANG } from "@/i18n/dict";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const first = pathname.split("/")[1];
  if ((LANGS as readonly string[]).includes(first)) return NextResponse.next();
  const c = req.cookies.get("lang")?.value;
  const lang = c && (LANGS as readonly string[]).includes(c) ? c : DEFAULT_LANG;
  const url = req.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|img|docs|uploads|favicon.ico|robots.txt|sitemap.xml).*)"],
};
