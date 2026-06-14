# syntax=docker/dockerfile:1

# Node 20 (Debian/glibc) so better-sqlite3 uses prebuilt binaries and the
# Node-18 `File` polyfill is a harmless no-op.

# 1) Production dependencies only — includes the native better-sqlite3, no dev tooling.
FROM node:20-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# 2) Build — compile the server to JS and bundle the React frontend.
FROM node:20-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY web/package.json web/package-lock.json ./web/
RUN --mount=type=cache,target=/root/.npm npm --prefix web ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY web ./web
RUN npm run build:server && npm --prefix web run build

# 3) Runtime — slim, non-root: just node + prod deps + compiled output.
FROM node:20-bookworm-slim AS runtime
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

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY --from=build /app/web/dist     ./web/dist
COPY package.json ./

USER app
EXPOSE 3000
VOLUME ["/data"]

# relies on Node 20's global fetch (this image is Node 20 — do not "fix" with node-fetch)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/state').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# node is PID 1 (clean SIGTERM -> Effect graceful shutdown); compose adds tini via init:true
CMD ["node", "dist/main.js"]
