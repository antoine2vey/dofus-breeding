import { Config, Duration, Effect, Layer, Schedule } from 'effect'
import { Repo } from './Repo.js'
import { Discord } from './Discord.js'

/** The only continuous background process in the elapsed-time model: a coarse sweep that advances +
 *  persists the enclos that have actually ticked since last time, and fires each user's completions
 *  to THEIR own Discord webhook. State is computed elapsed-time on read, so this exists purely for
 *  notify-while-away. Cost scales with active ripening, not user count. */
export const TickerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const repo = yield* Repo
    const discord = yield* Discord
    const sweepMs = yield* Config.integer('SWEEP_MS').pipe(Config.withDefault(30000))

    const runSweep = Effect.gen(function* () {
      const groups = yield* repo.sweep()
      for (const g of groups) {
        const url = yield* repo.webhookFor(g.userId)
        yield* discord.notifyCompletedTo(url, g.items)
      }
    }).pipe(Effect.catchAllCause((cause) => Effect.logError('sweep failed', cause)))

    yield* Effect.logInfo(`Notification sweep started (every ${sweepMs}ms)`)
    yield* Effect.forkScoped(Effect.repeat(runSweep, Schedule.spaced(Duration.millis(sweepMs))))
  })
)
