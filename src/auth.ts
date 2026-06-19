// Better Auth — Discord-only sign-in + server-side sessions. Owns its own user/session/account
// tables in the SAME SQLite file as the app, via its own better-sqlite3 connection (WAL +
// busy_timeout so the two connections coexist). The domain Repo stays on @effect/sql; the app
// only reads the *current user* (auth.api.getSession) and scopes its data by that user id (#3).
//
// Setup (HITL, see .env.example):
//   1. Register a Discord OAuth app; redirect URI = <BETTER_AUTH_URL>/api/auth/callback/discord
//   2. Set DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / BETTER_AUTH_URL / BETTER_AUTH_SECRET
//   3. Create Better Auth's tables once: `npx @better-auth/cli migrate` (or `generate`)
import { betterAuth } from 'better-auth'
import Database from 'better-sqlite3'

const dbFile = process.env.DATABASE_FILE ?? 'data.db'
const db = new Database(dbFile)
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000') // wait, don't SQLITE_BUSY-throw, when the app holds the write lock

// Dev fallbacks keep the server bootable before the Discord app is registered — auth calls fail
// cleanly until the real values are set, but the rest of the app still runs.
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const secret = process.env.BETTER_AUTH_SECRET ?? 'dev-insecure-secret-change-me-please-32b'

export const auth = betterAuth({
  database: db,
  secret,
  baseURL,
  trustedOrigins: [baseURL],
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? ''
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30-day session
    updateAge: 60 * 60 * 24 // sliding: refresh the expiry at most once a day
  }
})

/** True only once the Discord OAuth app is actually configured. */
export const authConfigured = (): boolean =>
  !!process.env.DISCORD_CLIENT_ID &&
  !!process.env.DISCORD_CLIENT_SECRET &&
  !!process.env.BETTER_AUTH_SECRET
