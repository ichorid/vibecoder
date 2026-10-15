# P08 — полный путь из 28 технологий

Зависимости: P07. Читать архитектуру §5, §7, §9. Результат — вся основная автоматизация, финальный масштаб и полный арт. Разветвлённые концовки добавляются в P09; здесь сценарий достигает autonomous company и остаётся в играющем состоянии.

## P08.1 — зафиксировать контентную таблицу до расширения кода

**Файл:** `docs/content_catalog.md`, затем catalog definitions/tests.

Записать для каждого ID prerequisites, offer rule, цену/валюту, effects, новый bottleneck, primary action, illustration ID, world addition/envelope. Это рабочая таблица автора, не четвёртый экран.

| № | ID | Изменение поведения / визуальный мотив |
| --- | --- | --- |
| 01 | `autocomplete` | Усиление ручного ввода; подсказка на мониторе |
| 02 | `generated-snippets` | Ещё меньше ручного набора; блоки кода |
| 03 | `ai-native-ide` | Первое passive output; IDE-панели |
| 04 | `terminal-agent` | Agent work/token supply; терминальный процесс |
| 05 | `autonomous-edits` | Автоправки с базовым testing; edit/test loop |
| 06 | `tool-permissions` | Доступные операции/меньше ограничений; tool gates |
| 07 | `persistent-instructions` | Меньше повторного ручного задания; instruction node |
| 08 | `ralph-loop` | Повторение задач системой; цикл исполнения |
| 09 | `reviewer` | Снижение debt; review/test node |
| 10 | `parallel-agents` | Capacity и coordination pressure; ветвящиеся agents |
| 11 | `worktrees` | Меньше конфликтов координации; параллельные линии |
| 12 | `manager-agent` | Автоматизация части delegation; supervisor |
| 13 | `context-management` | Меньше потерь на контекст; context buffers |
| 14 | `persistent-memory` | Меньше повторной работы; memory bank |
| 15 | `model-routing` | Ниже token cost, новая настройка; router |
| 16 | `token-optimization` | Эффективное снабжение; token compressor |
| 17 | `local-servers` | Compute expansion; server ring |
| 18 | `custom-harness` | Объединение tools/context/runner; subsystem frame |
| 19 | `meta-harness` | Управление harness-ами; supervisory layer |
| 20 | `evaluations` | Больше автоматического контроля quality; eval loop |
| 21 | `workflow-optimization` | Автоматизация настройки; optimizer |
| 22 | `self-improvement` | Самонастройка с control responsibility; recursive feedback |
| 23 | `self-driving-repositories` | Автономный software pipeline; repository network |
| 24 | `product-management` | Решения о продукте/монетизация; product node |
| 25 | `marketing` | Доход/распространение; growth links |
| 26 | `finance` | Revenue spending/operating costs; finance subsystem |
| 27 | `executive-agents` | Организационные решения; executive hierarchy |
| 28 | `autonomous-company` | OBSERVE и финальный масштаб; computational organization |

Уже реализованные P07 IDs должны совпасть с таблицей; при необходимости исправить до появления публичного сохранения или добавить явное ID mapping. «Все 28» проверяется authoring/release validator, не DOM.

**RED:** validator отклоняет пропущенную обязательную запись, дублирующий ID и текущую технологию без конкретного эффекта/визуала; предыдущий ранний сценарий продолжает проходить.

**GREEN:** сначала дописать таблицу. Цены последующих переходов рассчитывать от наблюдаемого useful output выбранной baseline strategy: ориентир — 30–90 секунд текущего производства на одно открытие, с учётом уже открытых ресурсов/затрат. Записать конкретные числа до реализации соответствующего пакета, а не оставлять формулу с неизвестными параметрами в production catalog. Полный баланс уточняется в P11.

**REFACTOR:** различать эффект одноразовой технологии и повторяемого upgrade. Новые rates не должны автоматически становиться ещё одной валютой.

**Контроль:** content checker и ранний scenario. Это задача authoring + проверки, не повод писать тесты на существование Markdown-файла.

## P08.2 — инфраструктура, ID 13–17

**Файлы:** content/effects/economy, illustrations/world compositions, targeted tests.

