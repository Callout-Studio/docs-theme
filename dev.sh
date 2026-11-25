#!/usr/bin/env bash
# Local preview of a Callout Studio docs site, with no commits and no pushes.
#
#   ./dev.sh             the user guide    → http://localhost:8080/docs
#   ./dev.sh internal    the internal docs → http://localhost:8081/internal-docs
#
# Both can run at the same time; PORT and WS_PORT choose other ports. The site
# repositories are expected beside this one (../docs or ../docs-site,
# ../internal-docs or ../internal-docs-site), each with the plugin's
# repository, or a link to it, in its source/ folder; Quartz is installed into
# its quartz/ folder on the first run. Both folders are ignored by Git.
#
# It mirrors the deploy workflow (.github/workflows/build-site.yml): the theme
# and the site's own files are put into Quartz (assemble.mjs), the pages are
# prepared from source/ (uncommitted edits included), and Quartz serves the
# result and rebuilds when a page changes. After changing quartz.config.yaml,
# site.json, quartz.ts or anything in theme/, stop it (Ctrl+C) and run it again.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

if [[ "${1:-}" == "internal" ]]; then
  names=(internal-docs internal-docs-site) base=internal-docs port=${PORT:-8081} ws=${WS_PORT:-3002}
else
  names=(docs docs-site) base=docs port=${PORT:-8080} ws=${WS_PORT:-3001}
fi
site=""
for name in "${names[@]}"; do
  if [[ -f "$here/../$name/site.json" ]]; then site="$(cd "$here/../$name" && pwd)" && break; fi
done
if [[ -z "$site" ]]; then
  echo "No site repository found beside this one (looked for ${names[*]})." >&2
  exit 1
fi
if [[ ! -e "$site/source" ]]; then
  echo "$site/source is missing: clone Callout-Studio/obsidian there, or link your clone." >&2
  exit 1
fi

quartz="$site/quartz"
if [[ ! -d "$quartz" ]]; then
  git clone --quiet --depth 1 --branch "$(tr -d '[:space:]' < "$here/quartz-version.txt")" \
    https://github.com/jackyzha0/quartz.git "$quartz"
  (cd "$quartz" && npm ci)
fi

node "$here/assemble.mjs" "$site" "$quartz"
# Plugins are installed once; after adding one to quartz.config.yaml, run
# `npm run install-plugins` in the quartz/ folder.
if [[ ! -f "$quartz/.quartz/plugins/index.ts" ]]; then (cd "$quartz" && npm run install-plugins); fi
node "$here/prepare-content.mjs" "$site/site.json" "$site/source" "$quartz/content"
node "$here/prepare-graph.mjs" "$quartz"

# Quartz leaves the page's base path empty when it serves, but this preview is
# served under /docs (or /internal-docs), and the graph needs the base path to
# find the page it is on. The deployed site has it from its address already.
perl -pi -e 's/componentData\.ctx\.argv\.serve \|\| !cfg\.baseUrl/!cfg.baseUrl/' "$quartz/quartz/components/renderPage.tsx"
# The same for the 404 page: when it serves, Quartz asks for the page's styles and
# scripts at "/", but here they are under /docs (or /internal-docs), so an unknown
# address would show unstyled. The deployed site is served under its base path (a
# GitHub Pages project site), which is what this makes the preview do.
perl -0pi -e 's/\(ctx\.argv\.serve\s*\? "\/"/(false ? "\/"/' "$quartz/quartz/plugins/pageTypes/dispatcher.ts"

cd "$quartz"
exec npx quartz build --serve --baseDir "$base" --port "$port" --wsPort "$ws"
