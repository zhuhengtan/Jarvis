# Project identity

Jarvis derives a stable project identity from the Git remote when available, falling back to the canonical workspace path. A project may override the display name and stable ID explicitly:

```json
// .jarvis/project.json
{
  "id": "game-producer",
  "name": "Game Producer"
}
```

Use an ID only when it is stable across every checkout of the same project. Jarvis scopes project memory, goals, events, experiences, and context packages to this ID.
