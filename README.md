# stopmenu — клиенттерге арналған стоп-лист панелі

Кафе иесі логин/парольмен кіріп, өз сайтының мәзірінен тағамды **уақытша өшіре** алады.
Сайтта ол тағам «Уақытша жоқ» болып тұрады да, тапсырыс беруге болмайды. Басқа ештеңені өзгерте алмайды.

Бір панель — бірнеше клиент сайты. Әр клиент тек өзінің сайтын көреді.

## Қалай жұмыс істейді

1. Панель Supabase Auth арқылы кіргізеді.
2. `sites` кестесінен клиентке тіркелген сайтты алады.
3. Сайттың `menu_url` файлын (`js/data.js`) жүктеп, мәзірді көрсетеді — мәзір өзгерсе, панель өзі жаңарады.
4. Қосқышты өшіру → `stop_items` кестесіне жазба қосылады.
5. Клиент сайты сол кестені оқиды (әр минут сайын жаңартады).

## Қосу (бір рет)

1. Supabase-те жоба ашыңыз (otdoner-дың пікірлерімен бір жоба болуы мүмкін).
2. SQL Editor → `supabase/setup.sql` файлын іске қосыңыз.
3. Project Settings → API: `Project URL` мен `anon public` кілтті `js/config.js` ішіне қойыңыз.

## Жаңа клиент қосу

```sql
-- 1) сайтты тіркеу
insert into public.sites (slug, name, site_url, menu_url) values
  ('otdoner', 'ОТ ДОНЕР', 'https://otdoner.vercel.app', 'https://otdoner.vercel.app/js/data.js')
  on conflict (slug) do nothing;

-- 2) Dashboard → Authentication → Users → Add user (email + пароль, Auto Confirm қосулы)

-- 3) клиентті сайтқа байлау
insert into public.site_members (site_slug, user_id)
  select 'otdoner', id from auth.users where email = 'client@example.com'
  on conflict do nothing;
```

Клиент сайтының жағында `js/config.js` ішінде `siteSlug` сол `slug`-пен бірдей болуы керек
және `js/stoplist.js` қосылуы тиіс.

## Қауіпсіздік

- RLS: клиент тек өзі тіркелген сайттың стоп-лисін өзгерте алады.
- Стоп-лисі барлығына оқуға ашық (сайт оны көрсету үшін оқиды).
- Пароль ұмытылса — Supabase Dashboard → Authentication → Users → Reset password.
