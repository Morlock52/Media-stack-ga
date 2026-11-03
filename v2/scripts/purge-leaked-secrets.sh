#!/usr/bin/env bash
# =============================================================================
#  Remove leaked secrets/app state from the GitHub history of Media-stack-ga.
#
#  RUN ONLY AFTER you have revoked/rotated: OpenAI key, Authelia secrets,
#  Redis password, Prowlarr/Sonarr/Radarr API keys. History rewriting does not
#  un-leak anything — rotation does. This just stops the bleed.
#
#  What it does:
#   1. Mirror-clones your LOCAL repo (keeps your 2 unpushed commits)
#   2. Strips the paths below from every commit
#   3. Shows you what's left, asks before force-pushing to GitHub
#
#  Before running: commit (or stash) your uncommitted work in ~/Media-stack-ga.
#  Usage:  bash v2/scripts/purge-leaked-secrets.sh ~/Media-stack-ga
# =============================================================================
set -euo pipefail
SRC="${1:?path to your local Media-stack-ga repo}"
REMOTE="https://github.com/Morlock52/Media-stack-ga.git"

command -v git-filter-repo >/dev/null || {
  echo "Installing git-filter-repo…"
  brew install git-filter-repo 2>/dev/null || python3 -m pip install --user git-filter-repo
}

if [[ -n "$(git -C "$SRC" status --porcelain --untracked-files=no)" ]]; then
  echo "❌ $SRC has uncommitted changes to tracked files. Commit or stash first."; exit 1
fi

WORK="$(mktemp -d)"
git clone --mirror "$SRC" "$WORK/repo.git"
cd "$WORK/repo.git"

git filter-repo --force --invert-paths \
  --path backups/ \
  --path .swarm/memory.db \
  --path config/authelia/users_database.yml \
  --path-glob 'config/*/config.xml' \
  --path-glob '*.db' \
  --path-glob '**/*.db' \
  --path-glob '.env' \
  --path-glob '**/.env'

echo; echo "Remaining matches for sensitive patterns (should be empty or placeholders):"
git log --all -p | grep -nE 'sk-(proj-)?[A-Za-z0-9_-]{20,}|<ApiKey>[0-9a-f]{32}' | head -20 || true

echo; read -rp "Force-push rewritten history to $REMOTE ? [type YES] " ok
[[ "$ok" == "YES" ]] || { echo "Aborted. Rewritten copy left at $WORK/repo.git"; exit 0; }

git remote add origin "$REMOTE" 2>/dev/null || git remote set-url origin "$REMOTE"
git push --force --mirror origin

cat <<EOF

✅ GitHub history rewritten. Now resync your working copy:
   cd "$SRC"
   git fetch origin
   git reset --hard origin/main       # your committed work is preserved in the rewrite
   rm -rf .worktrees && git worktree prune

Also:
 • GitHub may still serve old commits by SHA from caches/forks — ask GitHub
   Support to purge cached views (Settings → "Remove sensitive data" guide).
 • Add a guard so it can't happen again:  brew install gitleaks && gitleaks git .
EOF
