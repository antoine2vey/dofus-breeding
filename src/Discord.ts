import { HttpClient, HttpClientRequest } from "@effect/platform";
import { Config, Effect } from "effect";
import { Repo, type CompletedItem } from "./Repo.js";
import { type FocusKey, BARS } from "./domain.js";

export interface DiscordEmbed {
  readonly title?: string;
  readonly description?: string;
  readonly color?: number;
}

export interface SendResult {
  readonly ok: boolean;
  readonly reason?: string;
}

const labelFor = (key: FocusKey): string => BARS.find((b) => b.key === key)?.label ?? key;

export class Discord extends Effect.Service<Discord>()("app/Discord", {
  effect: Effect.gen(function* () {
    const repo = yield* Repo;
    const client = yield* HttpClient.HttpClient;
    const envUrl = yield* Config.string("DISCORD_WEBHOOK_URL").pipe(Config.withDefault(""));

    const resolveUrl = Effect.gen(function* () {
      const fromDb = yield* repo.getWebhook;
      return fromDb || envUrl;
    });

    const isConfigured = resolveUrl.pipe(Effect.map((u) => u.length > 0));

    const send = (content: string, embeds?: ReadonlyArray<DiscordEmbed>): Effect.Effect<SendResult> =>
      Effect.gen(function* () {
        const url = yield* resolveUrl;
        if (!url) {
          yield* Effect.logWarning("No Discord webhook configured — skipping notification.");
          return { ok: false, reason: "no-webhook" } satisfies SendResult;
        }
        const req = yield* HttpClientRequest.post(url).pipe(
          HttpClientRequest.bodyJson({ content, embeds }),
        );
        const res = yield* client.execute(req);
        if (res.status >= 200 && res.status < 300) return { ok: true } satisfies SendResult;
        return { ok: false, reason: `http-${res.status}` } satisfies SendResult;
      }).pipe(
        Effect.catchAll((err) =>
          Effect.as(
            Effect.logError(`Discord webhook failed: ${String(err)}`),
            { ok: false, reason: "request-failed" } satisfies SendResult,
          ),
        ),
      );

    /** One message for all dragodindes that completed in the same tick. */
    const notifyCompleted = (items: ReadonlyArray<CompletedItem>) =>
      Effect.gen(function* () {
        if (items.length === 0) return;
        const lines = items.map((it) => {
          if (it.kind === "feconde") {
            return `• 💗 **${it.dragodinde.name}** _(${it.enclosName})_ — féconde, prête à reproduire !`;
          }
          const focus = it.focus.map(labelFor).join(" + ") || "—";
          return `• **${it.dragodinde.name}** _(${it.enclosName})_ — ${focus} maxed`;
        });
        const content =
          items.length === 1
            ? `🐉 A dragodinde is ready!`
            : `🐉 ${items.length} dragodindes are ready!`;
        yield* Effect.logInfo(`${content} ${items.map((i) => i.dragodinde.name).join(", ")}`);
        yield* send(content, [
          {
            title: "Breeding complete",
            color: 0x57f287,
            description: lines.join("\n"),
          },
        ]);
      });

    return { send, notifyCompleted, isConfigured } as const;
  }),
}) {}
