// Шаблон пересоздаётся при каждом переходе между страницами — новая страница плавно появляется (шапка и подвал остаются на месте).
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
