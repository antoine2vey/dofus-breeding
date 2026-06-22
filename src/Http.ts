import { fileURLToPath } from 'node:url'
import {
  type AssistEnclos,
  type AssistMount,
  arbitrate,
  assistantPlan,
  buildName,
  cheptelAccounting,
  extractionCandidates,
  normalizeSpecies,
  recommend,
  resolveColor,
  SPECIES,
  SPECIES_LIST,
  type Species,
  type SpeciesConfig
} from '@dd/core'
import {
  FileSystem,
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse
} from '@effect/platform'
import * as NodeHttpServerRequest from '@effect/platform-node/NodeHttpServerRequest'
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
import { Config, Effect, Option, Stream } from 'effect'
import { Ai, type AiActions, type ChatMessage } from './Ai.js'
import { auth } from './auth.js'
import { Discord } from './Discord.js'
import {
  BARS,
  FOCUSABLE,
  MAX_DRAGODINDES,
  MAX_ENCLOS,
  MAX_FOCUS,
  MAX_STABLE,
  type Mount,
  SERENITY_GOAL,
  SERENITY_MAX,
  SERENITY_MIN,
  STAT_MAX
} from './domain.js'
import {
  type CloneInput,
  type CrossInput,
  type DragoPatch,
  type EnclosPatch,
  type ImportRow,
  Repo,
  type SeedInput
} from './Repo.js'
import { requireUserId, withUser } from './tenant.js'

/** The one projection from a stored Dragodinde to the planner's AssistMount. AssistMount is a
 *  superset of the recommender's InvMount, so this single adapter feeds /api/recommend,
 *  /api/assistant/plan, and the AI getState alike. */
