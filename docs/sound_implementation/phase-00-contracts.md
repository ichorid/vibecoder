# S00 — схемы, валидатор и границы

Зависимости: основной P00. Читать sound architecture §1–3, §11 и общий TDD-протокол. Результат — проверяемые музыкальные документы без Tone playback.

## S00.1 — pattern schema и TS

**Файлы:** `music/PATTERN_SCHEMA.json`, `src/music/core/types.ts`, generated types, `tools/music/generateTypes.ts`, schema fixtures/tests.

**RED:** минимальный valid note/drum pattern проходит; wrong schemaVersion, unknown field, отрицательная length, fractional step, pitch у drum, invalid velocity отклонены с path. По одному тесту/изменению.

**GREEN:** локальная JSON Schema, Ajv выбранного draft, generation TS contracts. Установить только совместимые Tone/Tonal/schema dev/runtime dependencies в общем package/lockfile. Runner `test:music` запускает реальные schema cases.

**REFACTOR:** schema — source of truth; TS файл generated. Добавить `music:check-types`, который сравнивает generation в памяти/temp и не переписывает рабочий файл в CI. Чистый `tsconfig.music.json` без DOM/Node types.

**Контроль:** schema tests, check-types, общий check/build. Примеры для тестов — технические fixtures, не demo compositions.

## S00.2 — era, preset, motif и review contracts

**Файлы:** `music/schemas/`, catalog contract, fixtures/tests.

**RED:** unknown preset family/role, invalid envelope/range/polyphony, неизвестный era ID, invalid status/rating/hash shape, CC BY без attribution, неизвестный motif ref. Валидный review не хранится внутри pattern.

**GREEN:** компактные schemas, шесть data-driven era definitions с defaults, разрешённые preset parameters. Отдельные revision/schemaVersion. Ограничения размеров и числа events проверяются до expensive semantic analysis.

**REFACTOR:** повторно использовать локальные `$defs`, без network schema references. Не превращать presets в произвольные параметры Tone constructors.

**Контроль:** catalog/review structural tests, check/build.

## S00.3 — семантика через Tonal

**Файлы:** `core/validation.ts`, normalization, musical fixtures/tests, `tools/music/validate.ts`.

**RED:** неверная нота/chord/mode, pitch за range, overlap monophonic notes, out-of-bounds duration — hard errors; touching note intervals допустимы. Non-chord passing tone и intentional chromaticism — warnings. Velocity0 не создаёт polyphony. Harmony spans не перекрываются/не оставляют незаявленных gaps.

**GREEN:** Tonal для parse/scale/chord, interval sweep для voice count, normalized pattern с resolved defaults. Ввести настоящий `music:validate -- --era ...`; код возврата nonzero только для errors, warnings видны отдельно.

**REFACTOR:** diagnostics содержат pattern/revision, field/event и причину. Валидатор не выдаёт approved автоматически.

**Контроль:** hard/warning cases, CLI success/failure fixtures, check/build.

## S00.4 — audio import/scheduling lints

**Файлы:** существующий ESLint config/rule fixtures, при необходимости небольшой rule extension.

**RED:** Tone импортирован из game/UI/Lab component; music core читает DOM/storage; game импортирует music state; public game импортирует Lab/reviews; notes планируются window.setTimeout. Valid: app composition соединяет public API, backend владеет Tone Transport.

**GREEN:** расширить существующие таблицы/AST checks; music scheduler — разрешённый presentation механизм только в backend, не исключение для всего проекта.

**REFACTOR:** одна диагностика вместо нескольких одинаковых. Не ослаблять `game/` ради музыкальных тестов.

**Контроль:** весь `test:rules`, `test:music`, общий check/build.

## Выходной контроль S00

Есть versioned schema/types, real errors/warnings и reusable validator. Лицензия и пределы импортов проверяются. Музыкальный core компилируется без браузера; gameplay не получил audio dependencies. Пока никакое «звучание» не заявлено.
