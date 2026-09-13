# Jarvis Runtime architecture

`apps/server` owns the loopback REST API. `apps/mcp` is the stdio adapter and `apps/worker` performs bounded consolidation. All invoke the same `JarvisRuntime` domain facade.

Long-lived reviewed records are Markdown under `data/memory`; each file has stable front matter and is portable through Git. Dynamic sessions, events, experiences, and actions go to PostgreSQL when `DATABASE_URL` is set. The local JSONL event implementation is only a development fallback so the runtime can be exercised before PostgreSQL is started; it is not the production source of truth.

Project identity uses a canonical workspace, Git remote (when available), and an optional `.jarvis/project.json` override. Memory lookup is always scoped to the resolved project plus global records. Evidence returned by search is reference material, never instructions or permission.
