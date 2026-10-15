# P04 — независимая жизнь кота и необратимая смерть

Зависимости: P03. Читать архитектуру §6 и стартовые параметры общего плана. Результат — настоящий care loop, кроме PLAY и attention overlays, которые вводятся в P05.

## P04.1 — нужды и одновременные состояния

**Файлы:** `game/cat.ts`, `cat.test.ts`, `content/balance.ts`, simulation integration.

**RED:**

- После 4 900 active ms нужды ещё не изменились; на 5 000 происходит один needs tick.
- Fullness уменьшается на 0,65, mood — на 0,45 без действий; значения остаются в 0–100.
- За 1/10/1 000 осмысленных действий modifier равен 1%/10%/10%; после tick сброшен.
- Care, navigation, theme, mouse catch не ускоряют нужды.
- Hungry/lonely/overfed могут быть одновременно true; mood 40/70 и fullness 35 проверяются с обеих сторон порога.
- Пять минут скрытого времени не меняют кота через runtime.

**GREEN:** узкая cat-функция без economy-аргумента. Условия выводятся из чисел; animation не является состоянием здоровья. Подключить update после экономики и до endings/progression.

**REFACTOR:** rates/thresholds в balance; приоритет presentation — отдельно от независимых condition flags.

**Контроль:** cat/runtime/simulation tests, check/build.

## P04.2 — FEED и PET

**Файлы:** `game/cat.ts`, command integration, `ui/CatView.svelte`, `Header.svelte`, tests.

**RED, отдельными циклами:**

1. FEED живого кота даёт целое 18–32, максимум fullness 100; accepted FEED продвигает cat RNG.
2. Повтор до 1 000 active ms отклонён и не тратит RNG; после границы принят.
3. PET сразу после нового run разрешён; +3 mood; до 60 000 ms повтор не награждает.
4. Во время PET cooldown остаётся cosmetic response; profile/save не позволяют обойти cooldown reload-ом.
5. Care update меняет bar по настоящему health/mood; fullness доступен только в Cat.

**GREEN:** типизированные команды; timestamps живут в cat state. В Cat настоящие FEED/PET, PLAY пока недоступен с development-статусом незавершённости, без ложной награды. Cosmetic response отдельно от gameplay reward.

**REFACTOR:** один handler на активацию кнопки, без pointer+click двойного кормления. Ожидаемые cooldown-отказы не засоряют event log.

**Контроль:** cat/commands/persistence tests, targeted browser care spec, check/build.

## P04.3 — starvation, восстановление, перекорм

**Файлы:** cat/balance/tests, визуальное отображение condition.

**RED:** обычная starvation ниже 20 и тяжёлая ≤5 используют разные rates; кормление прерывает starvation, но не лечит мгновенно; выше 35 здоровый кот восстанавливает health постепенно. Один лишний приём не вызывает sick; повторные переходят пороги 40/80; время без избыточной еды снижает pressure.

Отдельные тесты: болезнь ускоряет mood loss, health penalty сама по себе не опускает ниже 10; здоровая сытость при mood 0 не вызывает смерть. Сочетание болезни и голода не защищает от starvation death: lower bound болезни нельзя применять после starvation как «воскрешение до 10».

**GREEN:** порядок расчёта и источники повреждения явны. Избыточный приём учитывается один раз; fullness cap не превращает spam в безопасную стратегию.

**REFACTOR:** не добавлять currency, automated feeder или эффективность производства от care.

**Контроль:** boundary tests + no-care headless simulation до смерти за <30 active min, check/build. Это ещё не проверка полного сюжета.

## P04.4 — смерть, запись и мемориал

**Файлы:** simulation/commands/narrative event integration, `CatView.svelte`, header, world projection, save tests.

**RED:**

- Starvation health=0 фиксирует `alive=false`, death time, ровно одну запись/строку “The cat is gone.” и immediate save request.
- Каждый последующий tick не повторяет death event.
- FEED/PET/PLAY после смерти отвергнуты и не расходуют RNG.
- Reload сохраняет смерть и отсутствие world sprite. Нарушенный save не чинится созданием живого кота.
- Header: deceased icon и две пустые серые полосы; Cat: ровно две счастливые фотографии, никаких статусов/care buttons.

**GREEN:** смерть атомарна, терминальна в этом run. Экономика продолжает работать. Показ мемориала не является новым экраном. До P06 допустим явно отмеченный временный арт двух фотографий; финальный арт обязателен позже.

**REFACTOR:** world/DOM получают факт `alive`; не вводить независимые `catVisibleAlive`/`memorialMode` в save.

**Контроль:** cat-death browser spec с валидной fixture, save/unit tests, check/build.

## P04.5 — независимость ухода от продуктивности

**Файлы:** `tests/scenarios/cat-independence.test.ts`.

**RED:** два запуска с одинаковыми economic inputs и active duration, но разным уходом, дают одинаковые balances/rates/automation/цены. Один кот жив/ухожен, другой может умереть. Не сравнивать care stats или ending variants как часть экономики.

**GREEN:** устранить случайные бонусы/штрафы от cat state. Время ухода расходуется, passive production продолжается; тест равной продуктивности предполагает одинаковые economic inputs и не утверждает, что реальный игрок одновременно жмёт два экрана.

**REFACTOR:** сохранить этот сценарий как обязательную регрессию при будущих технологиях.

**Контроль:** весь существующий набор и browser care/death flows.

## Выходной контроль P04

- Cat decay запускается только проверенными active-time часами.
- Игнорирование смертельно, mood не смертелен, обычный перекорм обратим.
- Смерть переживает reload и не прекращает основную игру.
- FEED/PET требуют внимания; никаких production modifiers от кота.
