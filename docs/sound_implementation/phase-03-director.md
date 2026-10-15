# S03 — Music Director и четыре временных демо

Зависимости: S02. Читать sound architecture §4–7, §10. Результат — общий player/director с реальным музыкальным материалом и сменой era на границе фразы.

## S03.1 — текущая и запрошенная музыка

**Файлы:** `src/music/director.ts`, public contracts, tests с fake lookahead.

**RED:** start один раз, повторный start не дублирует player; setEra не обрывает текущую фразу; arrangement меняется независимо от era; два быстрых запроса оставляют последний. Во время pause desired snapshot обновляется, но звук/clock не идут.

**GREEN:** компактный director state: playing/requested era+arrangement, selected version/bag, позиция/plan ownership. Backend по контракту из S02. Пустой/invalid bank даёт unavailable и явную policy keep-current/silence, не rejected fallback.

**REFACTOR:** не хранить Tone nodes в public state; не делать player зависимым от конкретного game technology ID.

**Контроль:** director tests, core/backend regression, check/build.

## S03.2 — commit horizon и переходы

**RED:** request до commit отменяет весь старый next plan; request после commit переносится ещё на phrase; tracks не смешивают два arrangements. Cross-era tempo change происходит на boundary без transport reset. Optional stinger занимает заявленные ticks; отсутствие stinger не ломает переход.

**GREEN:** один boundary protocol, explicit transition data, bounded release/fade. Использовать cancel guarantees backend, не предполагать, что callback ID отменяет audio automation. При переходе изменить bank и refill корректно, сохранив musical clock.

**REFACTOR:** одинаковая логика в Lab и game; никаких отдельных «упрощённых переходов для preview».

**Контроль:** fake до/после horizon + настоящий Tone transition render, check/build.

## S03.3 — мотив и четыре demo patterns

**Файлы:** `music/motif/demo-main.json`, два Discovery и два Singularity JSON, соответствующие presets/arrangements, data tests.

**RED:** manifest ожидает ровно эти четыре demo revisions с корректными refs/license; они проходят schema, ranges, polyphony и bounds; каждая пара своей era совместима. Нет status approved или ссылки на якобы утверждённый final motif.

**GREEN:** небольшой узнаваемый motif из архитектурного примера либо столь же простой документированный вариант; C major Discovery и C Phrygian Singularity, общий clock120/4/4/64 steps. Варианты различаются ритмом/регистром/плотностью. `demo:true`, CC0, review unreviewed. Не создавать остальные60 patterns.

**REFACTOR:** presets передают contrast, source events остаются независимы от Tone. Демо обязаны реально звучать после установки/gesture без внешних samples/credentials.

**Контроль:** validator + реальное прослушивание двух eras и их перехода. Человек подтверждает узнаваемость временного motif; это не approval финального саундтрека.

## S03.4 — шесть era definitions и evolution timeline

**Файлы:** eras/arrangements, `previewTimeline.ts`, tests.

**RED:** timeline проходит все6 requested states и default duration96 s; промежуточная отсутствующая bank явно отображается как demo fallback с истинным source-era ID. Game approved mode не наследует этот Lab-only fallback. Изменение BPM пересчитывает duration по ticks.

**GREEN:** по2 фразы на этап: ранние демонстрируют Discovery bank, поздние — Singularity bank с разными bounded arrangements. Стиль Dorian/Minor не объявляется готовым, если его нотного материала ещё нет. Timeline — данные для того же director, не wall-clock interval.

**REFACTOR:** future approved bank заменяет fallback entry без изменения engine. Два измерения era/arrangement остаются раздельными.

**Контроль:** timeline/director tests и короткое живое preview, check/build.

## Выходной контроль S03

Четыре честно помеченных playable demo, общий motif, реальная смена эпох/аранжировок без clock reset. Last-request/commit horizon обработаны. Missing banks не подменяются неутверждённым материалом в production policy.