Для каждой технологии отдельно: **RED** на её cost/prerequisite, видимость ресурса, once-only effect и восстановление после покупки; **GREEN** — определение/минимальный новый effect/арт; **REFACTOR** — проверить, что старое поведение не продублировано.

Model routing уменьшает token cost с положительным минимумом. Token optimization не делает расход отрицательным. Local servers расширяют compute, но не устраняют coordination/review bottlenecks автоматически. Current header всё ещё содержит максимум три stats.

**Контроль:** соответствующие effect tests, headless маршрут до local servers, check/build. После каждого перехода нужен новый camera envelope и отличимая иллюстрация.

## P08.3 — recursive automation, ID 18–22

**RED:** harness объединяет существующие capabilities без двойных rates; automated evaluations уменьшают ручной review, но не resurrect cat; workflow optimization меняет OPTIMIZE contribution/passive responsibility; self-improvement не запускает бесконечную рекурсию одного tick.

**GREEN:** bounded scalar rules/flags поверх существующей экономики. OPTIMIZE — bounded temporary contribution, не вечное экспоненциальное умножение по каждому нажатию. Контроль/oversight — простая ответственность и статистика для концовок, без второго management simulator.

**REFACTOR:** не вводить code generation, реальное самоизменение JS или arbitrary rule interpreter. «Самоулучшение» является игровой моделью.

**Контроль:** per-tech tests, replay save/resume посреди pending reveal, check/build.

## P08.4 — организации, ID 23–28

**RED:** revenue скрыта до монетизации, после неё начисляется из полезного output; operating margin учитывает расходы; zero money idles unfunded capacity. Final OBSERVE не начисляет фиктивный manual output. Человек/кот визуально исчезают, но cat alive/dead state сохраняется.

**GREEN:** product-management вводит монетизацию; finance — spending и explicit overhead. Core economy не меняется на отдельную корпоративную мини-игру. Организации изображаются повторяемыми motif clusters.

**REFACTOR:** текущие дорогие offers всё ещё доступны через максимум три карточки; старые ненужные показатели/controls исчезают. Базовый main route никогда не требует автокормушки или cat-care bonus.

**Контроль:** late-economy/zero-funds tests, real late-scene browser fixture, check/build.

## P08.5 — production-арт и release validator

**Файлы:** все 28 illustration entries/файлов, world additions, export sources, validator/tests, `check:release-content`.

**RED:** release checker отклоняет placeholder, отсутствующую иллюстрацию/мемориальное фото, невалидный atlas tag, пропущенную scene addition, нерасширяющийся envelope. Наличие одного повторённого placeholder PNG под 28 именами не является выполнением требования.

**GREEN:** доделать уникальные композиции иллюстраций, сохраняя общий kit мира. Release checker проверяет файлы/metadata и отсутствие declared placeholders; визуальная различимость дополнительно проверяется человеком.

**REFACTOR:** pack boundaries/load budgets; не загружать все исходные reference sheets в приложение. Источник и экспорт каждого финального ресурса понятны.

**Контроль:** release-content, bundle/asset report, вручную все 28 reveal и обе темы. Если арта не хватает — задача blocked, а не «готово с заглушками».

## P08.6 — полный headless маршрут

**Файлы:** `tests/scenarios/main-route.test.ts`, strategy helper.

**RED:** из createRun реальными командами достигается autonomous-company, каждый tech effect/history один раз, нет negative/NaN/Infinity, максимальный разумный срок сценария 45 active min. Активное время включает care и acknowledgement/reveal delays.

**GREEN:** устранить невыполнимые цены/prerequisites/recovery conditions. До P11 не требовать точных 30 минут, но записать достигнутое время и где произошли заторы. Нельзя пропускать cost/spend или напрямую выдавать unlock.

**REFACTOR:** strategy берёт текущие read models. Не менять production clock на ускоренный режим; в тесте быстро выполняются обычные 100 ms steps.

**Контроль:** весь существующий набор + release-content. Доказательство «28 достижимы» отдельно от «играть приятно».

## Выходной контроль P08

- Все 28 milestones имеют содержательный переход, иллюстрацию и world addition.
- Полный путь воспроизводимо достижим, без cheats и временных forced unlocks.
- Late-world нагрузка измерена повторно; reveal/care остаются доступны.
- Недостающие финальные арты не скрыты под успешной структурной валидацией.