const toAssistMount = (d: Mount): AssistMount => ({
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
    '/rewards/:name',
    Effect.gen(function* () {
      const p = yield* HttpRouter.params
      return yield* serveStatic(`rewards/${p['name'] ?? ''}`)
    })
  ),

  HttpRouter.get(
    '/api/state',
    Effect.gen(function* () {
      const repo = yield* Repo
      const discord = yield* Discord
      const enclos = yield* repo.all
      const stable = yield* repo.stable
      // Achievements (succès) are per-species — colours overlap across species, so the goal sets
      // must be keyed by species. The frontend pulls each species' colour/letter data from @dd/core.
      const achievements: Record<string, ReadonlyArray<string>> = {}
      for (const s of SPECIES_LIST) achievements[s] = yield* repo.getAchievements(s)
      const speciesConfig = yield* repo.getSpeciesConfig
      const webhookConfigured = yield* discord.isConfigured
      const aiConfigured = yield* repo.hasAiKey
      const webhookUrl = yield* repo.getWebhook // owner's own webhook, for their settings input
      const tickMs = yield* Config.integer('TICK_MS').pipe(Config.withDefault(10000))
      return HttpServerResponse.unsafeJson({
        enclos,
        stable,
        achievements,
        settings: { webhookConfigured, aiConfigured, webhookUrl, speciesConfig },
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
          maxMounts: MAX_DRAGODINDES,
          maxDragodindes: MAX_DRAGODINDES, // back-compat alias
          species: SPECIES_LIST.map((s) => ({
            species: s,
            label: SPECIES[s].label,
            icon: SPECIES[s].icon,
            accent: SPECIES[s].accent
          }))
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
        species?: string
        targetGen?: number
        level?: number
        optimakina?: boolean
        clonage?: boolean
        freeSlots?: number
      }
      const species = normalizeSpecies(body.species)
      const enclos = yield* repo.all
      const all = yield* repo.allMounts // stable + enclos — the whole collection
      const emptySlots = enclos.reduce(
        (s, e) => s + Math.max(0, MAX_DRAGODINDES - e.mounts.length),
        0
      )
      const mounts = all.filter((m) => m.species === species).map(toAssistMount)
      const result = recommend(species, {
        mounts,
        targetGen: typeof body.targetGen === 'number' ? body.targetGen : 10,
        freeSlots: typeof body.freeSlots === 'number' ? body.freeSlots : Math.max(1, emptySlots),
        level: typeof body.level === 'number' ? body.level : 60,
        optimakina: body.optimakina === true,
        clonage: body.clonage !== false,
        achievements: yield* repo.getAchievements(species)
      })
      return HttpServerResponse.unsafeJson(result)
    })
  ),

  HttpRouter.post(
    '/api/assistant/plan',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as {
        species?: string
        targetGen?: number
        level?: number
        optimakina?: boolean
        clonage?: boolean
      }
      const species = normalizeSpecies(body.species)
      const enclos = yield* repo.all
      const all = yield* repo.allMounts
      const mounts = all.filter((m) => m.species === species).map(toAssistMount)
      // enclos count is the TOTAL (mixed-species) occupancy so free capacity is correct.
      const assistEnclos: AssistEnclos[] = enclos.map((e) => ({
        id: e.id,
        name: e.name,
        focus: [...e.focus],
        count: e.mounts.length
      }))
      const result = assistantPlan(species, {
        mounts,
        enclos: assistEnclos,
        targetGen: typeof body.targetGen === 'number' ? body.targetGen : 10,
        level: typeof body.level === 'number' ? body.level : 60,
        optimakina: body.optimakina === true,
        clonage: body.clonage !== false,
        achievements: yield* repo.getAchievements(species)
      })
      return HttpServerResponse.unsafeJson(result)
    })
  ),

  // Extraction — sacrifice surplus "done" mounts for the species' reward item. The client sends
  // colour+count (per the per-colour stepper) plus the same plan params it computed the list with;
  // the SERVER rebuilds the cheptel, REVALIDATES surplus, resolves which mounts to delete
  // (steriles first so the plan's best breeders are kept), deletes them, and returns the reward.
  HttpRouter.post(
    '/api/extract',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as {
        species?: string
        targetGen?: number
        level?: number
        optimakina?: boolean
        clonage?: boolean
        items?: { color?: string; count?: number }[]
      }
      const species = normalizeSpecies(body.species)
      const items = Array.isArray(body.items) ? body.items : []
      const all = yield* repo.allMounts
      const mounts = all.filter((m) => m.species === species).map(toAssistMount)
      const acc = cheptelAccounting(species, {
        mounts,
        achievements: yield* repo.getAchievements(species),
        targetGen: typeof body.targetGen === 'number' ? body.targetGen : 10,
        level: typeof body.level === 'number' ? body.level : 60,
        optima: body.optimakina === true,
        clonage: body.clonage !== false
      })
      const byColor = new Map(extractionCandidates(species, mounts, acc).map((c) => [c.color, c]))

      // Resolve mounts to delete: steriles first, then fertile, then féconde — so the reserved best
      // breeders are the ones we keep. Revalidate every requested count against the live surplus.
      const STATUS_ORDER: Record<string, number> = { sterile: 0, fertile: 1, feconde: 2 }
      const ids: number[] = []
      let total = 0
      for (const it of items) {
        const color = resolveColor(species, it.color ?? '') ?? it.color ?? ''
        const cand = byColor.get(color)
        const count = Math.max(0, Math.floor(it.count ?? 0))
        if (!cand || count === 0) continue
        if (count > cand.surplus) {
          return HttpServerResponse.unsafeJson(
            { error: `Surplus insuffisant pour ${color} (${cand.surplus} disponible(s)).` },
            { status: 409 }
          )
        }
        const pool = mounts
          .filter((m) => m.color === color && !m.keeper)
          .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
          .slice(0, count)
        for (const m of pool) ids.push(m.id)
        total += count * cand.gen
      }
      if (ids.length === 0) {
        return HttpServerResponse.unsafeJson({ error: 'Rien à extraire.' }, { status: 400 })
      }
      const removed = yield* repo.removeMany(ids)
      return HttpServerResponse.unsafeJson({
        deletedCount: removed,
        deletedIds: ids,
        reward: { item: SPECIES[species].reward.item, total }
      })
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
        species?: string
        targetGen?: number
        level?: number
        optimakina?: boolean
        clonage?: boolean
      }
      const species = normalizeSpecies(body.species)
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
            mounts: all.map((m) => ({ ...toAssistMount(m), species: m.species })),
            enclos: enclos.map((e) => ({
              id: e.id,
              name: e.name,
              focus: [...e.focus],
              count: e.mounts.length
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
          // Normalise the colour to its canonical name for the active species and name each mount by
          // the in-game convention (e.g. "a-f"), not the raw colour string.
          const color = resolveColor(species, p.color) ?? p.color
          const name = buildName(species, { color, sex: p.sex, keeper: false })
          const rows = Array.from({ length: p.count }, () => ({
            name,
            color,
            sex: p.sex,
            status: p.status
          }))
          const r = await runScoped(repo.importMounts(rows, null, species))
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
          species,
          targetGen: typeof body.targetGen === 'number' ? body.targetGen : 10,
          level: typeof body.level === 'number' ? body.level : 60,
          optimakina: body.optimakina === true,
          clonage: body.clonage !== false,
          achievements: yield* repo.getAchievements(species)
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
      const body = (yield* readBody) as {
        mounts?: ImportRow[]
        enclosId?: number | null
        species?: string
      }
      if (!Array.isArray(body.mounts)) {
        return HttpServerResponse.unsafeJson({ error: 'import requires mounts[]' }, { status: 400 })
      }
      const valid = body.mounts.filter(
        (m): m is ImportRow =>
          !!m && typeof m.color === 'string' && (m.sex === 'M' || m.sex === 'F')
      )
      const enclosId = typeof body.enclosId === 'number' ? body.enclosId : null
      const { created, skipped, toEnclos } = yield* repo.importMounts(
        valid,
        enclosId,
        normalizeSpecies(body.species)
      )
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
      const body = (yield* readBody) as {
        webhookUrl?: unknown
        aiKey?: unknown
        speciesConfig?: unknown
      }
      if (typeof body.webhookUrl === 'string') yield* repo.setWebhook(body.webhookUrl.trim())
      if (typeof body.aiKey === 'string') yield* repo.setAiKey(body.aiKey) // "" clears it
      if (body.speciesConfig && typeof body.speciesConfig === 'object')
        yield* repo.setSpeciesConfig(body.speciesConfig as SpeciesConfig)
      const webhookConfigured = yield* discord.isConfigured
      const aiConfigured = yield* repo.hasAiKey
      const speciesConfig = yield* repo.getSpeciesConfig
      return HttpServerResponse.unsafeJson({ webhookConfigured, aiConfigured, speciesConfig })
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
      const body = (yield* readBody) as { species?: string; colors?: unknown }
      const colors = Array.isArray(body.colors)
        ? body.colors.filter((c): c is string => typeof c === 'string')
        : []
      const saved = yield* repo.setAchievements(normalizeSpecies(body.species), colors)
      return HttpServerResponse.unsafeJson({ achievements: saved })
    })
  ),

  // Cross-species next-step: run the per-species recommender, then allocate the shared enclos slot
  // pool across all enabled species into one ranked action list.
  HttpRouter.post(
    '/api/arbiter',
    Effect.gen(function* () {
      const repo = yield* Repo
      const body = (yield* readBody) as { freeSlots?: number }
      const enclos = yield* repo.all
      const all = yield* repo.allMounts
      const emptySlots = enclos.reduce(
        (s, e) => s + Math.max(0, MAX_DRAGODINDES - e.mounts.length),
        0
      )
      const config = yield* repo.getSpeciesConfig
      const mountsBySpecies: Partial<Record<Species, AssistMount[]>> = {}
      const achievementsBySpecies: Partial<Record<Species, ReadonlyArray<string>>> = {}
      for (const s of SPECIES_LIST) {
        if (!config[s]?.enabled) continue
        mountsBySpecies[s] = all.filter((m) => m.species === s).map(toAssistMount)
        achievementsBySpecies[s] = yield* repo.getAchievements(s)
      }
      const result = arbitrate({
        config,
        mountsBySpecies,
        achievementsBySpecies,
        freeSlots: typeof body.freeSlots === 'number' ? body.freeSlots : Math.max(1, emptySlots)
      })
      return HttpServerResponse.unsafeJson(result)
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
