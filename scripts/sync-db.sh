#!/usr/bin/env bash
#
# sync-db.sh — pull the production SQLite DB from the server and replace the
# local one with it.
#
#   Remote : root@91.98.21.56  (app "dragodinde-notif", deployed via docker compose)
#   The live DB is NOT a plain file under /var/www/dofus-breeding — it lives in
#   the docker named volume "dofus-breeding_dragodinde-data" at
#   /var/lib/docker/volumes/.../_data/data.db, in WAL mode.
#
# How it works:
#   1. On the server we take a *consistent* snapshot with `sqlite3 .backup`.
#      This is safe to run while the app keeps writing (it checkpoints the WAL
#      into a single self-contained file) — no downtime, no torn copy.
#   2. We scp that snapshot down, run `PRAGMA integrity_check` on it locally.
#   3. We back up the current local data.db, then atomically swap it in and
#      drop the stale -wal/-shm sidecars.
#
# Usage:
#   ./scripts/sync-db.sh           # pull prod -> local (refuses if app is running)
#   ./scripts/sync-db.sh --force   # swap even if local data.db looks open (risky)
#   ./scripts/sync-db.sh --dry-run # take + verify the snapshot, don't touch local
#   ./scripts/sync-db.sh --push    # push LOCAL -> prod (overwrites production!)
#
# --push: snapshots the local DB (consistent, online), uploads it, then on the server
#   backs up the live DB, STOPS the container (so the swap can't corrupt an open file),
#   overwrites the volume DB in place (preserving its owner so the app can still write),
#   drops the WAL sidecars, and STARTS the container again.
#
set -euo pipefail

# ── config ──────────────────────────────────────────────────────────────────
REMOTE="${REMOTE:-root@91.98.21.56}"
REMOTE_VOLUME="${REMOTE_VOLUME:-dofus-breeding_dragodinde-data}"
REMOTE_DB="/var/lib/docker/volumes/${REMOTE_VOLUME}/_data/data.db"
REMOTE_SNAP="/tmp/dofus-breeding-sync-$$.db"

# project root = parent of this script's dir, so it works from anywhere
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DB="${LOCAL_DB:-$ROOT/data.db}"
SSH_OPTS="-o ConnectTimeout=10"

FORCE=0; DRY_RUN=0; PUSH=0
for arg in "$@"; do
  case "$arg" in
    --force)   FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --push)    PUSH=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

cleanup_remote() { ssh $SSH_OPTS "$REMOTE" "rm -f '$REMOTE_SNAP'" 2>/dev/null || true; }
trap cleanup_remote EXIT

# ── PUSH: local -> production (overwrite) ───────────────────────────────────
if [ "$PUSH" = "1" ]; then
  command -v sqlite3 >/dev/null 2>&1 || die "local sqlite3 required for --push"
  [ -f "$LOCAL_DB" ] || die "local DB not found: $LOCAL_DB"
  PUSH_SNAP="$(mktemp -t dofus-breeding-push.XXXXXX.db)"
  trap 'rm -f "$PUSH_SNAP"; cleanup_remote' EXIT

  say "Snapshotting LOCAL DB (consistent, online)…"
  sqlite3 "$LOCAL_DB" ".backup '$PUSH_SNAP'"
  check="$(sqlite3 "$PUSH_SNAP" 'PRAGMA integrity_check;' | head -1)"
  [ "$check" = "ok" ] || die "local snapshot failed integrity_check: $check"
  rows="$(sqlite3 "$PUSH_SNAP" "SELECT count(*) FROM dragodinde;")"
  say "Local snapshot OK — ${rows} dragodindes, $(du -h "$PUSH_SNAP" | cut -f1). Uploading…"
  scp $SSH_OPTS -q "$PUSH_SNAP" "$REMOTE:$REMOTE_SNAP" || die "scp upload failed"

  say "Backing up prod DB, stopping container, swapping in local, restarting…"
  ssh $SSH_OPTS "$REMOTE" "
    set -e
    sqlite3 '$REMOTE_SNAP' 'PRAGMA integrity_check;' >/dev/null
    [ -f '$REMOTE_DB' ] && cp '$REMOTE_DB' \"$REMOTE_DB.bak.\$(date +%Y%m%d-%H%M%S)\"
    docker stop dragodinde-notif >/dev/null
    cat '$REMOTE_SNAP' > '$REMOTE_DB'   # in-place: keeps the file's original owner/mode
    rm -f '$REMOTE_DB-wal' '$REMOTE_DB-shm' '$REMOTE_SNAP'
    docker start dragodinde-notif >/dev/null
  " || die "remote swap failed"

  trap 'rm -f "$PUSH_SNAP"' EXIT
  say "Done — production now matches your local DB."
  exit 0
