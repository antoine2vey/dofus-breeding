import { HttpClient, HttpClientRequest } from '@effect/platform'
import { Config, Effect } from 'effect'
import { Repo, type CompletedItem } from './Repo.js'
import { type FocusKey, BARS } from './domain.js'

export interface DiscordEmbed {
  readonly title?: string
  readonly description?: string
  readonly color?: number
}

export interface SendResult {
  readonly ok: boolean
  readonly reason?: string
}

const labelFor = (key: FocusKey): string => BARS.find((b) => b.key === key)?.label ?? key

export class Discord extends Effect.Service<Discord>()('app/Discord', {
  effect: Effect.gen(function* () {
    const repo = yield* Repo
    const client = yield* HttpClient.HttpClient
    const envUrl = yield* Config.string('DISCORD_WEBHOOK_URL').pipe(Config.withDefault(''))

    const resolveUrl = Effect.gen(function* () {
      const fromDb = yield* repo.getWebhook
      return fromDb || envUrl
    })

    const isConfigured = resolveUrl.pipe(Effect.map((u) => u.length > 0))

    /** POST a message to an explicit webhook URL ('' → skip). */
    const post = (
      url: string,
      content: string,
      embeds?: ReadonlyArray<DiscordEmbed>
    ): Effect.Effect<SendResult> =>
      Effect.gen(function* () {
        if (!url) {
          yield* Effect.logWarning('No Discord webhook configured — skipping notification.')
          return { ok: false, reason: 'no-webhook' } satisfies SendResult
        }
        const req = yield* HttpClientRequest.post(url).pipe(
          HttpClientRequest.bodyJson({ content, embeds })
        )
        const res = yield* client.execute(req)
        if (res.status >= 200 && res.status < 300) return { ok: true } satisfies SendResult
        return { ok: false, reason: `http-${res.status}` } satisfies SendResult
      }).pipe(
        Effect.catchAll((err) =>
          Effect.as(Effect.logError(`Discord webhook failed: ${String(err)}`), {
            ok: false,
            reason: 'request-failed'
          } satisfies SendResult)
        )
      )

    /** Send to the current user's webhook (or env fallback) — used by /api/test-notify. */
    const send = (
      content: string,
      embeds?: ReadonlyArray<DiscordEmbed>
    ): Effect.Effect<SendResult> =>
      resolveUrl.pipe(
        Effect.flatMap((url) => post(url, content, embeds)),
        Effect.catchAll(() =>
          Effect.succeed({ ok: false, reason: 'no-webhook' } satisfies SendResult)
        )
      )

    const completedEmbed = (items: ReadonlyArray<CompletedItem>) => {
      const lines = items.map((it) =>
        it.kind === 'feconde'
          ? `• 💗 **${it.dragodinde.name}** _(${it.enclosName})_ — féconde, prête à reproduire !`
          : `• **${it.dragodinde.name}** _(${it.enclosName})_ — ${it.focus.map(labelFor).join(' + ') || '—'} maxed`
      )
      const content =
        items.length === 1
          ? `🐉 A dragodinde is ready!`
          : `🐉 ${items.length} dragodindes are ready!`
      return {
        content,
        embeds: [{ title: 'Breeding complete', color: 0x57f287, description: lines.join('\n') }]
      }
    }

    /** One grouped message for a user's completions, to THEIR webhook — used by the sweep. */
    const notifyCompletedTo = (url: string, items: ReadonlyArray<CompletedItem>) =>
      Effect.gen(function* () {
        if (items.length === 0 || !url) return
        const { content, embeds } = completedEmbed(items)
        yield* Effect.logInfo(`${content} ${items.map((i) => i.dragodinde.name).join(', ')}`)
        yield* post(url, content, embeds)
      })

    return { send, notifyCompletedTo, isConfigured } as const
  })
}) {}
