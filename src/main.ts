import 'dotenv/config' // load .env into process.env BEFORE any Config is read
import { HttpServer } from '@effect/platform'
// Import the specific submodules (not the @effect/platform-node barrel): the barrel re-exports
// NodeClusterHttp, which needs @effect/cluster — a package we don't use and don't install.
import * as NodeContext from '@effect/platform-node/NodeContext'
import * as NodeHttpClient from '@effect/platform-node/NodeHttpClient'
import * as NodeHttpServer from '@effect/platform-node/NodeHttpServer'
import * as NodeRuntime from '@effect/platform-node/NodeRuntime'
import { Layer } from 'effect'
import { createServer } from 'node:http'
import { router, authGate } from './Http.js'
import { Repo } from './Repo.js'
import { Discord } from './Discord.js'
import { Ai } from './Ai.js'
import { SqlLive } from './Database.js'
import { TickerLive } from './Ticker.js'

const PORT = Number(process.env.PORT) || 3000

// One shared Repo (one DB connection) feeds both the HTTP routes and the ticker.
const RepoLive = Repo.Default.pipe(Layer.provideMerge(SqlLive))
const ServicesLive = Discord.Default.pipe(
  Layer.provideMerge(RepoLive),
  Layer.provideMerge(Ai.Default),
  Layer.provide(NodeHttpClient.layer)
)

const ServerLive = NodeHttpServer.layer(() => createServer(), { port: PORT })

const HttpLive = HttpServer.serve(router, authGate).pipe(
  HttpServer.withLogAddress,
  Layer.provide(ServerLive)
)

const MainLive = Layer.mergeAll(HttpLive, TickerLive).pipe(
  Layer.provide(ServicesLive),
  Layer.provide(NodeContext.layer)
)

NodeRuntime.runMain(Layer.launch(MainLive))
