# VIBE CODER — реализация музыки и Music Lab с TDD

Статус: план, не выполненная реализация. Исходников музыкального движка/игры пока нет. Основание: [музыкальное ТЗ](sound_design.md), [музыкальная архитектура](sound_architecture.md), [основной план игры](implementation_plan.md).

Объём: один Tone.js player, JSON-контракты и валидация Tonal/Ajv, четыре временных демо, Music Lab с четырьмя режимами, reviews/export/approved-pack, composer prompt infrastructure, интеграция с игрой. По уточнению пользователя **«Настройки → Звук»** и **«Настройки → Музыка → Music Lab»** доступны в основной production-сборке. Lab загружается отдельным entry и не меняет три игровых view. Финальные60 patterns и запуск composer subagents в этот план не входят.

## 1. Очерёдность и зависимости

Начать после основного P00: нужны общий Vite/Svelte/TypeScript, lint/test runner и lockfile. Если основной каркас ещё не создан, сначала выполнить его; не создавать отдельный npm project для музыки. Lab разрабатывается независимо от готовности полной игровой экономики.

| Фаза | Результат | Зависимости |
| --- | --- | --- |
| [S00 — данные и границы](sound_implementation/phase-00-contracts.md) | Versioned JSON schemas, TS types, semantic validation, lints | Основной P00 |
| [S01 — timing и выбор](sound_implementation/phase-01-planning.md) | Steps/ticks, shuffle-bag, compatibility, phrase plan | S00 |
| [S02 — Tone backend](sound_implementation/phase-02-backend.md) | Четыре synth families, настоящий schedule/lifecycle, audio controls | S01 |
| [S03 — director и демо](sound_implementation/phase-03-director.md) | Era/arrangement transitions, четыре звучащих демо, evolution timeline | S02 |
| [S04 — Music Lab](sound_implementation/phase-04-lab.md) | Отдельный production entry, четыре playback modes, current pattern | S03 |
| [S05 — reviews](sound_implementation/phase-05-reviews.md) | Ratings/status, version hashes, storage/import/export, A/B | S04 |
| [S06 — composer workflow](sound_implementation/phase-06-composers.md) | CLI checks, approved pack, feedback prompt, templates/лицензии | S05 |
| [S07 — игра](sound_implementation/phase-07-integration.md) | Mapping технологий, lifecycle, care SFX без реакции на смерть | S06 + основные P01–P03; полная проверка mapping после P08 |
| [S08 — устойчивость](sound_implementation/phase-08-hardening.md) | Mobile unlock/recovery, 30-минутное расписание, bounded resources | S07 |
| [S09 — приёмка](sound_implementation/phase-09-acceptance.md) | Прослушивание, мобильные измерения, полный production workflow | S08; интеграционная приёмка после основных P08–P10 |

Префикс S относится только к этому плану, P — к основному. Одно задание агенту — один ID, например S01.2. Внутри каталожных задач паттерны/элементы вводятся по одному проверяемому циклу. Параллельная работа будущих композиторов описывается шаблонами, но сейчас не запускается.

## 2. TDD и отчёт исполнителя

Следовать [общему RED → GREEN → REFACTOR](implementation_plan.md). Для музыкальной задачи:

1. Написать самый маленький тест наблюдаемого поведения и увидеть ожидаемый RED. Отсутствующий пакет/AudioContext в неподходящем runner — setup failure, а не нужное падение.
2. Добавить минимальную реализацию, получить GREEN; затем следующий boundary/error case.
3. Рефакторить при зелёных проверках. Не менять ожидаемые notes/approval rules ради обхода бага.
4. Проверить затронутый набор, общий TS/lint/build. На границе фазы один раз выполнить все существующие music tests и затронутые game regressions.
5. Записать факты в `docs/sound_implementation_progress.md`: ID, файлы, RED-причина, GREEN-команды, непроверенное, следующий ID. Этот журнал создаётся при начале реализации.

Для художественных вопросов нет честного автоматического теста «мелодия хорошая». Проверять JSON/timing/ranges/bounds автоматически, а музыкальный результат — прослушиванием с записанным выводом человека. Не превращать waveform snapshot в human approval.

