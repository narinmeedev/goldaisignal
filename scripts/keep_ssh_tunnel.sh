#!/bin/bash
# Auto-healing SSH Tunnel Daemon for Localhost Database Access
echo "[SSH Tunnel Manager] Starting SSH tunnel auto-healer on port 3307..."

while true; do
  : "${GOLDAI_SSH_PASSWORD:?Set GOLDAI_SSH_PASSWORD before starting the tunnel}"
  SSHPASS="$GOLDAI_SSH_PASSWORD" sshpass -e ssh -N -L 3307:127.0.0.1:3306 -p 65002 \
    -o ServerAliveInterval=10 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -o StrictHostKeyChecking=no \
    u286424856@76.13.199.204

  EXIT_CODE=$?
  echo "[SSH Tunnel Manager] SSH process exited with code ${EXIT_CODE}. Restarting in 2 seconds..."
  sleep 2
done
