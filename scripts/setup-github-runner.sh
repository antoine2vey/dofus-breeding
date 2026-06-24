#!/usr/bin/env bash
#
# Install a GitHub Actions self-hosted runner for antoine2vey/dofus-breeding
# as a systemd service on this VPS. Idempotent-ish: re-running re-registers.
#
# The runner picks up the `deploy` job in .github/workflows/deploy.yml and
# rebuilds + restarts the docker-compose stack in /var/www/dofus-breeding on
# every green push to main.
#
# Usage:
#   sudo ./scripts/setup-github-runner.sh
#
# It needs a one-time registration token. The script tries to mint one
# automatically with the GitHub CLI (`gh`); if gh isn't authenticated it falls
# back to asking you to paste a token from:
#   https://github.com/antoine2vey/dofus-breeding/settings/actions/runners/new
#
set -euo pipefail

REPO="antoine2vey/dofus-breeding"
RUNNER_DIR="/opt/actions-runner"
RUNNER_LABELS="dofus-deploy"
RUNNER_NAME="$(hostname)-dofus"
# Auto-detect the latest runner release, falling back to a known-good pin.
RUNNER_VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest 2>/dev/null \
  | grep -m1 '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')"
RUNNER_VERSION="${RUNNER_VERSION:-2.335.1}"

echo "==> GitHub Actions runner setup for ${REPO}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

# --- 1. Obtain a registration token ----------------------------------------
REG_TOKEN="${REG_TOKEN:-}"
if [ -z "${REG_TOKEN}" ]; then
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    echo "==> Minting a registration token via gh CLI..."
    REG_TOKEN="$(gh api -X POST "repos/${REPO}/actions/runners/registration-token" --jq .token)"
  else
    echo
    echo "No gh CLI auth found. Open this page and copy the token shown in the"
    echo "'./config.sh --token XXXX' command:"
    echo "  https://github.com/${REPO}/settings/actions/runners/new"
    echo
    read -rp "Paste registration token: " REG_TOKEN
  fi
fi
[ -n "${REG_TOKEN}" ] || { echo "No token; aborting." >&2; exit 1; }

# --- 2. Download the runner --------------------------------------------------
mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"
if [ ! -x "${RUNNER_DIR}/run.sh" ]; then
  echo "==> Downloading runner v${RUNNER_VERSION}..."
  curl -fsSL -o runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf runner.tar.gz
  rm -f runner.tar.gz
fi

# --- 3. Configure ------------------------------------------------------------
# Running as root requires this opt-in env var for both config and svc install.
export RUNNER_ALLOW_RUNASROOT=1

if [ -f "${RUNNER_DIR}/.runner" ]; then
  echo "==> Existing config found; removing before re-register..."
  ./svc.sh stop  2>/dev/null || true
  ./svc.sh uninstall 2>/dev/null || true
  ./config.sh remove --token "${REG_TOKEN}" 2>/dev/null || true
fi

echo "==> Registering runner '${RUNNER_NAME}' with labels '${RUNNER_LABELS}'..."
./config.sh \
  --url "https://github.com/${REPO}" \
  --token "${REG_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_LABELS}" \
  --work "_work" \
  --unattended \
  --replace

# --- 4. Install + start the systemd service ---------------------------------
echo "==> Installing systemd service..."
./svc.sh install
./svc.sh start

echo
echo "==> Done. Runner is live and listening for jobs."
echo "    Status:  cd ${RUNNER_DIR} && RUNNER_ALLOW_RUNASROOT=1 ./svc.sh status"
echo "    Logs:    journalctl -u 'actions.runner.*' -f"
echo "    Verify:  https://github.com/${REPO}/settings/actions/runners"
