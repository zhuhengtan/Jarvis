#!/usr/bin/env bash
# ==============================================================================
# Jarvis Cognitive Runtime - macOS LaunchAgent Runner
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Ensure standard user home
export HOME="${HOME:-/Users/$(whoami)}"

# Proactively construct PATH with Node & pnpm locations
# LaunchAgent runs with minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin)
NVM_NODE_PATH=""
if [ -d "$HOME/.nvm/versions/node/v24.1.0/bin" ]; then
  NVM_NODE_PATH="$HOME/.nvm/versions/node/v24.1.0/bin"
elif [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_DIR="$(ls -1d "$HOME/.nvm/versions/node"/v* 2>/dev/null | sort -V | tail -n 1)"
  if [ -n "$LATEST_DIR" ] && [ -d "$LATEST_DIR/bin" ]; then
    NVM_NODE_PATH="$LATEST_DIR/bin"
  fi
fi

export PATH="${NVM_NODE_PATH:+$NVM_NODE_PATH:}$HOME/Library/pnpm:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# If nvm is present, source it as fallback
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  \. "$NVM_DIR/nvm.sh" --no-use 2>/dev/null || true
fi

# Ensure node and pnpm are executable
if ! command -v node >/dev/null 2>&1; then
  echo "[Jarvis Daemon] [FATAL] 'node' executable not found in PATH: $PATH" >&2
  exit 127
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[Jarvis Daemon] [FATAL] 'pnpm' executable not found in PATH: $PATH" >&2
  exit 127
fi

echo "[Jarvis Daemon] ========================================================"
echo "[Jarvis Daemon] Starting Jarvis Cognitive Runtime daemon at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "[Jarvis Daemon] Node Binary : $(which node) ($(node -v))"
echo "[Jarvis Daemon] pnpm Binary : $(which pnpm) ($(pnpm -v))"
echo "[Jarvis Daemon] Project Dir : $PROJECT_ROOT"
echo "[Jarvis Daemon] Process PID : $$"
echo "[Jarvis Daemon] ========================================================"

CHILD_PID=""

cleanup() {
  echo "[Jarvis Daemon] Received shutdown signal at $(date -u '+%Y-%m-%dT%H:%M:%SZ'), terminating child processes..."
  if [ -n "$CHILD_PID" ] && kill -0 "$CHILD_PID" 2>/dev/null; then
    # Terminate process tree
    pkill -TERM -P "$CHILD_PID" 2>/dev/null || true
    kill -TERM "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
  echo "[Jarvis Daemon] All services terminated cleanly."
  exit 0
}

trap cleanup SIGTERM SIGINT SIGHUP

# Start production services: @jarvis/server + @jarvis/mcp + @jarvis/worker
pnpm start &
CHILD_PID=$!

wait "$CHILD_PID"
