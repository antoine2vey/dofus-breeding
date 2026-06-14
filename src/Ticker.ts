import { Config, Duration, Effect, Layer, Schedule } from "effect";
import { Repo } from "./Repo.js";
import { Discord } from "./Discord.js";

/** Background fiber: every TICK_MS, advance all enclos and notify on completion. */
export const TickerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const repo = yield* Repo;
    const discord = yield* Discord;
    const tickMs = yield* Config.integer("TICK_MS").pipe(Config.withDefault(10000));

    const tick = Effect.gen(function* () {
      const completed = yield* repo.tickAll;
      yield* discord.notifyCompleted(completed);
    }).pipe(Effect.catchAllCause((cause) => Effect.logError("tick failed", cause)));

    yield* Effect.logInfo(`Ticker started (every ${tickMs}ms)`);
    yield* Effect.forkScoped(Effect.repeat(tick, Schedule.spaced(Duration.millis(tickMs))));
  }),
);
