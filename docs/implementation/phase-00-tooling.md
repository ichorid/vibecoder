# P00 — воспроизводимый каркас и проверки

Зависимости: нет. Читать [общий протокол](../implementation_plan.md) и архитектуру §1–2, §11. Результат — минимально собираемое приложение и реальные quality gates. Игровую механику в этой фазе не реализовывать.

## P00.1 — bootstrap

**Файлы:** `package.json`, lockfile, `.nvmrc` или эквивалент, `index.html`, `vite.config.ts`, `svelte.config.js`, `src/main.ts`, `src/app/App.svelte`, `.gitignore`, `AGENTS.md`.

1. Выбрать совместимые актуальные stable-версии Node LTS, Vite и Svelte 5. Зафиксировать установленный Node major и lockfile. Не копировать непроверенные номера пакетов из плана.
2. Создать Svelte + TypeScript приложение без SvelteKit. Корневой DOM показывает название VIBE CODER; нет лишних маршрутов, dashboard или игрового движка.
3. Подключить PixiJS 8 как зависимость; импорт в приложение появится в P03. Не подключать GSAP/pixi-viewport.
4. Добавить Vitest и ESLint RuleTester; настоящие fixtures появятся в P00.3. Browser tooling пока не требуется.
5. Короткий `AGENTS.md`: источники дизайна, границы, команды, правило TDD, authored/generated, защита чужих изменений. Создать журнал выполнения.

Это setup-исключение из RED: runner ещё отсутствует. **Проверка:** clean `npm ci`, `npm run build`, ручное открытие страницы без ошибок. Не добавлять всегда зелёный тест ради количества.

## P00.2 — строгий TS и стандартные линтеры

**Файлы:** `tsconfig*.json`, `eslint.config.js`, Prettier config/ignore, scripts, `tools/type-fixtures/`, первая минимальная domain declaration в `src/game/types.ts`.

**RED по одному случаю:**

- Невалидный тип команды/необработанный union-вариант приводит к отказу type check.
- Чтение `document` в чистом game-коде не компилируется.
- `any`, non-null assertion, плавающий Promise или `@ts-ignore` дают диагностическое сообщение.
- Валидный Svelte-компонент с typed props проходит; конфигурация не должна запрещать обычный код.

**GREEN:** ввести настройки из архитектуры §11 и `svelte-check`. Первое настоящее объявление `RunStatus = 'playing' | 'ended'` в `game/types.ts` обеспечивает непустой pure TS project; в P01 оно используется состоянием run. Для отрицательных fixtures использовать отдельный тестовый запуск компилятора/ESLint с проверкой diagnostics; не оставлять заведомо невалидные файлы среди production sources. ESLint — zero warnings, Prettier — только форматирование.

**REFACTOR:** общий минимум опций вынести в базовый TS config; чистая конфигурация не наследует DOM/Node `types`. Кроме первого domain contract не добавлять пустые game-модули ради покрытия. Compile fixtures с Node/DOM не должны обходить отдельную чистую проверку.

**Контроль:** `check:types`, `lint`, `format:check`, `build`. Добавить `check`, объединяющий реальные проверки.

## P00.3 — границы импортов

**Файлы:** `tools/eslint-rules/layer-imports.*`, fixtures/тест, `eslint.config.js`.

**RED, отдельными cases:**

1. `game/` импортирует Pixi/Svelte/LocalStorage adapter.
2. `ui/` импортирует `game/commands` или сырой каталог.
3. Запрещённый импорт спрятан за alias, re-export или статическим `import()`.
4. `content/` использует разрешённый type-only импорт domain contract — это valid case.

**GREEN:** сначала использовать готовые import restrictions; local AST rule вводить только для недостающей проверки. Одно короткое диагностическое сообщение с допустимым направлением зависимости. Запретить непроверяемые динамические пути к исходным модулям; URL загрузки PNG не является таким импортом.

**REFACTOR:** одна таблица правил для config/fixtures; без транзитивного универсального анализатора всего проекта. Не создавать обходные barrel-файлы. Root composition имеет явно разрешённые зависимости.

**Контроль:** `npm run test:rules`, `npm run check`, `npm run build`.

## P00.4 — время, RNG и планирование

**Файлы:** остальные rules/config, valid/invalid fixtures.

**RED:** game/content использует `Date.now`, `new Date`, `performance`, `Math.random`, `crypto`, interval/timeout; UI создаёт интервал нужд; UI импортирует manifest через re-export. Valid: seed создаётся в app, runtime владеет интервалом, UI читает projection, renderer владеет presentation ticker.

**GREEN:** restricted globals/properties там, где достаточно ESLint. Добавить только необходимые local checks для `no-raw-content-in-ui` и `owned-scheduling`. У presentation helper отдельный точный разрешённый путь, не исключение для всего `ui/`.

**REFACTOR:** устранить дублирующие diagnostics. Зафиксировать, что статические правила не доказывают независимость ухода от производства.

**Контроль:** весь `test:rules`, static checks, build. Добавить CI с `npm ci` и существующими проверками; пока не вызывать отсутствующие игровые/browser scripts.

## Выходной контроль P00

- Установка с lockfile воспроизводима; сборка существует и открывается.
- Каждая local rule имеет valid и invalid fixtures; invalid cases падают по нужной причине.
- TS проверяет Svelte и будущую чистую директорию game без DOM. Нет blanket disables.
- `AGENTS.md` короткий и ссылается на документы, а не дублирует их.
- Сохранены факты проверки. Не утверждать, что игра уже реализована.
