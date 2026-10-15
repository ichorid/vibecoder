# P07 — агенты, ревью и координация

Зависимости: P06. Читать архитектуру §5 и табличный перечень 28 milestones. Результат — качественно меняющийся игровой цикл до manager agent включительно, а не только новые подписи/множители.

## P07.1 — токены, агент и compute

**Файлы:** economy/commands/effects/types/tests; content/balance и первые agent definitions.

**RED:** один агент производит только при достаточных tokens/compute; частичное снабжение даёт частичную работу, не отрицательные stocks. Бесплатный manual/recovery contribution не облагается token cost. Повторный расчёт derived rates не удваивает capacity. Zero tokens оставляет восстановление без дополнительного экрана/будущей покупки.

**GREEN:** первый агент вводит agent capacity, token stock/supply и compute capacity. Начальная content-настройка для тестируемого среза: 1 agent, compute на 1 agent, потенциальная работа 4 output/с, token cost 1/work, supply 2 tokens/с, стартовый запас 120. Это намеренно создаёт видимую потребность в supply/efficiency. Manual/recovery contribution считать отдельно от token-funded agent work.

**REFACTOR:** один расчёт potential/funded/useful work; не симулировать каждый нарисованный agent. Resource introduction flags входят в effects, UI получает только текущие counters.

**Контроль:** economy/commands/selector tests, прежний care-independence scenario, check/build.

## P07.2 — review и technical debt

**Файлы:** economy/balance, autonomous edits/reviewer definitions, tests.

**RED:** unchecked work копит debt; review уменьшает debt без генерации новых токенов; debt не ниже0 и не делает efficiency отрицательной. Automated tests доступны уже при autonomous edits. Ревью работает при ограниченной генерации, оставляя путь восстановления.

**GREEN:** стартовая debt gain 0,05 за unchecked work; quality efficiency `max(0.2, 1/(1+debt/100))`; reviewer удаляет 0,5 debt/с. Базовый testing при autonomous-edits снижает unchecked fraction с 1 до 0,5, но не добавляет отдельный 29-й milestone. `uncheckedWork` считать от funded agent work до штрафов useful output: потраченное, но плохо скоординированное выполнение тоже создаёт debt. Manual recovery не копит agent debt.

**REFACTOR:** rate/threshold values в balance, примеры текста в events. Не добавлять backlog каждой фиктивной pull request, real git или LLM calls.

**Контроль:** debt boundary/recovery tests, caring/no-care economy comparison, check/build.

## P07.3 — parallel agents и координация

**Файлы:** economy/effect handling, parallel/worktrees/manager definitions, tests.

**RED:** больше agents повышает potential work, но compute/token caps и coordination overhead ограничивают useful work. Manager/worktrees уменьшают соответствующий bottleneck и не бесконечно умножают все rates. При capacity saturation покупка имеет честное локальное описание.

**GREEN:** начальная формула coordination efficiency `max(0.2, min(1, managedAgentCapacity / max(1, agents)))`. Начальная managed capacity=1; worktrees добавляет1, manager добавляет4. Это простые стартовые коэффициенты в balance, не scheduler тысяч задач.

Для управляемого recovery и разных маршрутов ввести четыре небольших repeatable upgrades. Все цены — output; base price умножается на `2^currentLevel`, максимум8 уровней:

| Upgrade | Появление | Эффект уровня | Base price |
| --- | --- | --- | --- |
| Token supply | terminal-agent | +4 tokens/с | 100 |
| Compute slot | terminal-agent | +1 compute capacity | 150 |
| Additional agent | parallel-agents | +1 agent | 120 |
| Review capacity | reviewer | +0,5 debt/с review | 200 |

Selector выбирает progression/recovery card прежде optional repeatable, сохраняя максимум три. Рост supply/agents без усиления review должен позволять накопить debt для конфликтной ветки; усиление review позволяет стабилизироваться. Эти два реальных пути проверяются сценариями, а не fake debt setter.

**REFACTOR:** новый effect kind добавляется в union с exhaustive handling; никакого центрального `if (technologyId === ...)` для каждой покупки.

**Контроль:** coordination/compute/token tests, check/build.

## P07.4 — полный ранний каталог

**Файлы:** технологии 04–12, upgrades/world/assets/events, validator/tests.

Вводить по одному переходу: terminal agent → autonomous edits → tool permissions → persistent instructions → Ralph loop → reviewer → parallel agents → worktrees → manager agent. Для каждого повторять:

1. **RED:** prerequisite/offer visibility, доступность покупки, конкретно устранённый bottleneck, once-only effect и новый action/scene target.
2. **GREEN:** определение, уникальная иллюстрация, kit composition, короткий humorous text.
3. **REFACTOR:** shared definitions вместо копипасты; не менять stable IDs уже сохранённого контента.

Смены primary action: terminal agent — PROMPT с task responsibility; parallel agents — DELEGATE; manager — SUPERVISE. Каждый action имеет bounded contribution и после автоматизации его старая ответственность переходит passive rule. Бесплатная recovery-возможность остаётся внутри текущего action; отдельная management-панель не появляется.

**Контроль на каждый переход:** content + targeted effect test + save/resume + check/build. После всех — browser flow от начальной комнаты до первых agents/review, остальные transitions можно проверить headless.

## P07.5 — сценарий без тупиков и первые narrative records

**Файлы:** `tests/scenarios/early-automation.test.ts`, небольшой scenario helper, events/achievements.

**RED:** новый run обычными командами достигает manager; минимум один участок реально token-limited, один debt/coordination-limited. При временно плохом решении/zero tokens существует recovery. Шумный joke не затирает discovery/death. Значимая история не дублируется.

**GREEN:** сценарий использует только текущие offers и публичные команды; acknowledgements включены. Flavor log bounded, event predicates/cooldowns заданы. Добавить только несколько нужных ранних jokes/achievements; все будущие скрыты.

**REFACTOR:** scenario helper не становится production autobuyer. Подготовить именованные strategy actions для следующих фаз.

**Контроль:** весь существующий набор; ранний ручной playtest с care interruptions.

## Выходной контроль P07

- Минимум 12 технологий имеют effects/арт/world additions.
- Игрок действительно переходит от прямого труда к управлению bottlenecks.
- Manual, agent, review и coordination contribution различаются в поведении.
- Кот не влияет на производственные формулы и продолжает требовать ухода.
