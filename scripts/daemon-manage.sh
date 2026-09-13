#!/usr/bin/env bash
# ==============================================================================
# Jarvis Cognitive Runtime - macOS LaunchAgent Management CLI
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SERVICE_NAME="com.jarvis.runtime"
DOMAIN="gui/$(id -u)"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/${SERVICE_NAME}.plist"
RUNNER_PATH="$PROJECT_ROOT/scripts/daemon-runner.sh"
LOG_DIR="$HOME/Library/Logs/Jarvis"
STDOUT_LOG="$LOG_DIR/output.log"
STDERR_LOG="$LOG_DIR/error.log"
HTTP_PORT=7330
MCP_PORT=7331

# Color formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ensure_executable_permissions() {
  chmod +x "$RUNNER_PATH" "$SCRIPT_DIR/daemon-manage.sh"
}

check_port_conflicts() {
  local occupied=false
  local pids
  pids=$(lsof -ti :$HTTP_PORT -ti :$MCP_PORT 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "${YELLOW}[Warning] Ports $HTTP_PORT or $MCP_PORT are currently in use by PID(s):${NC}"
    lsof -i :$HTTP_PORT -i :$MCP_PORT 2>/dev/null || true
    occupied=true
  fi
  if [ "$occupied" = true ] && [ "${1:-}" != "--force" ]; then
    echo -e "${YELLOW}If you have an ongoing 'pnpm dev' session running in a terminal, please terminate it (Ctrl+C) first.${NC}"
    echo -e "${YELLOW}Or re-run with: bash scripts/daemon-manage.sh install --force to continue.${NC}"
  fi
}

generate_plist() {
  mkdir -p "$PLIST_DIR"
  mkdir -p "$LOG_DIR"

  # Detect node/pnpm paths for environment dictionary
  local node_bin_dir=""
  if [ -d "$HOME/.nvm/versions/node/v24.1.0/bin" ]; then
    node_bin_dir="$HOME/.nvm/versions/node/v24.1.0/bin"
  elif [ -d "$HOME/.nvm/versions/node" ]; then
    local latest
    latest="$(ls -1d "$HOME/.nvm/versions/node"/v* 2>/dev/null | sort -V | tail -n 1)"
    if [ -n "$latest" ] && [ -d "$latest/bin" ]; then
      node_bin_dir="$latest/bin"
    fi
  fi

  local env_path="${node_bin_dir:+$node_bin_dir:}$HOME/Library/pnpm:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

  cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>
    <key>Comment</key>
    <string>Jarvis Cognitive Runtime Daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${RUNNER_PATH}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>${STDOUT_LOG}</string>
    <key>StandardErrorPath</key>
    <string>${STDERR_LOG}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>${env_path}</string>
    </dict>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF

  plutil -lint "$PLIST_PATH" >/dev/null
}

cmd_install() {
  ensure_executable_permissions
  echo -e "${BOLD}${BLUE}=== Installing Jarvis macOS LaunchAgent Daemon ===${NC}"

  check_port_conflicts "${1:-}"

  echo -e "\n${BLUE}[1/4] Building Admin UI web assets (@jarvis/admin)...${NC}"
  pnpm --filter @jarvis/admin build

  echo -e "\n${BLUE}[2/4] Generating LaunchAgent plist at ${PLIST_PATH}...${NC}"
  generate_plist

  echo -e "\n${BLUE}[3/4] Registering LaunchAgent service with launchd...${NC}"
  # Unload old registration if present
  launchctl bootout "$DOMAIN/${SERVICE_NAME}" 2>/dev/null || launchctl unload "$PLIST_PATH" 2>/dev/null || true

  # Bootstrap modern or load legacy
  if launchctl bootstrap "$DOMAIN" "$PLIST_PATH" 2>/dev/null; then
    echo -e "${GREEN}Bootstrapped into domain $DOMAIN successfully.${NC}"
  else
    launchctl load -w "$PLIST_PATH"
    echo -e "${GREEN}Loaded via launchctl load successfully.${NC}"
  fi

  echo -e "\n${BLUE}[4/4] Verifying daemon health...${NC}"
  sleep 2
  cmd_status
  echo -e "\n${GREEN}${BOLD}Jarvis Daemon installed and registered successfully!${NC}"
  echo -e "Access Jarvis Cognitive Console at: ${BOLD}http://127.0.0.1:${HTTP_PORT}${NC}"
  echo -e "View real-time logs with:           ${BOLD}pnpm daemon:logs${NC}"
}

cmd_uninstall() {
  echo -e "${BOLD}${YELLOW}=== Uninstalling Jarvis macOS LaunchAgent Daemon ===${NC}"
  if [ -f "$PLIST_PATH" ]; then
    echo "Unloading LaunchAgent..."
    launchctl bootout "$DOMAIN/${SERVICE_NAME}" 2>/dev/null || launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo -e "${GREEN}Removed ${PLIST_PATH}${NC}"
  else
    echo "No plist found at ${PLIST_PATH}."
  fi
  echo -e "${GREEN}Jarvis Daemon uninstalled.${NC}"
}

cmd_start() {
  ensure_executable_permissions
  if [ ! -f "$PLIST_PATH" ]; then
    echo -e "${RED}Error: Daemon is not installed yet.${NC}"
    echo "Please run: pnpm daemon:install"
    exit 1
  fi
  echo "Starting Jarvis Daemon..."
  if launchctl kickstart -k "$DOMAIN/${SERVICE_NAME}" 2>/dev/null; then
    echo -e "${GREEN}Kicked off $DOMAIN/${SERVICE_NAME}.${NC}"
  else
    launchctl bootout "$DOMAIN/${SERVICE_NAME}" 2>/dev/null || launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST_PATH" 2>/dev/null || launchctl load -w "$PLIST_PATH"
  fi
  sleep 2
  cmd_status
}

cmd_stop() {
  echo "Stopping Jarvis Daemon..."
  launchctl bootout "$DOMAIN/${SERVICE_NAME}" 2>/dev/null || launchctl unload "$PLIST_PATH" 2>/dev/null || true
  sleep 1
  cmd_status
}

cmd_restart() {
  echo "Restarting Jarvis Daemon..."
  cmd_stop
  sleep 1
  cmd_start
}

cmd_status() {
  echo -e "${BOLD}--- Jarvis Daemon Status ---${NC}"
  
  # Launchctl check
  local agent_loaded=false
  local launchctl_info
  launchctl_info=$(launchctl list 2>/dev/null | grep "${SERVICE_NAME}" || true)
  if [ -n "$launchctl_info" ]; then
    agent_loaded=true
    local pid
    pid=$(echo "$launchctl_info" | awk '{print $1}')
    local status
    status=$(echo "$launchctl_info" | awk '{print $2}')
    echo -e "LaunchAgent Registered : ${GREEN}YES${NC} (PID: ${pid:--}, ExitStatus: ${status})"
  else
    echo -e "LaunchAgent Registered : ${YELLOW}NO (or inactive)${NC}"
  fi

  # Port checks
  local pids_7330
  pids_7330=$(lsof -ti :$HTTP_PORT 2>/dev/null || true)
  if [ -n "$pids_7330" ]; then
    echo -e "HTTP API & Admin (:${HTTP_PORT}): ${GREEN}LISTENING${NC} (PID: $(echo "$pids_7330" | tr '\n' ' '))"
  else
    echo -e "HTTP API & Admin (:${HTTP_PORT}): ${RED}NOT LISTENING${NC}"
  fi

  local pids_7331
  pids_7331=$(lsof -ti :$MCP_PORT 2>/dev/null || true)
  if [ -n "$pids_7331" ]; then
    echo -e "MCP HTTP Server (:${MCP_PORT}) : ${GREEN}LISTENING${NC} (PID: $(echo "$pids_7331" | tr '\n' ' '))"
  else
    echo -e "MCP HTTP Server (:${MCP_PORT}) : ${RED}NOT LISTENING${NC}"
  fi

  # Health endpoint check
  local health_resp
  health_resp=$(curl -s --connect-timeout 2 "http://127.0.0.1:${HTTP_PORT}/health" 2>/dev/null || true)
  if [ -n "$health_resp" ]; then
    echo -e "Daemon Health Check    : ${GREEN}OK${NC} -> $health_resp"
  else
    echo -e "Daemon Health Check    : ${RED}FAILED / UNREACHABLE${NC}"
  fi

  # Dev mode port checks
  local dev_pids_7430
  dev_pids_7430=$(lsof -ti :7430 2>/dev/null || true)
  if [ -n "$dev_pids_7430" ]; then
    echo -e "Dev Server (:7430)     : ${BLUE}RUNNING${NC} (PID: $(echo "$dev_pids_7430" | tr '\n' ' '))"
  fi
  local dev_pids_5173
  dev_pids_5173=$(lsof -ti :5173 2>/dev/null || true)
  if [ -n "$dev_pids_5173" ]; then
    echo -e "Dev Admin UI (:5173)   : ${BLUE}RUNNING${NC} (PID: $(echo "$dev_pids_5173" | tr '\n' ' '))"
  fi

  echo -e "Log Directory          : $LOG_DIR"
  if [ -f "$STDOUT_LOG" ]; then
    local out_size
    out_size=$(wc -c < "$STDOUT_LOG" | tr -d ' ')
    echo -e "Stdout Log             : $STDOUT_LOG ($out_size bytes)"
  fi
  if [ -f "$STDERR_LOG" ]; then
    local err_size
    err_size=$(wc -c < "$STDERR_LOG" | tr -d ' ')
    echo -e "Stderr Log             : $STDERR_LOG ($err_size bytes)"
  fi
}

cmd_logs() {
  mkdir -p "$LOG_DIR"
  touch "$STDOUT_LOG" "$STDERR_LOG"
  echo -e "${BOLD}${BLUE}=== Streaming Jarvis Daemon Logs (Ctrl+C to exit) ===${NC}"
  tail -f -n 50 "$STDOUT_LOG" "$STDERR_LOG"
}

# Subcommand dispatch
case "${1:-status}" in
  install)
    cmd_install "${2:-}"
    ;;
  uninstall)
    cmd_uninstall
    ;;
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  restart)
    cmd_restart
    ;;
  status)
    cmd_status
    ;;
  logs)
    cmd_logs
    ;;
  *)
    echo "Usage: $0 {install|uninstall|start|stop|restart|status|logs}"
    exit 1
    ;;
esac
