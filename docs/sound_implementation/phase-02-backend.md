# S02 — Tone.js backend и жизненный цикл

Зависимости: S01 и основной browser tooling либо его минимальная общая установка. Читать sound architecture §4–6. Результат — реальное воспроизведение, а не только mock scheduler.

## S02.1 — ранний compatibility spike установленной Tone

**Файлы:** `backend/toneBackend.ts`, browser audio fixture/spec, package scripts.

**RED:** после доверенного gesture valid короткий plan действительно создаёт ненулевой offline signal; до gesture context не создаётся автоматически. Fake backend не считается GREEN этого теста.

**GREEN:** проверить API текущей locked версии: context/start/resume, Transport ticks/PPQ, callback audioTime, cancel/clear, Offline render и disposal. Зафиксировать результаты/ограничения. Не переносить неподтверждённые API из старого Tone tutorial.

**REFACTOR:** один маленький adapter/port, не аудиофреймворк поверх Tone. Ввести `test:music-browser`; отдельная тестовая HTML fixture не попадает в public game build.

**Контроль:** настоящий Tone render + build + core regression. Если runner не поддерживает AudioContext, выбрать browser среду, а не подменить этот слой mock-ом.

## S02.2 — четыре instrument families и mix

**Файлы:** `backend/instruments.ts`, preset JSON, render tests.

**RED по одному:** pulse lead, triangle bass, arp и noise drums дают звук в разрешённых ranges; wrong family/options rejected; mono/poly limit соблюдён; velocity0 silent; master mute silent; representative combined output не клиппует.

**GREEN:** Tone synth factories, music/SFX buses, master gain/limiter, короткие ramps. Default global8 voices, role-specific envelope/voice caps. Presets данные, допустимые настройки ограничены schema.

**REFACTOR:** reuse instruments между patterns; не отдельный synth на каждую из60 нот без освобождения. Release tails учитываются в cap и eventual disposal.

**Контроль:** offline waveform invariants + живое короткое прослушивание тембров, check/build. Числа waveform не заменяют оценку «убедительное chiptune».

## S02.3 — schedule и границы

**RED:** real callbacks используют переданный audioTime, не render time; tracks начинаются синхронно; две соседние фразы не имеют дополнительного callback-induced gap. Boundary notes off/on не остаются висеть. UI current-pattern notification совпадает со слышимой границей, не lookahead.

**GREEN:** Transport scheduling в absolute ticks, собственные IDs, current+next horizon. Для offline проверки использовать специальный sustained-support fixture, чтобы намеренная пауза композиции не выглядела багом.

**REFACTOR:** не добавлять window intervals для notes. Только backend обращается к Tone.

**Контроль:** real two-phrase render, scheduler tests, check/build.

## S02.4 — pause/resume/stop/dispose

**RED:** pause сохраняет позицию и гасит голоса; queued lookahead note не звучит позже; resume играет только оставшиеся/ещё активные интервалы, без повтора завершённых; stop сбрасывает clock/bag intent; dispose idempotent. Повторные start/stop не оставляют растущие nodes/events.

**GREEN:** adapter contract отменяет schedule и future audio automation, а не только JS callback IDs. При необходимости release/disconnect/recreate bounded voice bank. Resume реконструирует active notes с remaining duration. Gain ramp + release без stuck notes.

**REFACTOR:** убрать listeners/handles по owning instance; не вызывать глобальный reset другого engine. Отдельные play modes позже используют этот lifecycle.

**Контроль:** fake lookahead cases и настоящий render после pause/stop. Если отмена не работает в установленной версии, задача не закрывается по mock-тесту.

## S02.5 — controls, gesture и preferences

**Файлы:** public audio API, preference adapter, audio-control component tests.

**RED:** locked/start rejection даёт needsGesture/error без unhandled promise и без game pause; задержанный lazy import не предполагает сохранённую user activation, повторный ready-button gesture способен вызвать unlock. Volume/mute сохраняются; browser unlock не сохраняется; mute останавливает scheduling, latest requested state не теряется. Corrupt audio prefs не портят game save.

**GREEN:** lazy Tone import по gesture/открытию music settings, default volume0,35, separate `vibecoder.audio.v1`. Public state различает loading/desired playback/mute/context. Если import пережил activation — явное повторное включение, без autoplay retry loop. Пока UI может жить в тестовой fixture; подключение Settings/Music submenu в S07.

**REFACTOR:** никаких самостоятельных LocalStorage записей из game core/Lab controls. Одни controls/adapter используются обоими entry.

**Контроль:** preference/unit/browser unlock tests, весь music набор, check/build.

## Выходной контроль S02

Реальная Tone синтезация и расписание подтверждены; start/pause/resume/stop различаются. Нет stale audio после cancel. Совместимость библиотеки проверена на раннем срезе, ресурсы ограничены, autoplay failure не ломает приложение.
