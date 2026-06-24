import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqlClient } from '@effect/sql'
import { SqliteClient } from '@effect/sql-sqlite-node'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { Repo } from '../src/Repo.js'

// Migration safety against the REAL prod snapshot (refreshed by scripts/sync-db.sh). The snapshot's
// exact shape drifts over time — it may be pre-multi-user (`dragodinde` table, `achievement(color)`
// single-PK, no user_settings) OR already multi-user (`dragodinde` + user_id, `achievement(user_id,
// color)`, user_settings). Booting the Repo must, from EITHER starting point, in ONE boot:
//   - rename dragodinde → mount (+ species backfill),
//   - chain the achievement PK to (user_id, species, color),
//   - add user_settings.species_config,
// preserving every row, and be idempotent on a second boot. So we read the PRE-migration counts from
// the fixture and assert they're preserved, rather than hard-coding fixture-specific numbers.
const SNAPSHOT = join(process.cwd(), 'data.remote-snapshot.db')

const bootAgainst = <A, E>(file: string, eff: Effect.Effect<A, E, Repo | SqlClient.SqlClient>) =>
  Effect.runPromise(
    eff.pipe(
      Effect.provide(Repo.Default.pipe(Layer.provideMerge(SqliteClient.layer({ filename: file }))))
    )
  )

/** Raw counts read straight from the fixture file BEFORE the Repo migrates it. */
const preMigrationCounts = (file: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      // The mounts table is `dragodinde` pre-migration; tolerate an already-migrated `mount` too.
      const tables = (yield* sql<{
        name: string
      }>`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name)
      const mounts = tables.includes('mount')
        ? yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM mount`
        : yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM dragodinde`
      const achs = yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM achievement`
      const enclos = yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM enclos`
      return { mounts: mounts[0].n, achs: achs[0].n, enclos: enclos[0].n }
    }).pipe(Effect.provide(SqliteClient.layer({ filename: file })))
  )

describe('species migration on the real prod snapshot', () => {
  it.skipIf(!existsSync(SNAPSHOT))(
    'renames dragodinde→mount, chains achievement PK, adds species_config — preserving rows, idempotently',
    async () => {
      const tmp = join(tmpdir(), `mig-test-${process.pid}-${Math.floor(Math.random() * 1e9)}.db`)
      copyFileSync(SNAPSHOT, tmp)
      try {
        // Counts in the untouched fixture — what the migration must preserve exactly.
        const before = await preMigrationCounts(tmp)
        expect(before.mounts).toBeGreaterThan(0) // sanity: the fixture has real data

        // ── First boot: runs the whole migration chain. ──
        const after = await bootAgainst(
          tmp,
          Effect.gen(function* () {
            yield* Repo // constructing the service runs the migration
            const sql = yield* SqlClient.SqlClient
            const tables = (yield* sql<{
              name: string
            }>`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name)
            const mountCols = (yield* sql<{
              name: string
            }>`SELECT name FROM pragma_table_info('mount')`).map((r) => r.name)
            const achPk = yield* sql<{
              name: string
              pk: number
            }>`SELECT name, pk FROM pragma_table_info('achievement')`
            const usCols = (yield* sql<{
              name: string
            }>`SELECT name FROM pragma_table_info('user_settings')`).map((r) => r.name)
            const enclosCols = (yield* sql<{
              name: string
            }>`SELECT name FROM pragma_table_info('enclos')`).map((r) => r.name)
            const idx = (yield* sql<{
              name: string
            }>`SELECT name FROM sqlite_master WHERE type='index'`).map((r) => r.name)
            const mounts = yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM mount`
            const mountsDrago = yield* sql<{
              n: number
            }>`SELECT COUNT(*) AS n FROM mount WHERE species = 'dragodinde'`
            const achs = yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM achievement`
            const achsDrago = yield* sql<{
              n: number
            }>`SELECT COUNT(*) AS n FROM achievement WHERE species = 'dragodinde'`
            const enclos = yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM enclos`
            return {
              tables,
              mountCols,
              achPk,
              usCols,
              enclosCols,
              idx,
              mounts: mounts[0].n,
              mountsDrago: mountsDrago[0].n,
              achs: achs[0].n,
              achsDrago: achsDrago[0].n,
              enclos: enclos[0].n
            }
          })
        )

        // Table renamed, old one gone.
        expect(after.tables).toContain('mount')
        expect(after.tables).not.toContain('dragodinde')
        // species + user_id present on mount; EVERY pre-existing row preserved + backfilled to dragodinde.
        expect(after.mountCols).toContain('species')
        expect(after.mountCols).toContain('user_id')
        expect(after.mounts).toBe(before.mounts)
        expect(after.mountsDrago).toBe(before.mounts) // all legacy rows backfilled to 'dragodinde'
        expect(after.enclos).toBe(before.enclos)
        // achievement rebuilt to the 3-col composite PK; all rows preserved, backfilled species.
        const achNames = after.achPk.map((c) => c.name)
        expect(achNames).toEqual(expect.arrayContaining(['user_id', 'species', 'color']))
        expect(
          after.achPk
            .filter((c) => c.pk > 0)
            .map((c) => c.name)
            .sort()
        ).toEqual(['color', 'species', 'user_id'])
        expect(after.achs).toBe(before.achs)
        expect(after.achsDrago).toBe(before.achs)
        // user_settings has species_config; enclos has the multi-user/elapsed cols.
        expect(after.usCols).toContain('species_config')
        expect(after.enclosCols).toEqual(expect.arrayContaining(['user_id', 'ticked_at']))
        // index renamed.
        expect(after.idx).toContain('idx_mount_user')
        expect(after.idx).not.toContain('idx_dragodinde_user')

        // ── Second boot on the already-migrated file: must not error and must be stable. ──
        const second = await bootAgainst(
          tmp,
          Effect.gen(function* () {
            yield* Repo
            const sql = yield* SqlClient.SqlClient
            const mounts = yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM mount`
            const achs = yield* sql<{ n: number }>`SELECT COUNT(*) AS n FROM achievement`
            const tables = (yield* sql<{
              name: string
            }>`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name)
            return { mounts: mounts[0].n, achs: achs[0].n, tables }
          })
        )
        expect(second.mounts).toBe(before.mounts) // idempotent — no duplication / loss
        expect(second.achs).toBe(before.achs)
        expect(second.tables).toContain('mount')
        expect(second.tables).not.toContain('dragodinde')
      } finally {
        for (const suffix of ['', '-shm', '-wal']) {
          const f = tmp + suffix
          if (existsSync(f)) rmSync(f)
        }
      }
    }
  )
})
