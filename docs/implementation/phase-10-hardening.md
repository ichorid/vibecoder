# P10 — сохранения, вкладки и восстановление на мобильном вебе

Зависимости: P09. Читать архитектуру §4, §7, §10. Результат — игра переживает ожидаемые сбои браузера без скрытого reset, resurrection или catch-up.

## P10.1 — реальные версии saves и отказы storage

**Файлы:** persistence validation/migrations/tests, save recovery UI внутри существующих views.

**RED:** старые реально существовавшие fixtures проходят явный mapping; death/ending/cooldowns/RNG сохраняются. Future schema, invalid IDs/ranges или повреждённая envelope не перезаписываются автоматически. Storage недоступна на старте — понятный режим текущей сессии; quota failure во время игры сохраняет in-memory state и даёт retry.

**GREEN:** добавить только необходимые реальные migrations. Для каждой исходной версии сохранить fixture в `tests/fixtures/saves/`. Если формат не менялся, тестировать identity/current/future/corrupt, не выдумывать v0.

**REFACTOR:** runtime profile recovery допускается только после независимой валидации recoverable facts. Нельзя доставать ending IDs из произвольного повреждённого объекта через type assertion.

**Контроль:** save/migration/cat-death/ending regression, browser unavailable-storage/corrupt-save, check/build.

## P10.2 — единственный пишущий tab

**Файлы:** app save ownership helper, storage adapter, tests/browser.

**RED:** первый tab владеет Web Lock; второй не запускает needs/economy и не пишет; после освобождения lock продолжает с последнего сохранения, не из своей старой копии. При storage event/revision mismatch fallback tab приостанавливается до записи.

**GREEN:** Web Locks где доступны; иначе revision comparison + storage event с честным best-effort ограничением. Никаких merge нескольких runs, lease protocol или server lock. Потеря ownership — pause reason; восстановление перечитывает save.

**REFACTOR:** lock/dispose/retry не создают несколько timers. UI ожидания остаётся panel состояния приложения, не четвёртый игровой view.

**Контроль:** два реальных Playwright pages и unit fallback cases, check/build. Simultaneous race без Web Locks явно не обещать устранённым.

## P10.3 — lifecycle и восстановление страницы

**Файлы:** runtime/browser adapter, lifecycle tests, browser/manual protocol.

**RED:** повторные blur/hidden/pagehide не списывают время дважды; resume после app switch или back-forward restore не catch-up-ит; ended run не оживает; pending reveal не теряется; minigame возвращается с тем же attempt/resume cue. Длинный main-thread stall не убивает кота.

**GREEN:** исправить integration при сохранении одного источника времени. Не считать `unload` надёжным. Save на suspension best effort, periodic/immediate writes уже существуют.

**REFACTOR:** убрать дубли listeners и платформенные догадки, не подкреплённые наблюдаемым событием. Не полагаться только на `document.hasFocus()` в тестовом mock: проверить выбранное определение active time на реальных целевых браузерах.

**Контроль:** fake lifecycle regression, поддерживаемые browser checks, ручной iOS/Android app switch/screen lock. Если real device недоступен, пункт остаётся непроверенным.

## P10.4 — graphics context и asset recovery

**Файлы:** renderer/app recovery integration, tests/browser.

**RED:** потеря context не сбрасывает run и не удаляет кота из state; восстановление пересобирает unlock scene; failed image показывает fallback и не повторяет покупку. Ошибка восстановления переводит игру в pause/retry, не оставляет невидимую активную starvation loop.

**GREEN:** на context loss установить recovery pause, сохранить текущий coherent state, пересобрать scene/текстуры при restore, снять только свою pause reason. No automatic new game.

**REFACTOR:** восстановление использует существующий scene builder по unlocked IDs, не отдельный алгоритм. Повторная попытка очищает предыдущие resources/listeners.

**Контроль:** unit lifecycle + browser context-loss extension где поддерживается, вручную проверить восстановление. Неподдерживаемая тестовая возможность отмечается отдельно от прошедшего fake test.

## P10.5 — мобильный DOM, ввод и доступность

**Файлы:** responsive CSS/components, browser specs.

**RED:** portrait 320×568/390×844/430×932; toolbar/resize/orientation не сбрасывают run/catch score/camera discovery. Header доступен поверх cat overlay; все buttons доступны keyboard; History scroll работает; reduced motion не убирает информацию; theme не превращает bars в неразличимые.

**GREEN:** localized CSS/focus fixes. Не отключать pinch zoom, browser back или все touch events на document. На коротком экране уменьшать world/log/optional cards раньше, чем primary action/hit area.

**REFACTOR:** текстовые labels и accessibility semantics без implementation jargon для игрока. Никаких debug controls в production DOM.

**Контроль:** весь существующий набор + accessibility/manual checklist, check/release-content/build.

## P10.6 — production-настройки и вход в Music Lab

**Зависимость:** музыкальные S04 и S07; основная интеграция написана там. Переиспользовать её browser spec вместо второй реализации.

**RED:** в обычном production preview пройти Settings→«Звук» on/off, Settings→«Музыка»→Music Lab→обратно. Toggle управляет реальным audio lifecycle, не только иконкой; preference переживает reload; до gesture нет неожиданного autoplay. Lab entry доступен без dev flag. Игра сохраняется/приостанавливается при переходе, в Lab её симуляция не работает; возврат восстанавливает тот же run без catch-up.

**GREEN:** исправить недостающее menu/backend/multi-page wiring. Нет дополнительных GameView values, второго pref store или включения Lab UI в initial game chunk.

**REFACTOR:** focus/hit areas/navigation согласованы с остальными настройками. Audio failure не мешает закрыть меню и продолжить игру.

**Контроль:** production audio-settings/Lab-return spec, static checks/build. Это обязательный gate основной приёмки; полный звук/review workflow дополнительно принимается в S09.

## Выходной контроль P10

- Save failure/conflict/corruption не обнуляют run незаметно.
- Background/context recovery не вызывают cat death и не дают offline output.
- Reload/retry/tab ownership не дублируют callbacks и награды.
- Мобильные/device-пункты имеют честный статус: прошли, упали или ещё не проверены.
