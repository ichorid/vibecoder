# P02 — первый игровой цикл, открытия и сохранение

Зависимости: P01. Читать архитектуру §3, §5, §10 и транзакцию открытия в общем плане. Результат — headless игра с первыми тремя технологиями и настоящим resume.

## P02.1 — WRITE CODE и первые цены

**Файлы:** `game/economy.ts`, `commands.ts`, `content/balance.ts`, `upgrades.ts`, `technologies.ts`, tests.

**RED:** WRITE CODE даёт +1 output; недоступная покупка не меняет баланс и возвращает unaffordable/unavailable; покупка за ровно 10 доступна, за 9 — нет; lifetime output не уменьшается при покупке; двойная покупка одноразового upgrade невозможна.

**GREEN:** первые цены 10/30/90 output и эффекты из общего плана. Принятая ручная команда ставит work в очередь; ближайший 100 ms production step переводит его в output один раз. Тест проверяет результат после этого шага и отсутствие повторного начисления на следующем. Точный seed фиксируется в тесте, хотя экономика пока не случайная.

**REFACTOR:** эффекты вычисляются из владения/уровней. Нельзя добавлять повторный multiplier при каждой пересборке derived rates.

**Контроль:** economy/commands tests, check/build.

## P02.2 — открытия и видимость

**Файлы:** `game/progression.ts`, `selectors.ts`, catalog types, тесты.

**RED:**

- До prerequisites название snippets не находится в GameViewModel/HistoryViewModel, в том числе среди disabled offers.
- Первый доступный offer можно видеть до накопления цены; будущие предложения отсутствуют.
- Покупка Autocomplete один раз применяет +1, добавляет History/pending unlock.
- Повторный расчёт progression и повтор acknowledgement не дублируют эффект/запись.
- До acknowledgement не показывается следующий progression offer.
- IDE даёт +1 output/с и смену primary action; пауза не производит output.

**GREEN:** typed definitions первых трёх технологий, selector максимум трёх текущих карточек, stable priority. Только текущие read models доступны будущему UI.

**REFACTOR:** название/описание/цена — из каталога. Не показывать `locked`, общее число стадий или внутреннюю фазу.

**Контроль:** progression/selectors/economy tests, check/build.

## P02.3 — проверки каталога

**Файлы:** `tools/validateContent.ts`, тесты, manifest contracts, package scripts.

**RED:** дубли ID, отсутствующий prerequisite, цикл обязательного графа, отрицательная цена, неизвестный effect, отсутствующая ссылка на illustration/world addition. Валидный каталог из трёх элементов проходит.

**GREEN:** небольшой validator и `npm run check:content`, включённый в `check`/CI. На этой стадии проверять структуру ссылок и присутствие временных manifest entries. Финальная проверка физических asset-файлов/placeholder вводится в P06/P08; отсутствие production-арта явно остаётся долгом, а не скрывается фиктивным успехом.

**REFACTOR:** повторно использовать typed definitions, но не импортировать Svelte/Pixi в validator.

**Контроль:** validator tests, check/build.

## P02.4 — envelope и безопасная загрузка

**Файлы:** `persistence/save.ts`, `migrations.ts`, save types/tests, in-memory storage helper.

**RED:**

1. JSON roundtrip сохраняет run, RNG, pending unlocks и профиль; не сохраняет canvas/pointer/current view.
2. Невалидный JSON, NaN/Infinity после внешнего ввода, неверные диапазоны, неизвестные IDs и будущая schema version отклоняются.
3. `alive=false` несовместимо с отсутствующим death fact; load не оживляет кота.
4. Сломанный save сохраняется как есть до явного решения игрока; нет автоматического createRun.
5. Открытие save после долгой wall-clock паузы оставляет activeMs/ресурсы/кота неизменными.

**GREEN:** schema/content version 1, decode из unknown, discriminated LoadResult. Ввести identity migration только для текущего формата; не придумывать исторические схемы. Реальные migration fixtures появятся при реальном изменении формата.

**REFACTOR:** одна envelope на профиль/run, один JSON decoder. Не добавлять fallback на старый run.

**Контроль:** persistence tests, game regression, check/build.

## P02.5 — автоматическое сохранение

**Файлы:** `app/createGame.ts`, runtime/save integration tests.

**RED:** dirty run сохраняется через пять active секунд; покупка/unlock запрашивают немедленную запись одной envelope; повторный чистый tick не пишет; отказ storage не обнуляет state; suspension записывает уже обработанный допустимый elapsed; reload не применяет эффекты покупки заново.

**GREEN:** save adapter вызывается app после committed transition. Primary clicks коалесцируются. Ошибка записи — typed состояние приложения с retry, не exception из game.

**REFACTOR:** save cause — небольшие явные причины, не общая транзакционная платформа. Пока поддерживается одна вкладка; ownership решается в P10.

**Контроль:** все существующие unit/rule tests, check/build.

## Выходной контроль P02

- Командами можно заработать, купить три улучшения и увидеть пассивный output.
- Никакое будущее название не выходит через read models.
- Resume восстанавливает текущий run без offline прогресса и повторных эффектов.
- Сломанное/незаписываемое хранилище обработано явно.
