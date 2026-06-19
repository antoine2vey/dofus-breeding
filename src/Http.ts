import {
  FileSystem,
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse
} from '@effect/platform'
import * as NodeHttpServerRequest from '@effect/platform-node/NodeHttpServerRequest'
import { Config, Effect, Option, Stream } from 'effect'
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
import { auth } from './auth.js'
import { requireUserId, withUser } from './tenant.js'
import { fileURLToPath } from 'node:url'
import {
  Repo,
  type CloneInput,
  type CrossInput,
  type DragoPatch,
  type EnclosPatch,
  type ImportRow,
  type SeedInput
} from './Repo.js'
import { Discord } from './Discord.js'
import { Ai, type AiActions, type ChatMessage } from './Ai.js'
import {
  recommend,
  assistantPlan,
  buildName,
  resolveColor,
  type AssistMount,
  type AssistEnclos
} from '@dd/core'
import {
  type Dragodinde,
  BARS,
  FOCUSABLE,
  MAX_DRAGODINDES,
  MAX_ENCLOS,
  MAX_FOCUS,
  MAX_STABLE,
  SERENITY_GOAL,
  SERENITY_MAX,
  SERENITY_MIN,
  STAT_MAX
} from './domain.js'

/** The one projection from a stored Dragodinde to the planner's AssistMount. AssistMount is a
 *  superset of the recommender's InvMount, so this single adapter feeds /api/recommend,
 *  /api/assistant/plan, and the AI getState alike. */
const toAssistMount = (d: Dragodinde): AssistMount => ({
  id: d.id,
  name: d.name,
  color: d.color,
  sex: d.sex,
  status: d.status,
  keeper: d.keeper,
  enclosId: d.enclosId,
  grandparents: [...d.grandparents]
})

// Built React app (see web/). Run `cd web && npm run build`.
const WEB_DIR = fileURLToPath(new URL('../web/dist', import.meta.url))

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
}
const contentTypeFor = (p: string): string =>
  CONTENT_TYPES[p.slice(p.lastIndexOf('.'))] ?? 'application/octet-stream'

const NO_BUILD = `<!doctype html><meta charset="utf-8">
<body style="font-family:system-ui;background:#14151a;color:#e7e9ee;padding:40px">
<h1>🐉 Frontend not built</h1>
<p>Run <code>cd web &amp;&amp; npm install &amp;&amp; npm run build</code>,
or in dev <code>cd web &amp;&amp; npm run dev</code> (proxies to this server).</p>`

const serveStatic = (rel: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const bytes = yield* fs.readFile(`${WEB_DIR}/${rel}`)
    return HttpServerResponse.uint8Array(bytes, { contentType: contentTypeFor(rel) })
  }).pipe(
    Effect.catchAll(() =>
      Effect.succeed(
        rel === 'index.html'
          ? HttpServerResponse.text(NO_BUILD, { contentType: 'text/html; charset=utf-8' })
          : HttpServerResponse.text('Not found', { status: 404 })
      )
    )
  )

const readBody = HttpServerRequest.HttpServerRequest.pipe(
  Effect.flatMap((req) => req.json),
  Effect.catchAll(() => Effect.succeed<unknown>({}))
)

const idParam = HttpRouter.params.pipe(Effect.map((p) => Number(p['id'])))

// ── Better Auth (Discord OAuth + sessions) ───────────────────────────────────
const baNodeHandler = toNodeHandler(auth)

/** Bridge Better Auth's Node handler into the Effect router by handing it the raw Node req/res.
 *  Better Auth writes + ends the response itself (incl. its Set-Cookies); Effect's server detects
 *  the already-ended socket (writableEnded) and won't double-write, so the returned value is moot. */
const betterAuthApp = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const nodeReq = NodeHttpServerRequest.toIncomingMessage(req)
  const nodeRes = NodeHttpServerRequest.toServerResponse(req)
  yield* Effect.promise(async () => {
    await baNodeHandler(nodeReq, nodeRes)
  })
  return HttpServerResponse.empty()
})

/** The signed-in user for this request (via the Better Auth session cookie), or None. */
const sessionUser = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const nodeReq = NodeHttpServerRequest.toIncomingMessage(req)
  const session = yield* Effect.tryPromise(() =>
    auth.api.getSession({ headers: fromNodeHeaders(nodeReq.headers) })
  ).pipe(Effect.orElseSucceed(() => null))
  return Option.fromNullable(session?.user ?? null)
})