Пример задания простой модели:

```text
Выполни только Sxx.y.
Прочитай общий sound_implementation_plan и файл текущей фазы.
Сначала воспроизведи RED поведения, затем реализуй минимум.
Сохрани исходные границы, чужие изменения и текущий игровой API.
Проверь задачу, обнови журнал фактических результатов.
Не запускай composer agents и не генерируй финальный саундтрек.
```

## 3. Контракты и рабочие решения

Целевые формы; конкретные типы — из схем/архитектуры. Не вводить новую абстракцию для каждого метода:

```ts
validatePattern(input: unknown, catalog): ValidationResult
normalizePattern(document, eraDefaults): ValidatedPattern
compilePhrase(pattern, arrangement, startTick): PhrasePlan
nextFromBag(bagState, candidates, rngState): SelectionResult
resolveMusicProjection(unlockedIds, mapping): MusicProjection
createDirector(catalog, backend): MusicDirector
decodeReviews(input: unknown): ReviewImportResult
formatComposerPrompt(input): string
```

`ValidationResult` разделяет errors/warnings, хранит filename/path/event. `PhrasePlan` содержит абсолютные start/end ticks, normalized events и выбранные версии, но не Tone nodes. Backend принимает только validated/compiled данные. Public start/resume возвращают состояние, а не необработанный Promise rejection.

### Defaults для однозначной реализации

| Решение | Начальная политика |
| --- | --- |
| Clock | PPQ192, 120 BPM, 4/4, 16 steps/bar, 4 bars; 48 ticks/step, 3 072 ticks/phrase |
| BPM override | Single audition — допускается; random bank — только одинаковый effective tempo; cross-era tempo change — на boundary |
| События | Integer step/length, end≤phrase end, нет ties через границу; rests отсутствием событий |
| Polyphony | Ноты на границе off-before-on; zero velocity не создаёт voice; release учитывается в runtime budget |
| Bag | Без replacement; weight влияет на порядок, не частоту; zero weight исключает; один кандидат может повторяться |
| Transition | Default no stinger; current phrase завершается; latest requested snapshot заменяет предыдущий pending |
| Lookahead | Следующий plan можно менять только до его commit; слишком поздний request — ещё одна фраза старого arrangement |
| Audio unlock | Только доверенный gesture; lazy Tone import, игра не ждёт его |
| Громкость | Default0,35; gain ramps10–30 ms; общий voice cap8 вместе с SFX |
| Mute/background | Pause scheduling и release; нет catch-up; mute не забывает latest desired era |
| Stop | Сброс позиции/bag; pause — сохранение позиции; era change — без clock reset |
| Reviews | Статус относится к ID/revision/payload+dependencies hash; изменения звучания требуют нового review |
| Demo | Четыре unreviewed demo records; Single доступен; random demo включается явно |
| Publication | Только экспортированный/revalidated approved pack; localStorage reviewer не является game catalog |
| Evolution | 6 этапов ×2 фразы =96 s при defaults; промежуточные source banks явно помечены demo fallback |

Список eras: discovery, acceleration, orchestration, recursion, self-improvement, singularity. Не добавлять этапы из game phase table как новые музыкальные era IDs.

### Ограничения валидного входа

Pattern≤256 KiB, batch/reviews≤2 MiB, ≤1 024 events/pattern, bars≤16, feedback≤8 KiB. Pitch syntax и scales/chords — через Tonal, instrument ranges/поле harmony — отдельная semantic validation. Намеренная chromaticism/near duplicate дают warnings, не hard failure. Sample URL, код и arbitrary Tone options в JSON запрещены.

Generated types получаются из локальной JSON Schema; не переписывать их вручную. Approved revision не перезаписывать: создавать `<id>.v<next>.json`. CSV/MIDI import/export не требуется; @tonejs/midi не устанавливать без отдельного задания.

## 4. Тестовые уровни

