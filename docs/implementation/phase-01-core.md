# P01 — детерминированное ядро и активное время

Зависимости: P00. Читать архитектуру §2–4. Результат — ядро, которое можно тестировать без браузера. Интеграция с реальными событиями браузера появляется после fake-clock проверок.

## P01.1 — новый run и seeded RNG

**Файлы:** `src/game/types.ts`, `ids.ts`, `createRun.ts`, `random.ts`, соответствующие `.test.ts`, `tests/helpers/`.

**RED:**

- Новый run имеет `playing`, ноль active time/output, живого кота 100/85/75/0, пустую историю и отсутствие будущих открытий.
- Два вызова создают независимые вложенные объекты; изменение fixture одного не портит второй.
- Одинаковый seed даёт одинаковую последовательность; RNG-state после JSON roundtrip продолжает ту же последовательность.
- Изменение visual seed не меняет cat RNG. Целый случайный результат включает разрешённые границы.

**GREEN:** небольшая документированная PRNG-функция с явным состоянием. Run ID/seed приходят аргументами из app. Объявлять ID tuples только для вводимого контента; типы расширяются без runtime-импорта каталога.

**REFACTOR:** отличить профиль/run/presentation. Не добавлять все будущие счётчики без потребителя.

**Контроль:** `test:game` для createRun/random, static checks, build. Script `test:game` теперь запускает настоящий Vitest run, без watch.

## P01.2 — логика часов на fake clock

**Файлы:** `src/app/runtime.ts`, `runtime.test.ts`; простые fake clock/lifecycle в `tests/helpers/`.

**RED, по одному тесту:**

1. 1 000 мс разрешённого времени дают десять шагов по 100 мс, остаток 50 мс переносится.
2. Два получения одного monotonic timestamp не дают двойного времени.
3. Hidden/blur/freeze блокируют elapsed; после пяти минут отсутствия resume не делает catch-up.
4. Scheduling gap >1 000 мс отбрасывается. Ровно 1 000 мс допускается.
5. Две причины паузы независимы: снятие одной не возобновляет вторую.
6. Отрицательная/невалидная дельта не перематывает run назад.

**GREEN:** runtime принимает источник monotonic time, lifecycle state и callback шага. Имеет одну точку установки/снятия таймера. Никакой экономики внутри runtime.

**REFACTOR:** повторные suspend/resume/dispose безопасны. Отдельно хранить остаток fixed step и timestamp baseline; не добавлять wall-clock к run после загрузки.

**Контроль:** runtime tests + pure TS config + check/build.

## P01.3 — step и последовательная команда

**Файлы:** `src/game/simulation.ts`, `commands.ts`, domain types/tests, `src/app/createGame.ts`.

**RED:** `stepRun` увеличивает activeMs на 100; ended run не меняется; неизвестная/недоступная команда возвращает unavailable; одна команда видит результат предыдущей; input сначала оплачивает прошедшее допустимое время, затем применяется. Повторно обработанный timestamp не начисляет производство дважды.

**GREEN:** ввести только пустой/минимальный catalog contract и ordered transition. Production и cat update пока остаются отсутствующими подсистемами, а не заглушками, возвращающими фальшивые награды. Для проверки порядка использовать маленький тестовый catalog с одним действием.

**REFACTOR:** факты перехода — возвращаемые данные. Не вводить event emitter, service locator или общий registry произвольных систем.

**Контроль:** simulation/commands/runtime tests, check/build.

## P01.4 — store и browser adapter

**Файлы:** `src/app/gameStore.ts`, `createGame.ts`, browser lifecycle adapter внутри app; тесты.

**RED:** подписчик сразу получает текущий read-only snapshot; unsubscribe прекращает уведомления; приватный mutable state недоступен; input обновляет snapshot атомарно; dispose снимает таймеры/listeners; повторное mount/dispose не умножает шаги.

**GREEN:** минимальный Svelte-compatible subscribe/dispatch API. Freeze snapshots в development. Подключить реальные visibility/focus/pagehide/pageshow события к уже проверенному runtime, не к отдельной копии часов.

**REFACTOR:** исправить границы импорта через composition. Подписчики не сохраняют run самостоятельно.

**Контроль:** все `test:game`, `test:rules`, check/build. Реальная мобильная lifecycle-проверка ещё впереди; fake lifecycle не выдавать за неё.

## Выходной контроль P01

- Один seed и одинаковая последовательность входов дают одинаковый run.
- Неактивное время не влияет на run. Нет competing timers и wall-clock catch-up.
- Чистое ядро компилируется без DOM/Node types.
- Публичный API не позволяет произвольно переписать баланс/кота.
- Тесты не используют реальные ожидания `sleep`.
