# P11 — баланс, полная приёмка и release-сборка

Зависимости: P10. Читать acceptance criteria исходного дизайна и архитектуру §13. Результат — доказательства для всей игры, а не только набор зелёных unit-тестов.

## P11.1 — детерминированные стратегии и временные границы

**Файлы:** `tests/scenarios/`, balance/content parameters, `docs/validation_report.md`.

**RED:** baseline strategy завершает main automation route за 25–35 active min при обычном уходе; no-care приводит к starvation death до окончания, но не препятствует успеху компании. Care strategy сохраняет кота без постоянного непрерывного кликанья.

Добавлять отдельные сценарии: медленный игрок; высокочастотный primary input; overfeeding/recovery; pet-only; длительные Cat/History visits; временно плохие upgrades; несколько фиксированных seeds. Задать разумную верхнюю границу runtime сценария и diagnostic current offers/rates при stall.

**GREEN:** менять конкретные цены, rates, caps, времена и качества current offers. Полезное кормление ориентировочно каждые 3–4 минуты, PLAY — 4–6 минут; начальная grace period сохранена. Все реальные care sessions расходуют время. Не вводить timed forced unlocks, bonus production за кота или auto-care для облегчения баланса.

**REFACTOR:** минимальный набор не хрупких временных ожиданий. Проверять диапазон и route outcome, а не точную миллисекунду окончания каждой случайной партии. Default parameters обновлять вместе с отчётом о причинах.

**Контроль:** все game/scenario tests и десять ending routes после каждого содержательного изменения баланса; static checks/build. Узкие unit-проверки конкретных rules сохраняют точные граничные ожидания.

## P11.2 — ручные полные прохождения

**Файл:** `docs/validation_report.md`, только наблюдения и ссылки на build/commit.

Пройти основной путь на мобильном устройстве с уходом; отдельно проверить neglect-success и раннее Three Users. Для остальных endings command-driven proof уже есть, выборочно проверить их presentation. Записывать активную длительность отдельно от wall time.

Проверить, что:

- Каждая технология устраняет прежнюю ответственность или bottleneck; игрок замечает изменение роли.
- Темп оставляет время заметить кота, но уход действительно прерывает оптимизацию.
- PLAY честно нажимается пальцем; нельзя «выиграть» synthetic double tap.
- Мир показывает технологическую абстракцию, room не превращается в город.
- 28 иллюстраций визуально различимы; programmer и cat закономерно уменьшаются.
- Мемориал состоит из двух счастливых фотографий, смерть сообщается сдержанно.
- Текст заканчивается трагикомедией, а не нравоучением; живой кот не является условием любого успеха.

Это manual acceptance, не искусственный RED на субъективное «весело». Найденный функциональный баг сначала получает воспроизводимый regression test, затем исправление. Для художественного недостатка записать проверяемое визуальное требование и повторно осмотреть результат.

## P11.3 — устройства и performance

**Устройства:** минимум один mid-range Android/Chrome и один iPhone/Safari; записать модель, OS/browser, viewport/DPR и build. Desktop Chromium/WebKit emulation — дополнительное покрытие, не замена.

Проверить загрузку с cold cache, late-world frame work и residency, смену тем, многократный переход Game/Cat, lock/unlock, app switch и reload в PLAY/reveal. Сравнить с бюджетами архитектуры: initial JS≤350 KiB gzip, first assets≤1 MiB, session art ориентир≤8 MiB, resident textures/render targets ориентир≤64 MiB, p95 frame work<16 ms при 30 fps.

Точно описать метод: GPU memory может оцениваться по живым atlas/render-target allocations, а не выдумываться из JS heap или размера PNG. Непомеренные показатели так и помечаются. Учитывать battery/нагрев по наблюдению в 30-минутном run; лабораторную точность не обещать.

Если бюджет нарушен: сначала deferred loading, reuse, LOD, texture residency, render resolution; затем повторное измерение того же build path. Изменение бюджета допускается только с явным обоснованием и приемлемым поведением на устройстве.

## P11.4 — финальный acceptance и release artifact

**Файлы:** CI/scripts при необходимости, report, статический `dist` как build artifact, не как hand-edited source.

Порядок:

1. Чистый `npm ci`; `check`, `test:rules`, весь `test:game`, `check:release-content`, production build.
2. `test:browser` против production preview, без debug cheats/тестовых routes.
3. Проверка свежего run, resume после reload, dead-cat resume, discoveries после restart и supported save fixtures.
4. Проверка deployment-путей assets, корректного MIME и HTML fallback/caching для выбранного static host. Fingerprinted assets кешируются долго, HTML обновляется; service worker отсутствует.
5. Обновить матрицу приёмки ниже со ссылками на факты. Отдельно перечислить failing/blocked/not-run.

Публикация сайта — отдельное действие. Эта задача создаёт проверяемый production artifact и отчёт; не добавлять hosting/backend ради завершения плана.

## Матрица обязательной приёмки

| Требование | Основное доказательство |
| --- | --- |
| Около 30 минут main route | P11.1 scenario + P11.2 mobile playthrough |
| 28 технологий и скрытое будущее | P08 release catalog + selectors/DOM tests |
| Уникальные иллюстрации/абстрактный zoom | Asset checker + визуальный просмотр всех reveal |
| Ровно три views | P03/P09 browser navigation |
| Миниатюрные health/mood bars | Browser bounding boxes + mobile view |
| FEED/overfeeding/PET | P04 rules + input/persistence tests |
| PLAY: три попытки, timing, pause | P05 unit/browser + real touch session |
| Foreground cat и доступная навигация | P05 browser overlay + mobile view |
| Starvation death, memorial, no resurrection | P04/P10 terminal/save/browser cases |
| Нет смерти/offline output в фоне | P01/P10 lifecycle + screen lock/app switch |
| Care не влияет на производство | P04 scenario, повторённый с полным catalog |
| World cat уменьшается и исчезает | P06 LOD + P08 endgame visual |
| Минимум 10 достижимых endings | P09 command-driven routes |
| Fate variants и retained discoveries | P09 ending/restart tests |
| Обе темы и reduced motion | Browser cases + mobile visual review |
| Mobile performance/recovery | P10 recovery + P11.3 measurements |
| Агентские quality gates | P00 rule fixtures + CI на финальном коде |

## Выходной контроль P11

Все обязательные rows имеют актуальное подтверждение. Отчёт привязан к конкретной сборке/commit; цифры из предыдущей сборки не выдаются за новые. Нет placeholders, всегда успешных проверок, открытых функциональных blocker или неподтверждённой mobile-ready маркировки. Если устройство/арт недоступны, честно зафиксировать оставшийся блок и не объявлять общую приёмку завершённой.
