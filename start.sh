#!/bin/bash
# Démarre Selvema Commercial (npm run dev) en arrière-plan.
# Usage :   ./start.sh          lance le serveur
#           ./start.sh stop     arrête le serveur
#           ./start.sh status   affiche l'état

set -e
cd "$(dirname "$0")"

PID_FILE=".dev.pid"
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/dev.log"
PORT=3002

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null
}

case "${1:-start}" in
  stop)
    if is_running; then
      kill "$(cat "$PID_FILE")" && rm -f "$PID_FILE"
      echo "Selvema Commercial arrêté."
    else
      echo "Rien à arrêter."
      rm -f "$PID_FILE"
    fi
    ;;

  status)
    if is_running; then
      echo "En cours d'exécution (PID $(cat "$PID_FILE")) — http://localhost:$PORT"
    else
      echo "Arrêté."
    fi
    ;;

  start)
    if is_running; then
      echo "Déjà lancé (PID $(cat "$PID_FILE")) — http://localhost:$PORT"
      exit 0
    fi
    mkdir -p "$LOG_DIR"
    if [ ! -d node_modules ]; then
      echo "Installation des dépendances…"
      npm install
    fi
    nohup npm run dev >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
    echo "Selvema Commercial démarré (PID $(cat "$PID_FILE"))."
    echo "  URL   : http://localhost:$PORT"
    echo "  Logs  : $(pwd)/$LOG_FILE"
    ;;

  *)
    echo "Usage : $0 {start|stop|status}"
    exit 1
    ;;
esac