| Проверка | Среда | Что не доказывает |
| --- | --- | --- |
| Schema/semantic/timing/bag | Vitest, pure TS, seeds | Музыкальное качество/реальное звучание |
| Director/phrase planning | Fake scheduler со ticks/audioTime/commit horizon | Надёжность конкретной версии Tone |
| Adapter contract | Настоящий Tone в browser/Offline render | Fairness autoplay на каждом телефоне |
| Lifecycle/resource counters | Fake contracts + реальный browser | Точный GPU/OS audio memory по одному JS heap |
| Lab/reviews/prompts | Component/browser/filesystem fixtures | Human approval смысла композиции |
| Continuous listening | ≥10 минут headphones/speaker | Полное30-минутное mobile performance автоматически |
| Полная игра | После интеграции,30-минутный mobile run | Наличие финальных60 композиций |

Тесты core размещать рядом с модулями; fixtures/scenarios — `tests/music/`; browser — `tests/browser/music-*.spec.ts`. AudioContext/Tone не мокать во всех слоях: хотя бы реальные offline renders + live smoke обязательны. Не создавать fake «all notes played» backend как единственное доказательство.

При offline checks использовать специальный легальный fixture с непрерывной опорной партией: silence в сочинённой музыке может быть художественной паузой. Проверять ненулевой сигнал, ограниченный peak, отсутствие stale notes после stop/pause и ожидаемые audible onsets по окнам. Качество и clicks дополнительно слушать.

Fake scheduler должен воспроизводить lookahead: callback может выполниться раньше слышимого audioTime. Проверять запросы до/после commit, отмену старого next plan и отсутствие mixed-arrangement phrase. Не обходить реальные callbacks непосредственным вызовом UI handler.

## 5. Команды и встраивание в CI

Команды появляются вместе с первым настоящим поведением, не заранее с passWithNoTests:

| Команда | Фаза | Назначение |
| --- | --- | --- |
| `npm run test:music -- <path>` | S00 | Unit/director/data tests без watch |
| `npm run music:check-types` | S00 | Generated contracts + pure music TS check |
| `npm run music:validate -- --era discovery` | S00, расширяется S06 | Structural/semantic diagnostics, потом corpus similarity |
| `npm run test:music-browser -- <path>` | S02 | Настоящий Tone/browser, позже Lab/integration |
| `npm run dev:music-lab` | S04 | Тот же Vite dev server с entry `/music-lab/` |
| `npm run music:build-pack` | S06 | Версии с актуальным approved review; отдельно explicit demo pack |
| `npm run music:prompt -- --era discovery` | S06 | Self-contained composer prompt/Markdown |

`check:types`/lint видят music/Lab; boundary tests расширяются, а не дублируются вторым ESLint framework. Общий Vite multi-page build выпускает Game и Music Lab. Game entry не импортирует Lab и raw drafts; production Lab получает демо/published catalog и локально импортированные пользователем candidates. Music validators/tests добавляются в CI; долгие live listening tests — отдельный ручной отчёт.

Не вызывать отсутствующие game tests/scripts до выполнения соответствующей основной фазы. Новая музыка не требует переписать существующий game test runner.

## 6. Ключевые доказательства завершения

- В обоих контрастных demo eras звучит узнаваемый временный motif, но нет фиктивного final approval.
- Random sequence использует runtime selector, каждый кандидат один раз, границы bags без немедленного повтора при≥2.
- Tone расписание сохраняет musical clock, tracks синхронны, переход ждёт phrase boundary.
- Все четыре Lab modes используют один engine и освобождают старый plan.
- Review меняется/сохраняется/import-export-ится; новая музыкальная revision не наследует старое approval.
- Exported review + CLI создают approved pack, который действительно слышен в game integration.
- В обычной production-сборке работает путь «Настройки → Музыка → Music Lab» и переключатель звука; Lab не загружается вместе с первым игровым экраном.
- Prompt содержит схемы, motif status, constraints/feedback и границы файлов, достаточные новому агенту без истории чата.
- Cat health/mood/death не влияют на era, arrangement, mix, silence или stinger.
- Audio unlock/фон/восстановление работают на реальных целевых мобильных браузерах.
- Документация честно отмечает: intermediate era preview — fallback, финальный саундтрек ещё не сочинён.

Каждая фаза имеет свой выходной контроль. S09 не закрывается при недоступном обязательном устройстве/прослушивании как «всё проверено»; фиксируется конкретный оставшийся блок.
