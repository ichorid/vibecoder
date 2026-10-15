# S01 — музыкальное время, shuffle-bag и phrase plan

Зависимости: S00. Читать sound architecture §4–5. Результат — детерминированное планирование, не использующее AudioContext.

## S01.1 — steps/ticks/durations

**Файлы:** `core/timing.ts`, tests/fixtures.

**RED:** defaults дают48 ticks/step,3 072 ticks/phrase и8 s; 3/4 и6/8 дают правильную длину четвертей; note end ровно на boundary допустим; непредставимая grid/PPQ дробь — error, не rounding. Tempo override должен быть разрешён clock policy.

**GREEN:** чистые функции с явными units. Pitch можно нормализовать в MIDI number для backend; источник JSON остаётся Tone-independent.

**REFACTOR:** не дублировать арифметику в Lab/Tone callbacks. Tempo changes пока только в boundary plan.

**Контроль:** timing tests, validator regression, check/build.

## S01.2 — shuffle-bag без weights

**Файлы:** `core/shuffleBag.ts`, tests.

**RED:** все candidates встречаются ровно один раз до refill; bag rollover не повторяет последний ID при≥2; seed воспроизводим; singleton повторяется без зацикливания; empty даёт unavailable. Изменённый набор кандидатов пересобирает bag без выдачи удалённой версии.

**GREEN:** seeded Fisher–Yates и небольшой serializable bag/RNG state. RNG независим от игры и визуальных random.

**REFACTOR:** selection не знает о Tone, review UI или localStorage. Отдельно ID/revision, не только title.

**Контроль:** bag tests с несколькими seeds и несколькими rollover, check/build.

## S01.3 — weights и совместимые группы

**RED:** positive weights не добавляют дубликатов; weight0 исключает; invalid weight rejected; deterministic weighted permutation. Совместимая clock/boundary group принимается, неразрешённые pairs отклонены; только совпадение key недостаточно.

**GREEN:** weighted ordering without replacement, одна выборка каждого элемента. Pack/candidate builder проверяет все разрешённые пары группы. Для inter-era transitions отдельные data rules и возможный bounded stinger.

**REFACTOR:** общий selector и для game, и для Lab. Никакого поиска бесконечного «совместимого следующего» с молчаливым пропуском оставшегося bag.

**Контроль:** weighted/compatibility tests, check/build.

## S01.4 — phrase compiler и ограниченный горизонт

**Файлы:** `core/phrasePlanner.ts`, fake scheduler helper, tests.

**RED:** роли/notes превращаются в абсолютные ticks, синхронные tracks имеют одинаковый start; end следующей фразы накапливается без drift. Over-budget voices и invalid assignments не попадают в plan. Horizon≤current+next, выполненные handles удаляются.

**GREEN:** immutable `PhrasePlan` с normalized events, versions, start/end. Mono/poly constraints и density из arrangement, не произвольный runtime filter на каждый audio frame. Default density — включение/выключение roles; сложная генерация новых нот не нужна.

**REFACTOR:** planner не хранит Tone nodes и не меняет исходный pattern.

**Контроль:** 30-минутный fake-clock plan: правильные boundaries, bounded schedule registry, no drift; это ещё не доказательство слышимости.

## Выходной контроль S01

Timing и selector полностью проверяются без browser. No-repeat и weights согласованы. Пустой/единственный bank обработаны. Есть bounded plan и fake scheduler с lookahead, пригодный для TDD director/backend contract.
