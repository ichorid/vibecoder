# P06 — постоянный мир, арт и рекурсивное отдаление

Зависимости: P05. Читать архитектуру §7–8. Результат — готовый способ добавлять мир/иллюстрации без новых графических механизмов для каждой технологии. Сейчас production-арт нужен для имеющихся трёх технологий и кота; остальные добавляются в P07/P08.

## P06.1 — manifest и импорт атласов

**Файлы:** `content/assets.ts`, `world/sprites.ts`, adapter для atlas JSON, `public/assets/`, описание экспорта, validator/tests.

**RED:** отсутствующий frame/tag, duration≤0, rectangle за границами текстуры, отсутствующий файл или неверный format отклонены. Один и тот же cat animation tag работает в Pixi и DOM. Generated output имеет единственный источник/экспортный путь.

**GREEN:** принять один документированный PNG/JSON контракт. При Aseprite-export написать маленький adapter, не предполагать совместимость JSON с Pixi. Editable sources хранить отдельно от export; запуск игры не требует платного редактора.

**REFACTOR:** не создавать runtime loader для множества несовместимых форматов. Default-анимации кота: idle/sleep/walk/eat/play/pet/lonely/sick/attention; round body может быть отдельным вариантом frames.

**Контроль:** asset validator, реальные browser sprites, check/build. PNG-референсы не считаются production sheets.

## P06.2 — постоянная сцена и camera math

**Файлы:** `content/world.ts`, `world/camera.ts`, renderer, pure geometry tests.

**RED:** origin комнаты остаётся `(0,0)` после добавлений; node IDs не дублируются; connection endpoints существуют. Envelope каждого следующего unlock строго расширяется; fit в portrait canvas содержит envelope, zoom уменьшается при неизменном viewport. Resize не открывает технологию.

**GREEN:** stable root, cluster containers, отдельно edges. Root position/scale из camera target. Интерполяция 1–2 секунды одной easing-функцией; reduced motion — instant target. Никакого географического zoom.

**REFACTOR:** authored composition отдельно от camera math. Не переподчинять весь мир при каждом unlock и не смешивать dependency graph с render tree.

**Контроль:** camera/scene tests + browser первого и третьего milestones, check/build.

## P06.3 — LOD и судьба world cat

**Файлы:** renderer/sprites, LOD helper/tests, world projections.

**RED:** одна projected CSS-pixel size даёт одинаковый LOD при DPR1/2; thresholds с hysteresis не дрожат. Dead cat не рисуется на любом zoom. Живой кот уменьшается до orange pixel и визуально исчезает на final framing без изменения alive.

**GREEN:** три cluster representations; стартовые пороги detail≥96 px, compact≥16 px, иначе dots, с 10% hysteresis. Для кота отдельные переходы sprite→cluster→pixel; окончательный hide определяется final framing/проецируемым размером. Не удерживать world cat на постоянных 24 px.

**REFACTOR:** LOD — presentation detail, не новый gameplay state. Foreground cat не зависит от world camera.

**Контроль:** geometry/LOD tests, ручной просмотр smooth zoom в обоих themes, check/build. До появления final tech использовать явную тестовую scene fixture, не выдавать её за достижимый endgame.

## P06.4 — reveal и композиционный набор

**Файлы:** renderer/world definitions, три уникальных discovery illustrations, room/programmer/cat art, два memorial photos, UI animation wiring.

**RED:** новый subsystem появляется по pending discovery; completion/skip не применяет эффект повторно; interrupted reveal возобновляется после Cat/reload; theme не скрывает room/cat/связи. Reduced motion сохраняет информацию без перехода камеры.

**GREEN:** готовый kit серверов/терминалов/роботов/стрелок/проводов/рамок/ламп. Каждый текущий unlock имеет отличимую иллюстрацию и authored world addition. Заменить временные room/cat/memorial assets.

**REFACTOR:** kit переиспользуется; большие сцены не рисуются отдельным фоном для каждой стадии. GSAP пока не нужен; если выявлена конкретная сложная последовательность, зафиксировать причину его добавления отдельным решением.

**Контроль:** browser unlock/cat/memorial flows; ручное сравнение с ограничениями дизайна. Автоматический PNG snapshot не доказывает художественное качество.

## P06.5 — бюджет и работа на мобильном GPU

**Файлы:** загрузка/освобождение assets, renderer lifecycle, build-size script, соответствующие tests.

**RED:** scene update не создаёт все sprites заново на каждом tick; dispose снимает ресурсы; скрытый Game останавливает ticker; pack eviction не удаляет frames активного кота. Ошибка необязательной иллюстрации не блокирует игру и не удаляет discovery.

**GREEN:** owned ticker, nearest sampling, DPR cap2, reuse sprites, bounded effects, lazy packs. Кэшировать только небольшие статичные кластеры при измеренной пользе; не весь бесконечно растущий world. Добавить production bundle/asset-size отчёт.

**Измерение:** representative late-game fixture с большим числом мотивов — ранний performance spike. Цели из архитектуры: JS ≤350 KiB gzip, first assets≤1 MiB, textures/render targets≈≤64 MiB, frame work p95<16 ms на выбранном телефоне при 30 fps. Не проверять fps таймерами в headless CI как доказательство мобильной скорости.

**REFACTOR:** сначала уменьшать детали/texture residency/resolution. Workers, custom WebGL shaders и второй renderer без наблюдаемой необходимости не вводить.

**Контроль:** все tests, check/build, размер bundle, ручной mobile visual/performance report или честный device blocker.

## Выходной контроль P06

- Сцена собирается из сохранённых discoveries и authored metadata; room не заменяется.
- Настоящие atlas animations, три иллюстрации и мемориал закончены.
- LOD/zoom не меняют simulation facts.
- Отдельно перечислены измеренные и пока непроверенные device budgets.
