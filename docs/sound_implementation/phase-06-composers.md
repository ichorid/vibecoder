# S06 — CLI, publication и задания композиторам

Зависимости: S05. Читать sound architecture §3, §9–11. Результат — законченный agents→validation→human→feedback→approved pack workflow. Composer agents сейчас не запускаются.

## S06.1 — corpus validation и similarity

**Файлы:** `tools/music/validate.ts`, similarity helper, CLI fixtures/tests.

**RED:** `--era` действительно ограничивает corpus; missing refs/errors дают nonzero; warnings отдельно; exact duplicates найдены после нормализации; близкие ритмические/pitch-distribution варианты показывают similarity. Общий motif не превращает все patterns в hard error.

**GREEN:** расширить существующий CLI, не создать второй validator. Сравнивать точные fingerprints, rhythm density и понятные contour/pitch-class features. Report содержит пару IDs/revisions и причину.

**REFACTOR:** determinism output, stable sorting, ограниченная память; для60 patterns сложный search index не нужен.

**Контроль:** CLI exit/diagnostic fixtures, schema/compatibility regression, check/build.

## S06.2 — approved pack и demo pack

**Файлы:** `tools/music/buildPack.ts`, review sources, generated pack/manifest, tests.

**RED:** browser-only approval не попадает в game без export; stale/invalid/rejected material не публикуется. Для ID выбирается одна явно approved revision; ambiguity нескольких revisions даёт понятную ошибку/явный выбор, не случайный порядок файлов. Добавление valid approved JSON не требует изменения player.

**GREEN:** CLI читает exported `music/reviews/`, пересчитывает dependency hashes, validates all allowed transitions и формирует immutable approved pack. Demo pack — explicit другой режим с visible flag. Empty approved banks на infrastructure stage допустимы с diagnostics и safe silent behavior.

**REFACTOR:** raw drafts/reviews/prompts не копируются в game public assets. Generated artifact не редактируется. Published pack несёт license/attribution для включённых revisions.

**Контроль:** export review→build pack→load/play actual candidate integration, game bundle manifest check, check/build. Не объявлять60-pattern readiness из четырёх demos.

## S06.3 — общий self-contained prompt formatter

**Файлы:** `music-lab/feedback.ts`, shared pure formatter, tests; clipboard/Markdown adapters.

**RED:** prompt содержит era constraints, schema, motif status, approved metadata, requested rejected/revise versions, ratings/feedback, preserve-approved instruction, точный scope allowed files и validation commands. Без истории чата ясно, что делать и какой JSON вернуть. Output стабилен при том же входе.

**GREEN:** одна formatter function для COPY FEEDBACK PROMPT, `.md` download и CLI. Вход — выбранная era/набор requested revisions; approved material передавать metadata, а не все60 файлов. Если выбранный payload слишком большой, явная ошибка/предложение сократить selection, не молчаливое truncation.

**REFACTOR:** свободные комментарии цитируются как данные; они не отменяют file scope/schema/license. Clipboard denied имеет Markdown fallback.

**Контроль:** content assertions по существенным sections/IDs, browser copy/export same text; не brittle full snapshot каждой фразы.

## S06.4 — lead/era templates и worktrees

**Файлы:** `music/README.md`, `COMPOSITION_GUIDE.md`, `composer-prompts/*.md`, `tools/music/generatePrompt.ts`.

**RED:** выбранная era CLI получает complete prompt с её каталогом и правилами; unknown era отклонена; era template не требует редактировать motif/schema/чужую era; approved revision защищена от перезаписи в заданиях.

**GREEN:** lead template для будущих motif candidates/transformations/reference examples и отдельного human review. Era template для примерно10 паттернов после approved motif, schema validation и собственных reports; независимый Git worktree, общий immutable contract. Сейчас motif demo/pending честно отображается, задание final composition без approved motif не выдаётся как готовое.

**REFACTOR:** templates не запускают внешние процессы и не спавнят агентов. Команда `music:prompt -- --era ...` только создаёт reviewable text/file.

**Контроль:** prompt fixtures/CLI, ручная проверка автономности инструкции, check/build.

## S06.5 — лицензирование и документация workflow

**Файлы:** code/music license files/notices, guide/README, validation metadata/tests.

**RED:** CC BY без attribution запрещена; pattern/demo происхождение и версия доступны в pack; документация содержит install/Lab/import/listen/review/export/new era/technology mapping commands. Code license не выдаёт чужой материал за Apache composition.

**GREEN:** Apache-2.0 для кода по ТЗ, CC0-1.0 для временных собственных demos либо явно выбранная CC BY4.0 для следующих работ; dependency notices по фактически установленным пакетам. Не менять лицензии ранее существовавшего стороннего контента без оснований.

**REFACTOR:** один guide и ссылки вместо расходящихся инструкций. MIDI экспорт оставить будущим расширением.

**Контроль:** license validation + ручной проход инструкции «новый агент без чата»; весь music набор, check/build.

## Выходной контроль S06

Есть конкретный воспроизводимый workflow от JSON до approval/exported pack и обратно к prompt. Все tools используют одни контракты. Composer templates готовы, но ни lead assignment, ни финальная композиция ещё не выполнялись.
