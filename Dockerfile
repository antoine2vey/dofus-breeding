# syntax=docker/dockerfile:1

# Node 24 (Debian/glibc) so better-sqlite3 uses prebuilt binaries. Node 24 has
# File/Blob and the Web Crypto `crypto` global natively (Better Auth needs it),
# so no polyfill is required. Keep this >= the package.json engines floor (>=20).
#
# This is an npm *workspaces* monorepo: the root package (server), `packages/core`
# (@dd/core shared engine) and `web` (React frontend) share one root lockfile.
# Installs MUST go through the root `npm ci` so `@dd/core` is symlinked into the
# workspaces — a standalone `npm --prefix web ci` cannot resolve `@dd/core@*`.

# 1) Production dependencies only — includes the native better-sqlite3, no dev tooling.
#    Workspace manifests are needed up-front so npm links @dd/core during install.
FROM node:24-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY web/package.json ./web/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# 2) Build — compile @dd/core, the server, and bundle the React frontend.
FROM node:24-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY web/package.json ./web/
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY packages ./packages
COPY src ./src
COPY web ./web
# build:server already runs core:build first; web build needs @dd/core's dist.
RUN npm run build:server \
 && npm -w dragodinde-web run build

# 3) Runtime — slim, non-root: just node + prod deps + compiled output.
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_FILE=/data/data.db

# non-root user + a writable dir for the SQLite file. A named volume mounted at
# /data inherits this ownership on first creation (the compose default). WAL mode
# also needs the DIRECTORY writable for the -wal/-shm side-files. If you instead use
# a host BIND mount, pre-create it owned by 10001:10001
# (mkdir -p data && sudo chown 10001:10001 data) or the app cannot open the DB.
RUN useradd --system --uid 10001 app \
 && mkdir -p /data && chown app:app /data

# node_modules carries the @dd/core symlink -> ../packages/core, so the runtime
# must also ship packages/core's built dist + manifest for it to resolve.
COPY --from=deps  /app/node_modules        ./node_modules
COPY --from=build /app/dist                ./dist
COPY --from=build /app/web/dist            ./web/dist
COPY --from=build /app/packages/core/dist  ./packages/core/dist
COPY packages/core/package.json ./packages/core/
COPY package.json ./

USER app
EXPOSE 3000
VOLUME ["/data"]

# relies on Node 24's global fetch (this image is Node 24 — do not "fix" with node-fetch)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/state').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# node is PID 1 (clean SIGTERM -> Effect graceful shutdown); compose adds tini via init:true
CMD ["node", "dist/main.js"]
