# 在 DeepSeek Harness 中使用 Jarvis 记忆

先启动 Jarvis Runtime：`pnpm --filter @jarvis/server dev`。

从 DSH 工作树用 profile patch 启动：

```sh
pnpm dsh web --patch /absolute/path/to/Jarvis/packages/dsh-memory/cordis.patch.yml