/** Gate every /api/* route (except the /api/auth/* handshake) behind a valid session. */
export const authGate = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const path = req.url.split('?')[0]
    if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) {
      const user = yield* sessionUser
      if (Option.isNone(user)) {
        return HttpServerResponse.unsafeJson({ error: 'unauthenticated' }, { status: 401 })
      }
      const repo = yield* Repo
      yield* repo.claimOrphansIfSeedOwner(user.value.id) // one-time: pre-multi-user data → the seed owner
      return yield* withUser(user.value.id, app) // every Repo query in `app` is now scoped to this user
    }
    return yield* app
  })
)

// Split across two pipes: HttpRouter.pipe is typed for at most 20 combinators.
const router1 = HttpRouter.empty.pipe(
  HttpRouter.get('/', serveStatic('index.html')),
  HttpRouter.get(
    '/assets/:name',
    Effect.gen(function* () {
      const p = yield* HttpRouter.params
      return yield* serveStatic(`assets/${p['name'] ?? ''}`)
    })
  ),

  HttpRouter.get(
    '/api/state',
    Effect.gen(function* () {
      const repo = yield* Repo
      const discord = yield* Discord
      const enclos = yield* repo.all
      const stable = yield* repo.stable
      const achievements = yield* repo.getAchievements
      const webhookConfigured = yield* discord.isConfigured
      const aiConfigured = yield* repo.hasAiKey
      const tickMs = yield* Config.integer('TICK_MS').pipe(Config.withDefault(10000))
      return HttpServerResponse.unsafeJson({
        enclos,
        stable,
        achievements,
        settings: { webhookConfigured, aiConfigured },
        meta: {
          fuelBars: BARS,
          focusable: FOCUSABLE,
          maxFocus: MAX_FOCUS,
          statMax: STAT_MAX,
          serenityMin: SERENITY_MIN,
          serenityMax: SERENITY_MAX,
          serenityGoal: SERENITY_GOAL,
          tickMs,
          maxEnclos: MAX_ENCLOS,
          maxDragodindes: MAX_DRAGODINDES
        }
      })
    })
  ),

  HttpRouter.post(
    '/api/enclos',
    Effect.gen(function* () {
      const repo = yield* Repo
      const created = yield* repo.createEnclos
      return Option.match(created, {
        onNone: () =>
          HttpServerResponse.unsafeJson({ error: `Max ${MAX_ENCLOS} enclos` }, { status: 400 }),
        onSome: (e) => HttpServerResponse.unsafeJson(e)
      })
    })
  ),

  HttpRouter.del(
    '/api/enclos/:id',
    Effect.gen(function* () {
      const repo = yield* Repo
      const id = yield* idParam
      const ok = yield* repo.removeEnclos(id)
      return ok
        ? HttpServerResponse.unsafeJson({ ok: true })
        : HttpServerResponse.unsafeJson({ error: 'Need at least 1 enclos' }, { status: 400 })
    })
  ),

  HttpRouter.patch(
    '/api/enclos/:id',
    Effect.gen(function* () {
      const repo = yield* Repo
      const id = yield* idParam
      const body = (yield* readBody) as EnclosPatch
      const ok = yield* repo.patchEnclos(id, body)
      return ok
        ? HttpServerResponse.unsafeJson({ ok: true })
        : HttpServerResponse.unsafeJson({ error: 'Not found' }, { status: 404 })
    })
  ),

  HttpRouter.post(
    '/api/dragodinde',
    Effect.gen(function* () {
      const repo = yield* Repo
      const seed = (yield* readBody) as SeedInput
      const created = yield* repo.addDrago(seed)
      return Option.match(created, {
        onNone: () =>
          HttpServerResponse.unsafeJson(
            { error: `Stable pleine (max ${MAX_STABLE})` },
            { status: 400 }
          ),
        onSome: (d) => HttpServerResponse.unsafeJson(d)
      })
    })
  ),

  HttpRouter.post(
    '/api/dragodinde/:id/move',
    Effect.gen(function* () {
      const repo = yield* Repo
      const id = yield* idParam
      const body = (yield* readBody) as { enclosId?: number | null }
      const enclosId = typeof body.enclosId === 'number' ? body.enclosId : null
      const moved = yield* repo.moveDrago(id, enclosId)
      return Option.match(moved, {
        onNone: () =>
          HttpServerResponse.unsafeJson(
            { error: `Introuvable ou enclos plein (max ${MAX_DRAGODINDES})` },
            { status: 400 }
          ),
        onSome: (d) => HttpServerResponse.unsafeJson(d)
      })
    })
  ),

  HttpRouter.post(
    '/api/recommend',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as {
        targetGen?: number
        level?: number
        optimakina?: boolean
        clonage?: boolean
        freeSlots?: number
      }
      const enclos = yield* repo.all
      const all = yield* repo.allMounts // stable + enclos — the whole collection
      const emptySlots = enclos.reduce(
        (s, e) => s + Math.max(0, MAX_DRAGODINDES - e.dragodindes.length),
        0
      )
      const mounts = all.map(toAssistMount)
      const result = recommend({
        mounts,
        targetGen: typeof body.targetGen === 'number' ? body.targetGen : 10,
        freeSlots: typeof body.freeSlots === 'number' ? body.freeSlots : Math.max(1, emptySlots),
        level: typeof body.level === 'number' ? body.level : 60,
        optimakina: body.optimakina === true,
        clonage: body.clonage !== false,
        achievements: yield* repo.getAchievements
      })
      return HttpServerResponse.unsafeJson(result)
    })
  ),

  HttpRouter.post(
    '/api/assistant/plan',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as {
        targetGen?: number
        level?: number
        optimakina?: boolean
        clonage?: boolean
      }
      const enclos = yield* repo.all
      const all = yield* repo.allMounts
      const mounts = all.map(toAssistMount)
      const assistEnclos: AssistEnclos[] = enclos.map((e) => ({
        id: e.id,
        name: e.name,
        focus: [...e.focus],
        count: e.dragodindes.length
      }))
      const result = assistantPlan({
        mounts,
        enclos: assistEnclos,
        targetGen: typeof body.targetGen === 'number' ? body.targetGen : 10,
        level: typeof body.level === 'number' ? body.level : 60,
        optimakina: body.optimakina === true,
        clonage: body.clonage !== false,
        achievements: yield* repo.getAchievements
      })
      return HttpServerResponse.unsafeJson(result)
    })
  ),

  HttpRouter.post(
    '/api/ai/chat',
    Effect.gen(function* () {
      const ai = yield* Ai
      const repo = yield* Repo
      const apiKey = yield* repo.getAiKey // BYOK — the current user's own OpenAI key
      if (!apiKey) {
        return HttpServerResponse.unsafeJson(
          { error: "Ajoute ta clé OpenAI dans les réglages (⚙︎) pour activer l'assistant IA." },
          { status: 400 }
        )
      }
      const body = (yield* readBody) as {
        messages?: ChatMessage[]
        targetGen?: number
        level?: number
        optimakina?: boolean
        clonage?: boolean
      }
      // Bridge the AI's plain-async tools to the (Effect) repo. The tools run on detached fibers
      // (Effect.runPromise) that don't inherit this request's user scope, so each re-pins the
      // current user via withUser — otherwise the Repo's requireUserId would die.
      const uid = yield* requireUserId
      const runScoped = <A, E>(eff: Effect.Effect<A, E>): Promise<A> =>
        Effect.runPromise(withUser(uid, eff))
      const actions: AiActions = {
        getState: async () => {
          const enclos = await runScoped(repo.all)
          const all = await runScoped(repo.allMounts)
          return {
            mounts: all.map(toAssistMount),
            enclos: enclos.map((e) => ({
              id: e.id,
              name: e.name,
              focus: [...e.focus],
              count: e.dragodindes.length
            }))
          }
        },
        moveMounts: async (mids, enclosId) => {
          const r = await runScoped(repo.moveMany(mids, enclosId))
          return { moved: r.movedIds.length, skipped: r.skipped }
        },
        setStatus: async (mids, st) => ({
          updated: await runScoped(repo.patchMany(mids, { status: st }))
        }),
        setKeeper: async (mids, keeper) => ({
          updated: await runScoped(repo.patchMany(mids, { keeper }))
        }),
        recordCross: async (p) =>
          Option.match(await runScoped(repo.recordCross(p)), {
            onNone: () => ({ ok: false, error: 'parents introuvables ou étable pleine' }),
            onSome: (d) => ({ ok: true, babyId: d.id })
          }),
        recordClone: async (p) =>
          Option.match(await runScoped(repo.recordClone(p)), {
            onNone: () => ({
              ok: false,
              error: 'clonage impossible (deux stériles de même génération requis)'
            }),
            onSome: (d) => ({ ok: true, cloneId: d.id })
          }),
        addMounts: async (p) => {
          // Normalise the colour to its canonical name ("amande" → "Amande") and name each mount by
          // the in-game convention (e.g. "a-f"), not the raw colour string.
          const color = resolveColor(p.color) ?? p.color
          const name = buildName({ color, sex: p.sex, keeper: false })
          const rows = Array.from({ length: p.count }, () => ({
            name,
            color,
            sex: p.sex,
            status: p.status
          }))
          const r = await runScoped(repo.importMounts(rows, null))
          return { created: r.created.length }
        },
        addEnclos: async () =>
          Option.match(await runScoped(repo.createEnclos), {
            onNone: () => ({ ok: false }),
            onSome: (e) => ({ ok: true, id: e.id })
          }),
        removeEnclos: async (id) => ({ ok: await runScoped(repo.removeEnclos(id)) }),
        deleteMounts: async (mids) => ({ removed: await runScoped(repo.removeMany(mids)) })
      }
      const it = ai.reply(
        body.messages ?? [],
        {
          targetGen: typeof body.targetGen === 'number' ? body.targetGen : 10,
          level: typeof body.level === 'number' ? body.level : 60,
          optimakina: body.optimakina === true,
          clonage: body.clonage !== false,
          achievements: yield* repo.getAchievements
        },
        actions,
        apiKey
      )
      const enc = new TextEncoder()
      const sse = Stream.fromAsyncIterable(it, (e) => new Error(String(e))).pipe(
        Stream.map((t) => enc.encode(`data: ${JSON.stringify({ text: t })}\n\n`)),
        Stream.catchAll((e) =>
          Stream.succeed(enc.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`))
        ),
        Stream.concat(Stream.succeed(enc.encode('data: [DONE]\n\n')))
      )
      return HttpServerResponse.stream(sse, { contentType: 'text/event-stream' })
    })
  )
)

const router2 = router1.pipe(
  HttpRouter.post(
    '/api/breed',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as Partial<CrossInput>
      if (
        typeof body.parentAId !== 'number' ||
        typeof body.parentBId !== 'number' ||
        typeof body.color !== 'string' ||
        (body.sex !== 'M' && body.sex !== 'F')
      ) {
        return HttpServerResponse.unsafeJson(
          { error: 'breed requires parentAId, parentBId, color, sex' },
          { status: 400 }
        )
      }
      const baby = yield* repo.recordCross(body as CrossInput)
      return Option.match(baby, {
        onNone: () =>
          HttpServerResponse.unsafeJson(
            { error: 'Parents introuvables ou stable pleine' },
            { status: 400 }
          ),
        onSome: (d) => HttpServerResponse.unsafeJson(d)
      })
    })
  ),

  HttpRouter.post(
    '/api/dragodinde/bulk-move',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as { ids?: unknown; enclosId?: number | null }
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((x): x is number => typeof x === 'number')
        : []
      const enclosId = typeof body.enclosId === 'number' ? body.enclosId : null
      const { movedIds, skipped } = yield* repo.moveMany(ids, enclosId)
      return HttpServerResponse.unsafeJson({ moved: movedIds.length, movedIds, skipped })
    })
  ),

  HttpRouter.post(
    '/api/dragodinde/bulk-patch',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as { ids?: unknown; patch?: DragoPatch }
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((x): x is number => typeof x === 'number')
        : []
      const src = body.patch ?? {}
      const patch: DragoPatch = {
        ...(src.status === 'sterile' || src.status === 'fertile' || src.status === 'feconde'
          ? { status: src.status }
          : {}),
        ...(typeof src.keeper === 'boolean' ? { keeper: src.keeper } : {})
      }
      const patched = yield* repo.patchMany(ids, patch)
      return HttpServerResponse.unsafeJson({ patched })
    })
  ),

  HttpRouter.post(
    '/api/dragodinde/bulk-delete',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as { ids?: unknown }
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((x): x is number => typeof x === 'number')
        : []
      const removed = yield* repo.removeMany(ids)
      return HttpServerResponse.unsafeJson({ removed })
    })
  ),

  HttpRouter.post(
    '/api/import',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as { mounts?: ImportRow[]; enclosId?: number | null }
      if (!Array.isArray(body.mounts)) {
        return HttpServerResponse.unsafeJson({ error: 'import requires mounts[]' }, { status: 400 })
      }
      const valid = body.mounts.filter(
        (m): m is ImportRow =>
          !!m && typeof m.color === 'string' && (m.sex === 'M' || m.sex === 'F')
      )
      const enclosId = typeof body.enclosId === 'number' ? body.enclosId : null
      const { created, skipped, toEnclos } = yield* repo.importMounts(valid, enclosId)
      return HttpServerResponse.unsafeJson({
        created: created.length,
        skipped,
        toEnclos,
        mounts: created
      })
    })
  ),

  HttpRouter.post(
    '/api/clone',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as Partial<CloneInput>
      if (typeof body.survivorId !== 'number' || typeof body.consumedId !== 'number') {
        return HttpServerResponse.unsafeJson(
          { error: 'clone requires survivorId, consumedId' },
          { status: 400 }
        )
      }
      const clone = yield* repo.recordClone(body as CloneInput)
      return Option.match(clone, {
        onNone: () =>
          HttpServerResponse.unsafeJson(
            { error: 'Need two distinct steriles of the same generation' },
            { status: 400 }
          ),
        onSome: (d) => HttpServerResponse.unsafeJson(d)
      })
    })
  ),

  HttpRouter.del(
    '/api/dragodinde/:id',
    Effect.gen(function* () {
      const repo = yield* Repo
      const id = yield* idParam
      const ok = yield* repo.removeDrago(id)
      return ok
        ? HttpServerResponse.unsafeJson({ ok: true })
        : HttpServerResponse.unsafeJson({ error: 'Not found' }, { status: 404 })
    })
  ),

  HttpRouter.patch(
    '/api/dragodinde/:id',
    Effect.gen(function* () {
      const repo = yield* Repo
      const id = yield* idParam
      const body = (yield* readBody) as DragoPatch
      const updated = yield* repo.patchDrago(id, body)
      return Option.match(updated, {
        onNone: () => HttpServerResponse.unsafeJson({ error: 'Not found' }, { status: 404 }),
        onSome: (d) => HttpServerResponse.unsafeJson(d)
      })
    })
  ),

  HttpRouter.post(
    '/api/settings',
    Effect.gen(function* () {
      const repo = yield* Repo
      const discord = yield* Discord
      const body = (yield* readBody) as { webhookUrl?: unknown; aiKey?: unknown }
      if (typeof body.webhookUrl === 'string') yield* repo.setWebhook(body.webhookUrl.trim())
      if (typeof body.aiKey === 'string') yield* repo.setAiKey(body.aiKey) // "" clears it
      const webhookConfigured = yield* discord.isConfigured
      const aiConfigured = yield* repo.hasAiKey
      return HttpServerResponse.unsafeJson({ webhookConfigured, aiConfigured })
    })
  ),

  HttpRouter.post(
    '/api/test-notify',
    Effect.gen(function* () {
      const discord = yield* Discord
      const result = yield* discord.send('🔔 Test from Dragodinde Notif — the webhook works!')
      return HttpServerResponse.unsafeJson(result)
    })
  ),

  HttpRouter.post(
    '/api/achievements',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as { colors?: unknown }
      const colors = Array.isArray(body.colors)
        ? body.colors.filter((c): c is string => typeof c === 'string')
        : []
      const saved = yield* repo.setAchievements(colors)
      return HttpServerResponse.unsafeJson({ achievements: saved })
    })
  )
)

export const router = router2.pipe(
  // Better Auth owns everything under /api/auth/* (sign-in, callback, sign-out, get-session).
  HttpRouter.all('/api/auth/*', betterAuthApp),
  // Who am I? 401 when no session — the frontend uses this to show the login wall.
  HttpRouter.get(
    '/api/me',
    Effect.gen(function* () {
      const user = yield* sessionUser
      return Option.match(user, {
        onNone: () => HttpServerResponse.unsafeJson({ error: 'unauthenticated' }, { status: 401 }),
        onSome: (u) =>
          HttpServerResponse.unsafeJson({ id: u.id, name: u.name, image: u.image ?? null })
      })
    })
  )
)