fi

# ── 1. consistent snapshot on the server ────────────────────────────────────
say "Snapshotting remote DB on $REMOTE (online .backup, no downtime)…"
ssh $SSH_OPTS "$REMOTE" "
  set -e
  [ -f '$REMOTE_DB' ] || { echo 'remote DB not found: $REMOTE_DB' >&2; exit 1; }
  sqlite3 '$REMOTE_DB' \".backup '$REMOTE_SNAP'\"
  sqlite3 '$REMOTE_SNAP' 'PRAGMA integrity_check;' | head -1
" || die "remote snapshot failed"

# ── 2. pull it down ─────────────────────────────────────────────────────────
TMP_LOCAL="$(mktemp -t dofus-breeding-sync.XXXXXX.db)"
trap 'rm -f "$TMP_LOCAL"; cleanup_remote' EXIT
say "Downloading snapshot…"
scp $SSH_OPTS -q "$REMOTE:$REMOTE_SNAP" "$TMP_LOCAL" || die "scp failed"

# ── 3. verify locally ───────────────────────────────────────────────────────
if command -v sqlite3 >/dev/null 2>&1; then
  check="$(sqlite3 "$TMP_LOCAL" 'PRAGMA integrity_check;' | head -1)"
  [ "$check" = "ok" ] || die "integrity check failed on downloaded snapshot: $check"
  rows="$(sqlite3 "$TMP_LOCAL" "SELECT count(*) FROM sqlite_master WHERE type='table';")"
  say "Snapshot OK — integrity_check=ok, $rows tables, $(du -h "$TMP_LOCAL" | cut -f1) on disk."
else
  say "local sqlite3 not found — skipping verification."
fi

if [ "$DRY_RUN" = "1" ]; then
  mv "$TMP_LOCAL" "$ROOT/data.remote-snapshot.db"
  trap cleanup_remote EXIT
  say "--dry-run: left snapshot at $ROOT/data.remote-snapshot.db (local data.db untouched)."
  exit 0
fi

# ── 4. guard: don't clobber a live local DB ─────────────────────────────────
if command -v lsof >/dev/null 2>&1 && lsof -- "$LOCAL_DB" >/dev/null 2>&1; then
  if [ "$FORCE" = "0" ]; then
    die "local data.db is open (the app is running). Stop it first, then re-run. (override with --force)"
  fi
  say "WARNING: local data.db is open but --force given — swapping anyway."
fi

# ── 5. back up local, swap in, drop stale WAL sidecars ──────────────────────
if [ -f "$LOCAL_DB" ]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  cp "$LOCAL_DB" "$LOCAL_DB.bak.$stamp"
  say "Backed up current local DB -> $(basename "$LOCAL_DB").bak.$stamp"
fi

mv "$TMP_LOCAL" "$LOCAL_DB"
rm -f "$LOCAL_DB-wal" "$LOCAL_DB-shm"
trap cleanup_remote EXIT   # TMP_LOCAL is gone; only remote cleanup left

say "Done — local $LOCAL_DB now matches production."
