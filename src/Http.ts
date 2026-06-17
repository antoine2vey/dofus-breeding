import {
  FileSystem,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import { Config, Effect, Option } from "effect";
import { fileURLToPath } from "node:url";
import { Repo, type CrossInput, type DragoPatch, type EnclosPatch, type SeedInput } from "./Repo.js";
import { Discord } from "./Discord.js";
import { recommend, type InvMount } from "@dd/core";
import {
  BARS,
  FOCUSABLE,
  MAX_DRAGODINDES,
  MAX_ENCLOS,
  MAX_FOCUS,
  SERENITY_GOAL,
  SERENITY_MAX,
  SERENITY_MIN,
  STAT_MAX,
} from "./domain.js";

// Built React app (see web/). Run `cd web && npm run build`.
const WEB_DIR = fileURLToPath(new URL("../web/dist", import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const contentTypeFor = (p: string): string =>
  CONTENT_TYPES[p.slice(p.lastIndexOf("."))] ?? "application/octet-stream";

const NO_BUILD = `<!doctype html><meta charset="utf-8">
<body style="font-family:system-ui;background:#14151a;color:#e7e9ee;padding:40px">
<h1>🐉 Frontend not built</h1>
<p>Run <code>cd web &amp;&amp; npm install &amp;&amp; npm run build</code>,
or in dev <code>cd web &amp;&amp; npm run dev</code> (proxies to this server).</p>`;

const serveStatic = (rel: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const bytes = yield* fs.readFile(`${WEB_DIR}/${rel}`);
    return HttpServerResponse.uint8Array(bytes, { contentType: contentTypeFor(rel) });
  }).pipe(
    Effect.catchAll(() =>
      Effect.succeed(
        rel === "index.html"
          ? HttpServerResponse.text(NO_BUILD, { contentType: "text/html; charset=utf-8" })
          : HttpServerResponse.text("Not found", { status: 404 }),
      ),
    ),
  );

const readBody = HttpServerRequest.HttpServerRequest.pipe(
  Effect.flatMap((req) => req.json),
  Effect.catchAll(() => Effect.succeed<unknown>({})),
);

const idParam = HttpRouter.params.pipe(
  Effect.map((p) => Number(p["id"])),
);

export const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", serveStatic("index.html")),
  HttpRouter.get(
    "/assets/:name",
    Effect.gen(function* () {
      const p = yield* HttpRouter.params;
      return yield* serveStatic(`assets/${p["name"] ?? ""}`);
    }),
  ),

  HttpRouter.get(
    "/api/state",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const discord = yield* Discord;
      const enclos = yield* repo.all;
      const webhookConfigured = yield* discord.isConfigured;
      const tickMs = yield* Config.integer("TICK_MS").pipe(Config.withDefault(10000));
      return HttpServerResponse.unsafeJson({
        enclos,
        settings: { webhookConfigured },
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
          maxDragodindes: MAX_DRAGODINDES,
        },
      });
    }),
  ),

  HttpRouter.post(
    "/api/enclos",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const created = yield* repo.createEnclos;
      return Option.match(created, {
        onNone: () =>
          HttpServerResponse.unsafeJson({ error: `Max ${MAX_ENCLOS} enclos` }, { status: 400 }),
        onSome: (e) => HttpServerResponse.unsafeJson(e),
      });
    }),
  ),

  HttpRouter.del(
    "/api/enclos/:id",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const id = yield* idParam;
      const ok = yield* repo.removeEnclos(id);
      return ok
        ? HttpServerResponse.unsafeJson({ ok: true })
        : HttpServerResponse.unsafeJson({ error: "Need at least 1 enclos" }, { status: 400 });
    }),
  ),

  HttpRouter.patch(
    "/api/enclos/:id",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const id = yield* idParam;
      const body = (yield* readBody) as EnclosPatch;
      const ok = yield* repo.patchEnclos(id, body);
      return ok
        ? HttpServerResponse.unsafeJson({ ok: true })
        : HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 });
    }),
  ),

  HttpRouter.post(
    "/api/enclos/:id/dragodinde",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const id = yield* idParam;
      const seed = (yield* readBody) as SeedInput;
      const created = yield* repo.addDrago(id, seed);
      return Option.match(created, {
        onNone: () =>
          HttpServerResponse.unsafeJson(
            { error: `Max ${MAX_DRAGODINDES} dragodindes` },
            { status: 400 },
          ),
        onSome: (d) => HttpServerResponse.unsafeJson(d),
      });
    }),
  ),

  HttpRouter.post(
    "/api/recommend",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const body = (yield* readBody) as {
        targetGen?: number;
        level?: number;
        optimakina?: boolean;
        clonage?: boolean;
        freeSlots?: number;
      };
      const enclos = yield* repo.all;
      const all = enclos.flatMap((e) => e.dragodindes);
      const colorById = new Map(all.map((d) => [d.id, d.color]));
      const mounts: InvMount[] = all.map((d) => ({
        id: d.id,
        color: d.color,
        sex: d.sex,
        fertile: d.fertile,
        keeper: d.keeper,
        grandparents: [d.parentA, d.parentB]
          .map((pid) => (pid != null ? colorById.get(pid) : undefined))
          .filter((c): c is string => !!c),
      }));
      const result = recommend({
        mounts,
        targetGen: typeof body.targetGen === "number" ? body.targetGen : 10,
        freeSlots: typeof body.freeSlots === "number" ? body.freeSlots : Math.max(1, enclos.length),
        level: typeof body.level === "number" ? body.level : 60,
        optimakina: body.optimakina === true,
        clonage: body.clonage !== false,
      });
      return HttpServerResponse.unsafeJson(result);
    }),
  ),

  HttpRouter.post(
    "/api/breed",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const body = (yield* readBody) as Partial<CrossInput>;
      if (
        typeof body.parentAId !== "number" ||
        typeof body.parentBId !== "number" ||
        typeof body.color !== "string" ||
        (body.sex !== "M" && body.sex !== "F")
      ) {
        return HttpServerResponse.unsafeJson(
          { error: "breed requires parentAId, parentBId, color, sex" },
          { status: 400 },
        );
      }
      const baby = yield* repo.recordCross(body as CrossInput);
      return Option.match(baby, {
        onNone: () =>
          HttpServerResponse.unsafeJson({ error: "Parents not found or enclos full" }, { status: 400 }),
        onSome: (d) => HttpServerResponse.unsafeJson(d),
      });
    }),
  ),

  HttpRouter.del(
    "/api/dragodinde/:id",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const id = yield* idParam;
      const ok = yield* repo.removeDrago(id);
      return ok
        ? HttpServerResponse.unsafeJson({ ok: true })
        : HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 });
    }),
  ),

  HttpRouter.patch(
    "/api/dragodinde/:id",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const id = yield* idParam;
      const body = (yield* readBody) as DragoPatch;
      const updated = yield* repo.patchDrago(id, body);
      return Option.match(updated, {
        onNone: () => HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 }),
        onSome: (d) => HttpServerResponse.unsafeJson(d),
      });
    }),
  ),

  HttpRouter.post(
    "/api/settings",
    Effect.gen(function* () {
      const repo = yield* Repo;
      const discord = yield* Discord;
      const body = (yield* readBody) as { webhookUrl?: unknown };
      if (typeof body.webhookUrl === "string") yield* repo.setWebhook(body.webhookUrl.trim());
      const webhookConfigured = yield* discord.isConfigured;
      return HttpServerResponse.unsafeJson({ webhookConfigured });
    }),
  ),

  HttpRouter.post(
    "/api/test-notify",
    Effect.gen(function* () {
      const discord = yield* Discord;
      const result = yield* discord.send(
        "🔔 Test from Dragodinde Notif — the webhook works!",
      );
      return HttpServerResponse.unsafeJson(result);
    }),
  ),
);
