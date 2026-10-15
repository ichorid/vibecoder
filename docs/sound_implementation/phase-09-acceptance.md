# S09 — приёмка музыкального workflow

Зависимости: S08 и основные P08–P10 для настоящей интеграции. Финальные60 композиций не нужны; все четыре демо, инструменты и пользовательский путь обязательны.

## S09.1 — clean install и production walkthrough

Чистый `npm ci`, общий check, `test:rules`, `test:music`, `music:check-types`, `music:validate`, production build, `test:music-browser`. Отдельно затронутые game/browser regressions. Команды не должны требовать private APIs, credentials, музыкального редактора или backend.

На production preview пройти:

1. Game→Настройки→Звук on/off, Музыка→Music Lab.
2. Gesture unlock; услышать оба Discovery и оба Singularity demos, общий motif.
3. Single/loop, random demo sequence, A→B test, six-stage Evolution с честными fallback labels.
4. Import нового valid candidate, audition, rating/feedback, revise/reject/approve exact version, reload.
5. Export/import reviews; A/B новой revision и stale approval.
6. Copy/export self-contained prompt; обратно в Game — тот же run без catch-up.

Это выполненный walkthrough, а не список «должно работать». Записать наблюдаемые ошибки и их regression fixes. Не подтверждать human artistic approval автоматически.

## S09.2 — полный цикл автора без истории чата

По `music/README.md` подготовить один малый valid candidate, провалидировать, прослушать, дать человеку решить review, экспортировать JSON, собрать approved pack и проиграть его в интеграционном run. Для проверки инфраструктуры использовать тестовый материал с явным статусом; не публиковать demo как финальный саундтрек без решения человека.

Получить готовый era prompt через Lab и CLI, сравнить существенные sections. Новый автор должен видеть motif demo/pending/approved status, schema, constraints, desired revisions, feedback, license и file scope. Нельзя незаметно запустить lead/era composer assignment вместо проверки templates.

Составлять финальный motif/60 patterns — отдельное последующее задание. Документация указывает, как после его утверждения независимые worktree agents работают со своими eras и как координатор интегрирует результаты.

## S09.3 — mobile и game integration

На iPhone/Safari и mid-range Android/Chrome: sound toggle в настройках, volume, Lab navigation, первый gesture, screen lock, app switch, resume, mute, headphones/speaker. Проверить late-world+music и совместимость с touch PLAY, не используя звук как timing source.

В полном30-минутном игровом run проверить technology→era/arrangement boundaries, browsing Cat/History без перерыва музыки и отсутствие musical warning при голоде/смерти. Ending stop — общая policy, не реакция на cat fate. Нулевой/неполный approved pack обработан явно; для прослушивания полного mapping можно использовать маркированный integration/demo catalog, не утверждая готовность всех шести банков.

Фиксировать, какая bank звучала на каждом этапе и где был fallback. Значения CPU/bytes/node counts относятся к конкретной сборке и методу; неизвестное не заменять предположениями. Документировать ≥10 минут непрерывного listening из S08 отдельно от полного run.

## S09.4 — docs, artifacts и матрица

Проверить команды, source/exported JSON, generation types, licenses/attribution, production multi-page hosting `/music-lab/`, lazy chunk paths/cache и восстановление game save при переходе. Обычный artifact включает оба HTML entry; отдельный backend/Lab-only deploy не нужен. Не публиковать сайт в рамках задачи проверки артефакта.

`docs/sound_validation_report.md` содержит дату/build/commit, automated results, реальные browsers/devices/listener feedback, budgets и remaining blocks. Ниже каждую строку отметить фактом или конкретным блоком:

| Требование | Доказательство |
| --- | --- |
| Formal JSON и TS совпадают | S00 schemas/generated type check |
| Hard errors отдельно от warnings | Semantic/CLI fixtures + Lab diagnostics |
| Точные ticks и continuous boundaries | S01 planner + S02 real renders + listening |
| No-repeat/weights/seed | S01 bag cases + Lab runtime sequence |
| Era/arrangement независимы | S03 before/after commit tests + cross-era listening |
| Четыре убедительных playable demos | S03 human listening, no fake final approval |
| Четыре Lab modes | S04 production browser + 96 s Evolution |
| Review/version/import/export | S05 persistence/hash/conflict/A-B flows |
| Candidate JSON без engine change | Production import + CLI pack workflow |
| Самодостаточный composer prompt | S06/S09 generated text по новой era |
| Future worktrees без изменения engine | Templates/file scopes и documented coordinator workflow |
| Settings sound/Music submenu/Lab в production | S07 и основной P10.6 shared spec |
| Нет cat mood/death music reaction | S07 comparative tests + game observation |
| Background и gesture | S08/S09 real iOS/Android checks |
| Нет stuck notes/утечек/clipping | S02/S08 offline/live lifecycle + listening |
| 30-minute robustness | Fake schedule + actual30-minute mobile game run |
| Open-source reproducibility | Clean install, local JSON/tools, licenses/notices |

## Выходной контроль S09

Инфраструктурный объём полностью проверен; demo/final и mocked/heard результаты различаются. Production menus/Lab работают, human review остаётся авторитетным, final60-pattern soundtrack явно отложен. Если обязательный audio/device/listening результат не получен, отчёт не помечает всю приёмку как done.
