# S08 — mobile audio и устойчивое продолжительное воспроизведение

Зависимости: S07. Читать sound architecture §6, §11. Результат — реалистичные доказательства границ timing/lifecycle/resources.

## S08.1 — 30-минутный план и resource bounds

**Файлы:** `tests/music/long-session.test.ts`, adapter diagnostics для тестовой сборки, leaks/regression cases.

**RED:** 30 минут phrase scheduling с несколькими era/mode changes не накапливают drift/старые handles. Current+next horizon соблюдён; voices/tails не растут; 100 start/pause/stop и mode switches освобождают owning resources.

**GREEN:** удалить уже выполненные/отменённые IDs и old voice banks, завершать tails. Диагностика count — инструмент проверки, не player-facing панель и не точное измерение OS audio memory.

**REFACTOR:** bounded collections вместо истории всех callbacks. Не pre-schedule-ить всю30-минутную музыку для простоты теста.

**Контроль:** fake long session, реальные repeated browser lifecycle cycles и короткие audio renders, check/build.

## S08.2 — mobile unlock и прерывания

**RED:** locked/suspended/interrupted context возвращает корректное public state; user gesture resume работает без дублирования player. Screen lock/app switch не оставляют future notes; return не догоняет пропущенные eras, применяется latest desired snapshot на допустимой границе. Mute в фоне сохраняется.

**GREEN:** обработать реальные состояния установленного Tone/Web Audio adapter. Видимость и context state — разные входы. Звук не нужен для запуска/продолжения экономики или открытия меню.

**REFACTOR:** без platform-detection веток, не подтверждённых наблюдением. Async lazy-load completion после dispose не оживляет забытый context.

**Контроль:** injected lifecycle/unit cases, real iOS Safari и Android Chrome checklist. Отсутствие телефона отметить блоком, не подменять browser events.

## S08.3 — imports/storage/clipboard failures

**RED:** malformed JSON/oversized batch/schema flood не зависают; reviews/candidates quota failure сохраняет старые данные и in-memory edits, retry/export доступны. Clipboard denied даёт файл; conflict import не ломает playing version. Невалидная imported музыка никогда не отправляется в synth.

**GREEN:** проверка размера до parse, bounded validation, понятные typed failures. Никаких executable fields, arbitrary URLs или raw HTML feedback. Не строить backend для восстановления локальных отзывов.

**REFACTOR:** общие decoders/errors для file/CLI/browser, одно место limits. Ошибка чужого candidate не удаляет installed demos/approved catalog.

**Контроль:** error fixtures + production Lab browser cases, check/build.

## S08.4 — audio budget и clipping

**Измерение:** lazy audio JS отдельно от first-game bundle, demo JSON, число живых voices/effects, late-game+music CPU/frame behavior. Начальные ориентиры architecture: audio≤250 KiB gzip дополнительно, demo JSON≤100 KiB, cap8, bounded tails; установить actual package versions в отчёте.

**RED:** representative maximal legal arrangement/SFX mix не клиппует offline; invalid over-budget arrangement отклонён. Первый Game load не загружает Tone/Lab UI, normal sound gesture загружает нужные chunks без блокировки input.

**GREEN:** levels/headroom, reuse synths, меньше effects/voices, lazy module graph; не исполнять Tonal/schema checks в каждом musical callback. Limiter не должен постоянно сжимать перегруженный mix.

**REFACTOR:** не дробить bundles произвольно: catch-all vendor chunk может вновь потянуть Tone в первый экран. Проверять network, а не только суммарную папку dist.

**Контроль:** waveform/voice tests, production bundle/network report, сравнение performance игры со звуком/без на reference phone.

## S08.5 — непрерывное прослушивание минимум10 минут

**Файл:** `docs/sound_validation_report.md`.

Прослушать random sequence, несколько intra/cross era transitions, mute/resume и repeated modes. Проверить отсутствие непреднамеренных gaps/clicks/stuck notes/clipping, устойчивость темпа и нераздражающую повторяемость. Записать device/browser, versions/seeds, build и конкретные наблюдения.

Для найденного функционального дефекта сначала воспроизводимый RED/fixture, затем исправление. Для звучания — человеческое описание и повторное прослушивание. Не объявлять эту проверку пройденной по fake30-minute scheduler test.

**Контроль:** весь music/rule набор и game regressions, общий check/build; результат слушателя отдельно.

## Выходной контроль S08

Long schedule и actual audio lifecycle ограничены по ресурсам. Mobile unlock/recovery проверены или явно заблокированы до устройства. ≥10 минут реального listening документированы; fake/offline/live доказательства не смешаны.
