// Помощник «Ахмет»: голова-книга с антенной и закладкой. Состояния — глазами и ртом.

export type Mood = "hello" | "think" | "found" | "sad";
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

export function Kniga({ size = 120, mood = "hello", title }: { size?: number; mood?: Mood; title?: string }) {
  const sw = size > 40 ? 3 : 4.5;
  const mouth = mood === "sad" ? "M55 72q5-3 10 0" : mood === "think" ? "M56 71h8" : "M54 70q6 4 12 0";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} style={{ flex: "none" }}>
      {title ? <title>{title}</title> : null}
      <circle cx={60} cy={60} r={58} fill="#fff" stroke={INK} strokeWidth={size > 40 ? 2.5 : 4} />
      <g stroke={INK} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 42C50 36 38 36 30 40v42c8-4 20-4 30 2 10-6 22-6 30-2V40c-8-4-20-4-30 2z" fill="#fff" />
        <path d="M60 42v42" />
        <path d="M60 42V31" />
        <circle cx={60} cy={27} r={3.6} fill="#fff" />
        <Eyes mood={mood} />
        <path d={mouth} />
        <path d="M70 80v13l4-3 4 3V79" />
      </g>
    </svg>
  );
}
