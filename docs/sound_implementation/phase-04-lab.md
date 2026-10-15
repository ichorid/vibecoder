# S04 — Music Lab в основной сборке

Зависимости: S03. Читать sound architecture §8. Результат — четыре настоящих playback режима в отдельном Svelte entry, доступном также в production через настройки, без изменения трёх игровых views.

## S04.1 — entry и read models

**Файлы:** `src/music-lab/main.ts`, `App.svelte`, `music-lab/index.html`, Vite multi-page config, Lab browser spec.

**RED:** `/music-lab/` открывает Lab в dev и production preview; обычный build содержит оба HTML entry. Первый экран Game не загружает Lab/Tone заранее. Lab startup не создаёт game run и не запускает экономику. Один engine на Lab document.

**GREEN:** Vite multi-page inputs для `index.html` и `music-lab/index.html`, `dev:music-lab` как удобная команда открытия той же страницы. Не вводить SvelteKit/router или четвёртый view enum. Музыкальные source JSON лежат вне Vite public directory; production Lab загружает demo/published catalog, остальные candidates импортируются локально. Game entry не зависит от Lab UI, review comments и raw rejected drafts.

**REFACTOR:** Lab принимает catalog/director/review projections; компоненты не импортируют Tone. Resource cleanup на document/mode disposal.

**Контроль:** оба production routes, game entry dependency/network check, общий check/build.

## S04.2 — Single Pattern

**Файлы:** list/selection/playback components, Lab public controller, tests.

**RED:** выбрать/услышать любой valid demo revision; current pattern отображается в слышимый момент; loop использует boundary; смена selected не наслаивает второй engine. Hard-invalid pattern получает diagnostics, не PLAY. Tempo override помечен audition-only.

**GREEN:** Single controls, current ID/revision/era/source, volume/mute и tempo display. Не создавать встроенный piano-roll editor.

**REFACTOR:** selection и playing IDs различаются; текущий audio callback приходит через backend-synchronized notification.

**Контроль:** component/browser Single flow + реальное короткое прослушивание, check/build.

## S04.3 — Random Sequence

**RED:** approved-only без approvals показывает пустой результат; explicit demo toggle позволяет четыре временных материала в выбранных допустимых banks. Выбор era фильтрует candidates; нет immediate repetition при двух demos; пять минут расписания без ручного нажатия NEXT.

**GREEN:** тот же shuffle-bag/player, что в game runtime. Во время demo playback заметный label; records не получают fake approval. После reviews в S05 тот же режим заработает с approved subset.

**REFACTOR:** не писать отдельный Lab random sampler. Display bag counts не раскрываются в game UI.

**Контроль:** seeded browser/director flow, bag regression, check/build.

## S04.4 — Transition Test и Evolution

**RED по одному режиму:** A→B intra/cross era проходит boundary; заведомо сомнительная пара допускается только как явный Lab audition с warning; structural hard error не допускается. Evolution проходит6 states/≈96 s и показывает fallback stages. При смене mode старый schedule/voices исчезают.

**GREEN:** controls выбора A/B и preview timeline из S03. Синхронизация реальная, без browser `setTimeout` для музыки. Invalid/missing candidates не запускают бесконечные retry.

**REFACTOR:** reusable mode lifecycle, один director, small control state. Отмена Evolution не меняет review/композиции.

**Контроль:** четыре mode browser flows, real cross-era listening, check/build.

## S04.5 — desktop/mobile usable UI

**RED:** filters/list/transport доступны keyboard; на ширине390 px actions не обрезаны, feedback area/scroll работают; switch mode/era не сбрасывает audio preferences. Загрузка/ошибки понятны, unhandled audio promises отсутствуют.

**GREEN:** обычный responsive Svelte/CSS layout; Lab может scroll и показывать больше технических сведений, чем player game. Не копировать компактный game HUD ценой неудобного review.

**REFACTOR:** reusable accessible controls без нового component library.

**Контроль:** component/browser viewport flows, весь music набор, check/build.

## Выходной контроль S04

Все4 режима реально проигрываются общим engine. Демо доступны сразу, но approved-only честно пуст до review. Lab доступен в public build отдельным entry и не требует изменения game view enum. Desktop и мобильная ширина пригодны для работы. Переход через settings подключается в S07.
