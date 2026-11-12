// Любой неизвестный адрес внутри языка — настоящая 404 («Страница не существует», доп. ТЗ, п. 2).

import { notFound } from "next/navigation";

export default function Unknown() {
  notFound();
}
