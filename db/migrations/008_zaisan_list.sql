-- Зайсан: список особых фондов отдельным абзацем, иначе разметка склеивает его в строку
update branches
set description = jsonb_set(description, '{ru}', to_jsonb(replace(description->>'ru', E'Особые фонды:\n- ', E'Особые фонды:\n\n- ')))
where slug = 'zaisan' and position(E'Особые фонды:\n- ' in description->>'ru') > 0;
