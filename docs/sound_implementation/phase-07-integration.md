# S07 — интеграция с игрой и настройками

Зависимости: S06 и основные P01–P03/P03.6. Полный gate mapping требует основного P08; P10 не нужен, поэтому зависимости не циклические. Читать sound architecture §6–8.

## S07.1 — Settings → Звук / Музыка

**Файлы:** `src/app/musicBinding.ts`, app composition, `SettingsMenu.svelte`, `AudioControls.svelte`, production browser spec.

**RED:** переключатель «Звук» в настройках вызывает настоящий public audio API, сохраняет mute preference, обрабатывает gesture rejection и не просто меняет иконку. В Music submenu громкость работает, ссылка Music Lab присутствует без dev flag. Закрытие меню сохраняет focus/run.

**GREEN:** подключить уже созданные P03.6 panels к S02/S03 API и единственному audio-preference adapter. До gesture нет Tone context/обязательной audio-загрузки. На missing approved bank честный status, а не зависший toggle. Любая ошибка даёт возможность продолжить игру без звука.

**REFACTOR:** не добавлять второй sound switch с независимым состоянием. Настройки — panel, music submenu — panel; game view enum остаётся прежним.

**Контроль:** component/public API tests и production settings spec. Для доказательства реального game playback использовать отдельную validated approved test-pack fixture, не выдаваемую за финальный human-approved soundtrack.

## S07.2 — mapping технологий и восстановление

**Файлы:** JSON mapping, `musicBinding.ts`, mapping/director integration tests.

**RED:** same discovered IDs дают тот же era/arrangement независимо от порядка UI notifications; duplicate discovery не вызывает новый start. Mapping: initial→Discovery, terminal-agent→Acceleration, parallel-agents→Orchestration, custom-harness→Recursion, self-improvement→Self-Improvement, autonomous-company→Singularity. Остальные milestones уточняют arrangement внутри era.

**GREEN:** highest matching declarative rule из snapshot, не одноразовый DOM callback. Load/restart вычисляют desired projection заново. Проверка catalog IDs сверяется с реальными game contracts; финально после P08 нет unknown refs.

**REFACTOR:** не хранить отдельный музыкальный progression в game save. Theme/audio preferences не меняют era.

**Контроль:** mapping snapshots по этапам и game unlock→next-boundary test с настоящим director; после P08 — все28 technology IDs валидны, check/build.

## S07.3 — lifecycle, endings и restart

**RED:** Game→History/Cat не останавливает музыку; hidden/blur/app suspend гасит её без catch-up. Ended run заканчивает фразу и stop одинаково для обоих cat outcomes. Restart сбрасывает музыкальный intent на Discovery без старого queued era. AudioContext blocked после resume не блокирует game clock.

**GREEN:** app lifecycle даёт explicit audio intent, Tone transport не является источником игрового времени. Background pause немедленный, terminal stop — phrase boundary; не смешивать эти причины.

**REFACTOR:** game/runtime не импортирует Tone. Event listeners и pause ownership снимаются idempotent; не ставить всю игру на паузу из-за failed audio resume.

**Контроль:** runtime/audio integration + browser pause/reload; реальные iOS/Android проверки в S08/S09.

## S07.4 — кот без музыкальных предупреждений

**Файлы:** allowlisted care-SFX binding, tests.

**RED:** одинаковые technology inputs с живым/мёртвым/голодным котом дают тот же pattern order, era, arrangement и gain plan. Cat death event не вызывает stop/stinger/fade/duck. Applied FEED/PET/PLAY может дать rate-limited короткий SFX; cooldown/rejected команды не спамят его. SFX не меняет RNG музыки или счёт PLAY.

**GREEN:** в music projection нет health/mood/fullness/alive. Только allowlisted explicit care-action event IDs, отдельный SFX bus и общий cap8. Не озвучивать низкое настроение автоматически.

**REFACTOR:** не передавать musicBinding целый RunState «для удобства». Comparative test остаётся обязательной regression.

**Контроль:** binding/SFX tests и реальный короткий mix render, check/build.

## S07.5 — Settings → Music Lab → Game в production

**Файлы:** существующий production browser spec, Lab return control, multi-page deployment config/docs.

**RED:** обычный `npm run build`/preview обслуживает Game и `/music-lab/`; до перехода Game не загружает Lab UI, после перехода Lab работает с четырьмя демо. Game сохранён/не тикает в Lab. Return загружает тот же run без offline decay/output; нет одновременно двух players. Audio preference общая, review/candidates не переписали save.

**GREEN:** обычные same-origin ссылки между entries, save/pause/dispose на page lifecycle, видимая кнопка возврата. `/music-lab` корректно открывает directory entry на выбранном static host. Работает и direct link в Lab без существующего run.

**REFACTOR:** не делать Lab conditional на `import.meta.env.DEV`. Raw repository drafts/reviews не входят в game entry; local import/export остаётся доступен production Lab.

**Контроль:** один shared browser flow используется также основным P10.6; build/asset dependency report. Не дублировать реализацию ради двух планов.

## Выходной контроль S07

Звук и Music submenu работают в основной сборке. Music Lab доступен через настройки, загружается отдельно, возвращает к прежнему run. Mapping покрывает реальный P08 каталог; soundtrack не зависит от состояния кота. Основной P10.6 теперь может выполнить свой gate.
