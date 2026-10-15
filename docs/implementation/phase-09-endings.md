# P09 — события, десять концовок и повторное прохождение

Зависимости: P08. Читать архитектуру §9–10. Результат — законченная игра с минимум десятью различными достижимыми окончаниями. Все численные условия ниже — стартовые именованные balance/ending parameters.

## P09.1 — события и достижения

**Файлы:** `game/narrative.ts`, `content/events.ts`, `achievements.ts`, History selectors/tests.

**RED:** once-per-run событие срабатывает один раз; cooldown flavor не повторяется каждый tick; death/discovery приоритетнее шутки. Timeline не показывает будущие achievements/общий count. Старые ambient строки удаляются из bounded log, значимая история сохраняется.

**GREEN:** короткий упорядоченный список predicates с IDs, cooldowns и tone eligibility. Ранние тексты смешные, поздние тревожнее; cat achievement не даёт экономических бонусов.

**REFACTOR:** убрать специальные event side effects из Svelte. Не добавлять achievements dashboard.

**Контроль:** narrative/history tests, browser History flow, check/build.

## P09.2 — ending resolver и terminal transaction

**Файлы:** ending contracts, resolver, `content/endings.ts`, simulation, save integration tests.

**RED:** один outcome замораживает время/нужды/команды; повторный resolver не добавляет discovery; simultaneous automatic candidates используют явный priority. Cat update этого step уже выполнен, поэтому variant однозначен. Выбор концовки после settle записывает outcome+History+profile discovery одной save envelope.

**GREEN:** сначала одно стандартное завершение `you-have-been-optimized` после autonomous-company и подтверждённого решения убрать human oversight. Это явное ending offer, не автозавершение в момент, когда игрок ещё читает другое предложение.

**REFACTOR:** хранить ending ID, факты variant и active time. Не вычислять старую концовку из нового run.

**Контроль:** resolver/ending/save tests + main-route scenario до настоящего ending, check/build.

## P09.3 — четыре ранних и технических маршрута

**Файлы:** ending/choice definitions, действительно нужные stats, `tests/scenarios/endings/*.test.ts`.

Каждый маршрут — отдельный TDD task внутри P09.3. Сначала падающий command-driven сценарий, затем offer/conditions/text. Инварианты resolver при этом не меняются.

| Ending ID | Условия предложения и решение | Воспроизводимая стратегия |
| --- | --- | --- |
| `three-users` | Есть terminal-agent и lifetime output≥1 000; выбрать «выпустить исходный проект» | До агента, накопить output, принять скромный release вместо expansion |
| `the-last-programmer` | После reviewer выбрать «сохранить ручную работу»; затем ≥120 принятых manual actions после выбора и готов исходный проект; выбрать finish | Decision возвращает WRITE CODE и скрывает дальнейшую автоматизацию; обычные ручные действия и care |
| `the-great-merge-conflict` | Есть parallel-agents и debt≥150; выбрать force merge после локального предупреждения | Расширять supply/capacity, не усиливать review; накопить debt и подтвердить merge |
| `the-greenest-pipeline` | Есть evaluations, debt≤5 непрерывно 120 active s; выбрать freeze feature work | Достаточное review, стабилизация quality, затем остановка feature work |

Исходный проект ready только через наблюдаемые игровые факты, не дополнительный секретный ресурс. В manual-ветке проверять, что прежний action действительно возвращён: retired SUPERVISE не может притворяться ручным написанием кода.

Для merge scenario разрешено выбирать плохие реальные upgrades, но запрещено напрямую назначать debt. Если production rates не позволяют достичь 150, исправить реальную ветку capacity/review в согласованном content-патче; не ослаблять сценарий подстановкой state.

**Контроль:** каждый новый ending scenario + resolver regression, check/build.

## P09.4 — пять оставшихся обязательных маршрутов

Итого с P09.2/P09.3 получится десять. Вводить по одному:

| Ending ID | Условия предложения и решение | Воспроизводимая стратегия |
| --- | --- | --- |
| `the-forgotten-project` | Есть custom-harness, исходный проект не shipped; выбрать archive original | Продолжать инфраструктуру, затем отказаться от исходного проекта |
| `the-perfect-saas` | Есть product-management, net margin>0 120 active s и debt≤20; выбрать small profitable service | Стабилизировать качество/расходы и принять прибыльный небольшой продукт |
| `acquired-by-yourself` | Есть finance; принять self-acquisition offer | Дойти до finance и подтвердить сделку |
| `fully-automated-bankruptcy` | Есть autonomous-company; принять предложенное расширение с предупреждением о превышении текущей выручки; margin<0 120 active s; подтвердить закрытие | Сделать реальный loss-making expansion, дождаться измеряемого убытка |
| `the-human-approval-api` | Есть autonomous-company; выбрать сохранение mandatory approval | Пройти основной путь, сохранить роль подтверждающего человека |

Loss-making expansion имеет фиксируемый overhead, превышающий текущий устойчивый доход на момент решения; это содержательная ветка, а не бесплатное изменение ending flag. Spendable money не становится отрицательным, fixed overhead/margin остаются наблюдаемыми. Такой выбор не появляется без честного локального предупреждения.

**RED:** условия могут быть выполнены обычным маршрутом; decision появляется только тогда; несовместимые committed choices исключаются; repeated confirmation не создаёт вторую концовку.

**GREEN:** точные rules/тексты/нужные stats, минимальные новые экономические эффекты только для loss branch. Выбранная ending choice всегда указывает ровно на один outcome; optional choices не вытесняют обязательное progression/recovery offer из трёх slots.

**REFACTOR:** общие helpers длительности margin/quality — только если уже нужны двум случаям. Не создавать язык сценариев концовок.

**Контроль:** десять command-driven route tests, check/build.

## P09.5 — cat variants, ending panel и restart

**Файлы:** ending texts/variants, `ui/EndingPanel.svelte`, profile/history/restart wiring, tests/browser.

**RED:** успех возможен при живом и мёртвом коте; смысл текста соответствует fate. Ending panel внутри Game, не новый route. Cat/History открываются после окончания без изменения needs. Restart после подтверждения создаёт новый ID/seed, живого кота, чистый run и сохраняет theme/discovered endings; отмена restart ничего не меняет.

**GREEN:** минимум main success имеет обе версии; остальные подходящие окончания также не содержат ложного живого кота. Profile discovery уникален по ending ID; повторное открытие того же ending не создаёт дубликат.

**REFACTOR:** прежние ending facts не зависят от нового run; old-run timeline не подменяется текущим. Текущий run history и profile discoveries явно различаются.

**Контроль:** browser ending→History→restart→другое ending, unit save/profile tests, check/build.

## P09.6 — семь дополнительных концовок, расширение

Не блокирует обязательные десять. По той же схеме можно добавить Enterprise Transformation, Infinite Weekend, Alignment Achieved, Recursive Succession, Closed Loop, Last Real Message и Just Three Buttons. Для каждой сначала определить offer/commit conditions и написать независимый route test.

Для secret route заранее записать конкретный интервал care-only после project-ready, требования meaningful PLAY/FEED и отсутствие дисквалификации от navigation. Не превращать PET spam в shortcut. Никаких locked hints/тотального списка концовок в UI.

## Выходной контроль P09

- Десять ending IDs имеют реальные раздельные route tests из createRun.
- Обе судьбы кота совместимы с успешным автоматизированным окончанием.
- Resolver/save/restart атомарны и idempotent.
- Browser flow подтверждает сохранение discoveries и ровно три views.
