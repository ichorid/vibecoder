# P03 — три мобильных представления и первый canvas

Зависимости: P02. Читать архитектуру §7–8. Результат — первый действительно играбельный браузерный срез: заработать, купить, увидеть открытие, перейти к коту и вернуться, перезагрузить.

## P03.1 — DOM shell и навигация

**Файлы:** `app/App.svelte`, `ui/GameView.svelte`, `HistoryView.svelte`, `CatView.svelte`, `Header.svelte`, `styles.css`, component tests.

**RED:** на старте Game; HISTORY открывает только текущие записи; CAT открывает Cat; return/Back возвращает Game; переключение view не создаёт новый run и не останавливает экономику. Theme меняется независимо от progression и сохраняется в profile.

**GREEN:** один view enum и простая same-page history integration. UI получает public API/projections через props/context. Theme доступна в Settings panel. В Cat пока статус и пометка незавершённого dev-среза; не имитировать работающие FEED/PLAY/PET.

**REFACTOR:** не импортировать catalog/command handlers из компонентов. History scrollable, Game без обычной прокрутки где помещается.

**Контроль:** component/navigation tests, check/build.

## P03.2 — основной ввод и announcement

**Файлы:** `GameView.svelte`, `UnlockAnnouncement.svelte`, app view wiring, tests.

**RED:** primary action вызывает одну команду; disabled price не списывает деньги; видимые карточки ≤3; купленная карточка исчезает; будущий title отсутствует в text/accessible labels/hidden DOM. Announcement не блокирует CAT/HISTORY; открытие в Cat ждёт возвращения в Game.

**GREEN:** один primary button, текущие offers, короткий log, announcement в области мира. UI acknowledgement после показа/skip; simulation уже применила эффект. Reduced motion показывает статический reveal.

**REFACTOR:** не хранить вторую копию баланса или unlock-state в Svelte. Взаимодействие после удаления карточки сохраняет осмысленный focus.

**Контроль:** component tests + progression regression, check/build.

## P03.3 — геометрия header и компактный layout

**Файлы:** `Header.svelte`, CSS, browser specs/config, package scripts.

**RED в Playwright:**

1. При 320×568 и 390×844 основная кнопка доступна, Game не требует горизонтальной прокрутки.
2. CAT hit area ≥44×44; обе полосы ≤ширины icon button, высота 3–4 CSS px, gap 2–3 px, расположены снизу.
3. Полосы показывают health/mood, без видимых процентов/fullness/большой панели.
4. Keyboard достигает навигации/действий; переключение темы не меняет stage.

**GREEN:** grid с flexible world, `100dvh`/fallback, safe-area, viewport meta без запрета zoom. Добавить `test:browser`, настроенный на production build/preview и этот первый настоящий spec. Не делать высоту кнопок зависимой от текущих цифр.

**REFACTOR:** убрать абсолютные привязки всего экрана; координаты canvas не должны определять DOM layout.

**Контроль:** этот browser spec + component tests, check/build. В CI установить только нужные Playwright browsers и запускать реальный spec.

## P03.4 — настоящий Pixi host

**Файлы:** `world/WorldCanvas.svelte`, `renderer.ts`, `sprites.ts`, небольшой временный room/cat art, tests.

**RED:** unit lifecycle contract вызывает dispose один раз; browser видит один canvas, он не пересоздаётся при Game → Cat → Game; resize не сбрасывает output/unlocks. Не подменять renderer пустым мок-компонентом в browser-проверке.

**GREEN:** создать реальный Pixi Application, стабильный root и маленькую комнату с программистом/котом. Scene geometry — временная, но изображение существует. Управлять видимостью host, не уничтожая context на каждом переходе. Тикер останавливается вне Game; браузерные listeners имеют cleanup.

**REFACTOR:** canvas lifecycle отдельно от рисования. Sprite frames/positions не попадают в Svelte store. Здесь ещё нет полного LOD или production-арта.

**Контроль:** browser smoke с настоящим Pixi, lifecycle tests, check/build.

## P03.5 — первый вертикальный acceptance flow

**Файл:** `tests/browser/first-loop.spec.ts`.

**RED:** новый browser context → WRITE CODE → покупка → announcement → Cat → Game → следующий offer → reload → тот же прогресс. Убедиться, что будущее название не появилось до prerequisites.

**GREEN:** исправить только отсутствующую интеграцию уже написанных модулей. Не добавлять test-only кнопки выдачи ресурсов или четвёртый route. Небольшая подготовка допустима обычными нажатиями.

**REFACTOR:** browser locators по ролям/устойчивым public labels, а не CSS-структуре или координатам каждой иконки.

**Контроль:** весь существующий набор. Записать, какие визуальные элементы пока временные.

## P03.6 — настройки, звук и подменю музыки

**Файлы:** `ui/SettingsMenu.svelte`, music submenu/audio-control host, Header, component/browser tests.

**RED:** из header открываются «Настройки», внутри есть theme, переключатель «Звук» и пункт «Музыка»; из него — audio controls и «Music Lab». Back в подменю возвращает настройки, close/Escape возвращает focus кнопке открытия. Menu/submenu не добавляют game view/route и не сбрасывают run.

**GREEN:** локальные DOM panels и узкий injected audio-control contract. Theme работает сразу; реальный Tone backend/сохранение аудионастроек подключаются в музыкальном S07 после S02. До этого development-срез честно показывает недоступность аудио и не утверждает, что sound toggle уже создаёт звук. Ссылка ведёт на production entry `/music-lab/`, добавляемый S04; не скрывать её за developer flag.

**REFACTOR:** не реализовывать второй audio preference store здесь. Component tests могут использовать явный fake public audio API, но доказательство слышимости обязательно позже в S07/P10.6.

**Контроль:** menu geometry/focus/navigation browser test, check/build. Полная audio acceptance этой точки имеет отдельную зависимость S07, не блокирующую создание раннего shell.

## Выходной контроль P03

- Ровно Game/History/Cat; reload и theme работают через настоящую persistence.
- Один живой Pixi canvas и доступный DOM input.
- Settings и Music submenu существуют как панели; sound/Lab wiring отмечено для S07 и production-проверки P10.6.
- Header геометрия проверена браузером, не только по CSS-тексту.
- Это ранний срез: завершённая механика кота и финальные картинки ещё не заявляются.
