// Ссылка на ролик → адрес для встраивания. Только известные видеохостинги и https; иначе — просто ссылка.
export function videoEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.replace(/^www\.|^m\./, "");
  if (h === "youtu.be") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
  if (h === "youtube.com") {
    const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (h === "vimeo.com") {
    const id = u.pathname.match(/^\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (h === "rutube.ru") {
    const id = u.pathname.match(/^\/video\/([\w]+)/)?.[1];
    return id ? `https://rutube.ru/play/embed/${id}` : null;
  }
  return null;
}

export const isVideoUrl = (url: string) => /^https:\/\/\S+$/.test(url) && url.length <= 300;
