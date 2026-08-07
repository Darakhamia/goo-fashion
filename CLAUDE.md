# Claude Code Instructions

## Работа по плану аудита — читать первым

В репозитории действует план разработки, составленный по итогам аудита сайта от 7 августа 2026.

- `AUDIT_PLAN_BRIEF.md` — протокол работы: как выбирать задачу, правила, доска статусов, когда обращаться к CEO. **Прочитать целиком до первой правки кода.**
- `AUDIT_DEV_PLAN.md` — сами задачи: 12 блоков (Б0–Б11), 4 волны, у каждой задачи DoD.

Правила, действующие всегда:
- Задачи берутся по порядку волн, с доски статусов в конце `AUDIT_PLAN_BRIEF.md`. Волна не начинается, пока предыдущая не закрыта.
- Перед правкой перепроверять по коду, что проблема ещё существует — план это снимок на 7 августа 2026.
- Задача закрывается только после фактической проверки по DoD, с записью доказательства на доску.
- Развилки из раздела «Решения, которые ты не принимаешь» — за CEO, не за агентом.
- Конец волны и исчерпание плана — обязательная остановка с отчётом CEO. Новый план агент не пишет.

## Branch Policy
- Always work directly on the `master` branch
- Never create new feature branches
- Commit and push all changes to `master`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
