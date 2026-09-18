# Project identity

Jarvis derives a stable project identity from the Git remote when available, falling back to the canonical workspace path. A project may override the display name and stable ID explicitly:

```json
// .jarvis/project.json
{
  "id": "game-producer",
  "name": "Game Producer",
  "description": "项目用途、技术栈和主要模块",
  "keywords": ["Cocos", "自走棋"],
  "workspaces": ["/path/to/checkout", "/path/to/worktree"]
}
```

Use an ID only when it is stable across every checkout of the same project. Jarvis scopes project memory, goals, events, experiences, and context packages to this ID. `description` and `keywords` are used only as attribution hints for clients without a workspace; an ambiguous match is kept under `unassigned` until reviewed.
