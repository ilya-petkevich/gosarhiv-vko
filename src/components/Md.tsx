// Простая безопасная разметка текстов страниц и новостей: абзацы, «## » подзаголовки, «- » списки,
// **жирный**, [текст](адрес). HTML из текста не вставляется — только React-элементы.
// Ссылки — только на свой сайт, http(s), tel: и mailto:.

import Link from "next/link";
import type { ReactNode } from "react";

function inline(text: string, lang: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<b key={`${key}-${i++}`}>{m[1]}</b>);
    else {
      let href = m[3];
      const label = m[2];
      if (href.startsWith("/ru/")) href = `/${lang}/${href.slice(4)}`;
      if (href.startsWith("/") && !href.startsWith("//")) {
        out.push(href.startsWith("/docs/") ? <a key={`${key}-${i++}`} href={href} target="_blank" rel="noopener">{label}</a> : <Link key={`${key}-${i++}`} href={href}>{label}</Link>);
      } else if (/^(https?:|tel:|mailto:)/.test(href)) {
        out.push(<a key={`${key}-${i++}`} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>{label}</a>);
      } else out.push(label);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ text, lang }: { text: string; lang: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(<ul key={`ul-${out.length}`}>{list.map((x, i) => <li key={i}>{inline(x, lang, `li${out.length}-${i}`)}</li>)}</ul>);
      list = [];
    }
  };
  blocks.forEach((b, k) => {
    if (b.startsWith("- ")) {
      list.push(...b.split(/\n(?=- )/).map((x) => x.replace(/^- /, "")));
      return;
    }
    flush();
    if (b.startsWith("## ")) out.push(<h2 key={k} className="h3">{b.slice(3)}</h2>);
    else out.push(<p key={k}>{inline(b.replace(/\n/g, " "), lang, `p${k}`)}</p>);
  });
  flush();
  return <div className="md">{out}</div>;
}
