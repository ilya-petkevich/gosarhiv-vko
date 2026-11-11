// Форма записи каталога (общая для создания и правки). Обязательные поля помечены «*».
import { DOC_TYPES } from "@/lib/catalog";
import { PUBLISH_LABEL } from "@/lib/workflow";

const TYPES: Record<string, string> = { photo: "Фото", document: "Документ", map: "Карта", newspaper: "Газета", metric_book: "Метрическая книга", audio: "Звукозапись", video: "Кинодокумент" };

export type DocValues = {
  title?: { ru?: string; kk?: string; en?: string };
  description?: { ru?: string; kk?: string; en?: string } | null;
  cipher?: string | null;
  date_text?: string | null;
  year_from?: number | null;
  year_to?: number | null;
  date_uncertain?: boolean;
  doc_type?: string;
  place?: string | null;
  publish_status?: string;
};

export function DocFields({ v, disabled }: { v: DocValues; disabled?: boolean }) {
  return (
    <fieldset className="adm-form" disabled={disabled}>
      <label className="fld"><span className="label">Название (рус) *</span><input name="title_ru" defaultValue={v.title?.ru} required maxLength={300} /></label>
      <div className="grid2">
        <label className="fld"><span className="label">Название (қаз)</span><input name="title_kk" defaultValue={v.title?.kk} maxLength={300} /></label>
        <label className="fld"><span className="label">Название (eng)</span><input name="title_en" defaultValue={v.title?.en} maxLength={300} /></label>
      </div>
      <label className="fld"><span className="label">Описание (рус)</span><textarea name="desc_ru" rows={4} defaultValue={v.description?.ru} maxLength={4000} /></label>
      <div className="grid3">
        <label className="fld"><span className="label">Архивный шифр *</span><input name="cipher" defaultValue={v.cipher ?? ""} required maxLength={120} /></label>
        <label className="fld"><span className="label">Дата (как в документе) *</span><input name="date_text" defaultValue={v.date_text ?? ""} required maxLength={60} /></label>
        <label className="fld"><span className="label">Вид *</span>
          <select name="doc_type" defaultValue={v.doc_type ?? "document"}>{DOC_TYPES.map((t) => <option key={t} value={t}>{TYPES[t]}</option>)}</select>
        </label>
      </div>
      <div className="grid3">
        <label className="fld"><span className="label">Год с *</span><input name="year_from" inputMode="numeric" pattern="\d{4}" defaultValue={v.year_from ?? ""} required /></label>
        <label className="fld"><span className="label">Год по</span><input name="year_to" inputMode="numeric" pattern="\d{4}" defaultValue={v.year_to ?? ""} /></label>
        <label className="fld"><span className="label">Место</span><input name="place" defaultValue={v.place ?? ""} maxLength={200} /></label>
      </div>
      <label className="check"><input type="checkbox" name="date_uncertain" defaultChecked={v.date_uncertain} /> Дата приблизительная</label>
      <label className="fld"><span className="label">Доступ к описанию *</span>
        <select name="publish_status" defaultValue={v.publish_status ?? "needs_check"}>{Object.entries(PUBLISH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
    </fieldset>
  );
}
