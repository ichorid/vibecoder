# P05 — PLAY, честный ввод и вмешательства кота

Зависимости: P04. Читать архитектуру §6: timing/attention. Результат — законченная система care с ручным вниманием игрока.

## P05.1 — геометрия попытки

**Файлы:** `game/catPlay.ts`, `catPlay.test.ts`, balance/types.

**RED:** normalized mouse position проходит 0→1→0 без выхода за границы; один timestamp даёт одну позицию; hit на обоих краях target включён, near miss ≤0,03, дальше miss. Target width 0,15–0,30, всегда помещается в track; новый attempt получает новые sampled parameters, но случайное совпадение допустимо.

Отдельный тест ограничивает speed так, чтобы минимальное окно попадания было ≥200 мс. Начальный диапазон speed 0,40–0,75 нормализованной длины/с; не увеличивать сложность до mobile playtest.

**GREEN:** чистые функции `mousePosition` и `scoreAttempt`; генератор параметров с cat RNG. Rendering и scoring используют одну position-функцию.

**REFACTOR:** никаких DOM widths в симуляции; никакого отдельного «упрощённого» scoring для тестов.

**Контроль:** catPlay unit tests, check/build.

## P05.2 — три попытки и награды

**Файлы:** catPlay state union, commands, simulation/tests.

**RED:** ready → moving → result → следующий attempt; ровно три попытки; stale/duplicate attempt ID не даёт награды; miss timeout; hit +8–12, near +1, cap100. Три удачи дают 24–36 суммарно без cap. При mood около 100 проверять cap отдельно.

**GREEN:** ready 300 ms, movement slot 4 000 ms, result 300 ms. При раннем hit анимация/результат фиксируются сразу, но следующий раунд начинается не раньше конца текущего movement slot; обычная сессия занимает около 13,8 секунды. No completion bonus.

**REFACTOR:** processed attempt нельзя повторно «сыграть» после смены screen/reload. Удалять завершённую сессию без удаления care facts.

**Контроль:** command/play/simulation tests, check/build.

## P05.3 — DOM track и touch input

**Файлы:** `ui/CatPlay.svelte`, presentation helper в app, browser spec.

**RED:** PLAY не создаёт четвёртый view; CATCH через pointerdown записывает один результат даже при последующем click; Space/Enter работают, autorepeat игнорируется. На 320/390 CSS px track корректен, resize не меняет результат для одинаковой normalized позиции.

**GREEN:** DOM mouse transform от active clock через owned disposable presentation helper. Input time нормализуется browser adapter и передаётся в command context. Не использовать последний 10 Hz snapshot или индекс нарисованного кадра для scoring.

**REFACTOR:** общая активация для pointer/keyboard без дублирования. History сохраняет scroll; `touch-action` ограничен кнопками/нужной поверхностью.

**Контроль:** browser timing spec с воспроизводимыми входами, pure score tests, check/build. Эмуляция не доказывает fairness на телефоне.

## P05.4 — pause, resume, leave и смерть

**Файлы:** catPlay/runtime/store integration tests, Cat view wiring.

**RED:** background сохраняет позицию/attempt, не начисляет reward; resume cue 500 ms не перемещает mouse, после него продолжается та же попытка. Offset origin исключает скачок. Reload восстанавливает сессию из save. Leave cancels оставшиеся попытки без бонуса. Смерть отменяет всё и не позволяет позднему input дать mood.

**GREEN:** явный ready/resume phase; один active clock. Нужды/экономика не получают дополнительной паузы от cue. Длительная фоновая пауза не съедает весь movement slot.

**REFACTOR:** не создавать второй wall-clock timer в компоненте. Saved timestamps относятся только к active time.

**Контроль:** lifecycle/play/save regression, browser leave/reload, check/build.

## P05.5 — foreground attention

**Файлы:** cat attention schedule в game, `ui/CatOverlay.svelte`, CSS, tests/browser.

**RED:** mood≥40 — нет блокирующего overlay; 20–39 — малая помеха; <20 — крупная, временно блокирующая primary action. Deadline/cooldown из общего плана. CAT/HISTORY/return всегда доступны. Нажатие на кота открывает Cat. Dead/ended/History/Cat не показывают overlay.

**GREEN:** состояние расписания — active-time data; изображение — отдельный DOM sprite поверх controls, не второй WebGL canvas. Ввод перехватывает только footprint. После долгого пребывания в Cat/History допускается максимум одно актуальное вмешательство при возвращении, не очередь пропущенных.

**REFACTOR:** care уменьшает настроение/потребности обычными правилами; просто закрыть overlay не даёт mood. Полосы не увеличиваются и не превращаются в warning banners.

**Контроль:** browser blocked-button/accessible-header flow, все cat tests, check/build.

## Выходной контроль P05

- PLAY действительно требует три ручных решения и занимает 10–20 секунд в обычной сессии.
- Счёт не зависит от fps, физического размера track или дублирующих touch events.
- Навязчивый кот мешает, но всегда оставляет путь к уходу.
- Freeze/resume/reload/leave/death не дают повторных наград.
