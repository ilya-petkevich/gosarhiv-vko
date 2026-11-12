// Помощник «Ахмет»: голова-книга с антенной и закладкой. Состояния — глазами и ртом.
// anim — цикличная анимация: пока работает (flip, read, signal, nod) и пока ждёт (blink, look, sway).
// Стили анимаций — в globals.css (.kn-*), при «уменьшить движение» они выключаются.

export type Mood = "hello" | "think" | "found" | "sad";
export type KnAnim = "flip" | "read" | "signal" | "nod" | "blink" | "look" | "sway";
const INK = "#1F1A16";

function Eyes({ mood }: { mood: Mood }) {
  const d = (x: number, y: number) => <circle cx={x} cy={y} r={3.6} fill={INK} stroke="none" />;
  if (mood === "think") return <>{d(43, 55)}{d(73, 55)}</>;
  if (mood === "found") return <path d="M40 59q5-6 10 0M70 59q5-6 10 0" />;
  if (mood === "sad")
    return (
      <>
        {d(45, 60)}{d(75, 60)}
        <path d="M39 49l9 3M81 49l-9 3" strokeWidth={2.6} />
      </>
    );
  return <>{d(45, 58)}{d(75, 58)}</>;
}

export function Kniga({ size = 120, mood = "hello", title, anim }: { size?: number; mood?: Mood; title?: string; anim?: KnAnim }) {
  const sw = size > 40 ? 3 : 4.5;
  // «думает» — тоже с лёгкой улыбкой, чтобы не казался грустным
  const mouth = mood === "sad" ? "M56 71h8" : mood === "think" ? "M55 70q5 3 10 0" : "M54 70q6 4 12 0";
  return (
    <svg
      className={anim ? `kn kn-${anim}` : "kn"}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      style={{ flex: "none" }}
    >
      {title ? <title>{title}</title> : null}
      <circle cx={60} cy={60} r={58} fill="#fff" stroke={INK} strokeWidth={size > 40 ? 2.5 : 4} />
      {anim === "signal" ? (
        <g className="kn-arcs" stroke={INK} strokeWidth={2.4} strokeLinecap="round">
          <path d="M51 22a12 12 0 0 1 18 0" />
          <path d="M46 17a19 19 0 0 1 28 0" />
        </g>
      ) : null}
      <g className="kn-head" stroke={INK} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 42C50 36 38 36 30 40v42c8-4 20-4 30 2 10-6 22-6 30-2V40c-8-4-20-4-30 2z" fill="#fff" />
        <path d="M60 42v42" />
        {anim === "flip" ? <path className="kn-page" d="M60 42c10-6 22-6 30-2v42c-8-4-20-4-30 2z" fill="#fff" /> : null}
        <path d="M60 42V31" />
        <circle className="kn-ball" cx={60} cy={27} r={3.6} fill="#fff" />
        <g className="kn-eyes">
          <Eyes mood={mood} />
        </g>
        <path className={anim && mood !== "sad" ? "kn-mouth" : undefined} d={mouth} />
        {anim && mood !== "sad" ? <path className="kn-smile" d="M52 68q8 8 16 0" /> : null}
        <path className="kn-bm" d="M70 80v13l4-3 4 3V79" />
      </g>
    </svg>
  );
}
