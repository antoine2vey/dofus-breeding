import { SqliteClient } from '@effect/sql-sqlite-node'
import { Config } from 'effect'

/** SQLite client layer. Set DATABASE_FILE (defaults to ./data.db). */
export const SqlLive = SqliteClient.layerConfig({
  filename: Config.string('DATABASE_FILE').pipe(Config.withDefault('data.db'))
})
