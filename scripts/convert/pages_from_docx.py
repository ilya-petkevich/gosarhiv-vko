"""Тексты раздела «Об архиве» из материалов заказчика → db/seed/data/pages.json.

Запуск: python3 scripts/convert/pages_from_docx.py "<папка «Гос Архив»>"
Тексты переносятся без изменений: абзацы — как в документах.
Разметка body: абзацы через пустую строку, «## » — подзаголовок, «- » — пункт списка, [текст](адрес) — ссылка.
"""
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ROOT = Path(__file__).resolve().parents[2]


def paras(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    out = []
    for p in root.iter(f"{W}p"):
        t = re.sub(r"\s+", " ", "".join(x.text or "" for x in p.iter(f"{W}t"))).strip()
        if t:
            out.append(t)
    return out


def main(src):
    src = Path(src)
    history = paras(src / "История архива.docx")
    if history and history[0].lower().startswith("история архива"):
        history = history[1:]
    body = []
    for p in history:
        body.append(("- " + p.lstrip("-– ").strip()) if re.match(r"^[-–]|^\d+\.\s", p) else p)
    history_md = "\n\n".join(body)

    struct = paras(src / "Структура.docx")
    # первая часть — схема подразделений, вторая — руководители и контакты (с «Директор - …»)
    i = next(k for k, p in enumerate(struct) if p.startswith("Директор -") or p.startswith("Директор –"))
    units, people = struct[:i], struct[i:]
    merged = []
    for u in units:
        u = u.strip()
        if not u or u.upper() == "ДИРЕКТОР":
            continue
        if merged and u[:1].islower():  # «Главный хранитель» + «фондов» — перенос строки в схеме
            merged[-1] += " " + u
        elif u not in merged:
            merged.append(u)
    md = ["## Подразделения"] + ["- " + u for u in merged]
    md += ["## Руководство и контакты"]
    for p in people:
        if p.endswith(":") and "–" not in p and "-" not in p.split(":")[0][-3:]:
            md.append(f"**{p.rstrip(':')}**")
        elif re.match(r"^Заместитель директора:\s*$", p):
            continue
        else:
            md.append("- " + p)
    structure_md = "\n\n".join(md)

    comp = paras(src / "Комплаенс служба" / "Информация о работе комплаенс службы.docx")
    officer = (src / "Комплаенс служба" / "Комплаенс-офицер.txt").read_text(encoding="utf-8").strip()
    officer = re.sub(r"\s+", " ", officer)
    name = officer.split(" - ", 1)[1].strip().title() if " - " in officer else officer
    comp_md = "\n\n".join(
        [f"**Комплаенс-офицер:** {name}."]
        + comp[3:]
        + [
            "## Документы",
            "- [Аналитическая справка по внутреннему анализу коррупционных рисков, 2026](/docs/compliance/analiticheskaya-spravka-vakr-2026-ru.pdf) · [қаз](/docs/compliance/analitikalyk-anyktama-2026-kk.pdf)",
            "- [Перечень должностей, подверженных коррупционным рискам](/docs/compliance/perechen-dolzhnostej-ru.pdf) · [қаз](/docs/compliance/perechen-dolzhnostej-kk.pdf)",
            "- [План мероприятий по устранению причин и условий коррупционных правонарушений](/docs/compliance/plan-meropriyatij-ru.pdf) · [қаз](/docs/compliance/plan-meropriyatij-kk.pdf)",
            "- [Положение об антикоррупционной комплаенс-службе](/docs/compliance/polozhenie-antikor-ru.pdf) · [қаз](/docs/compliance/polozhenie-antikor-kk.pdf)",
        ]
    )
    pages = [
        {"slug": "history", "title": "История архива", "source": "История архива.docx (материалы архива)", "body": history_md},
        {"slug": "structure", "title": "Структура и руководство", "source": "Структура.docx (материалы архива)", "body": structure_md},
        {"slug": "compliance", "title": "Антикоррупционная комплаенс-служба", "source": "Материалы комплаенс-службы архива, 2026", "body": comp_md},
    ]
    dst = ROOT / "db" / "seed" / "data" / "pages.json"
    dst.write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"страниц: {len(pages)} → {dst}")


if __name__ == "__main__":
    main(sys.argv[1])
