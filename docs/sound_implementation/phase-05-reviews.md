# S05 — human review, версии и JSON обмен

Зависимости: S04. Читать sound architecture §9. Результат — отзывы переживают reload, не переносятся случайно на изменённую музыку и доступны для публикации.

## S05.1 — payload hash и revision identity

**Файлы:** canonical payload helper, browser/Node hash adapters, dependency resolver, tests.

**RED:** одинаковые данные с разным порядком object keys дают один hash; изменение note/используемого preset/motif делает approval stale; добавление другого unrelated pattern не меняет hash. ID+revision без совпавшего hash недостаточно.

**GREEN:** детерминированная canonical JSON serialization с сохранением порядка arrays, SHA-256 одинаковых bytes в browser/CLI. Hash API вне pure core, browser использует Web Crypto в HTTPS/localhost. Не имитировать crypto short integer hash ради теста; mobile review server использует доступный secure origin.

**REFACTOR:** не включать в dependency closure весь каталог/reviews. Выбранные музыкальные зависимости и правила canonical payload документированы.

**Контроль:** browser/Node hash parity, mutation/staleness cases, check/build.

## S05.2 — rating/status/feedback и persistence

**Файлы:** `music-lab/reviewStore.ts`, review UI, schema/store tests.

**RED:** rating1–5; unreviewed может не иметь rating; APPROVE/REVISE/REJECT сохраняются для точной версии; feedback draft переживает reload; corrupt review storage не портит game/audio prefs. Approval невозможно для hard-invalid payload; warnings видны и допускают решение человека.

**GREEN:** отдельный versioned LocalStorage key, immutable records и typed status, current hash. APPROVE — пользовательское действие, не автоматический side effect валидатора.

**REFACTOR:** независимый error/retry state, без автоматического удаления всей review collection. Не изменять pattern JSON во время rating.

**Контроль:** store/component/reload browser tests, check/build.

## S05.3 — JSON import/export и конфликт

**RED:** export→import сохраняет records; повторный import idempotent; invalid status/hash/range/oversized file отклонён; разные решения для того же exact key требуют явного conflict resolution. Новая версия не затирает прежнюю или её feedback.

**GREEN:** schema-validated review envelope, размерные лимиты до parsing/expensive work, preview conflicts, keep-local/use-import decisions. Не выбирать молча «новее» по произвольному timestamp.

**REFACTOR:** общий decoder для clipboard/file/CLI review. Feedback рендерится как текст, не raw HTML.

**Контроль:** import/export fixtures + browser roundtrip/conflict, check/build.

## S05.4 — filters, A/B и approved sequence

**RED:** status filter не меняет reviews; revisions A/B доступны независимо; новая revision по умолчанию unreviewed/stale, старое approval не наследуется. Random approved sequence использует только exact approved nonstale candidates; revise/rejected/unreviewed туда не попадают.

**GREEN:** сравнение версий тем же Single/Transition player. На save/update review пересобрать candidates у следующего безопасного boundary, а не разорвать текущую фразу. Если approved bank стал пуст, применить empty policy.

**REFACTOR:** список держит stable keys ID/revision/hash. Сравнение ничего не публикует автоматически.

**Контроль:** browser review→approved sequence→new version→stale flow; весь music набор, check/build.

## S05.5 — локальные candidate patterns в production Lab

**Файлы:** Lab candidate-catalog adapter/storage, import/export UI, schema/browser tests.

**RED:** production Lab импортирует новый валидный pattern JSON, показывает его unreviewed, проигрывает через общий engine и сохраняет после reload. Invalid/oversized candidate не заменяет установленный каталог. Импорт с тем же ID/revision и другим payload даёт явный конфликт, approved source не перезаписывается. Export возвращает editable JSON.

**GREEN:** отдельное ограниченное local хранилище candidates, общий validator и quota error handling. Published game pack и game save не меняются от импорта/review. При необходимости version A/B работает через те же exact keys.

**REFACTOR:** общий file decoder без второго music parser. В production не требуется backend или запись в репозиторий; source/reviews возвращаются автору download-ом.

**Контроль:** production-preview import→play→review→reload→export, schema/persistence regressions, check/build.

## Выходной контроль S05

Human decisions/version identity и локальные candidates сохраняются и экспортируются. Imports не стирают conflicts молча. Одобрение привязано к реально услышанному каноническому материалу; audition overrides явно отличаются. Game save и published pack не затронуты.
